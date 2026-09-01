#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { userInfo } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const MAX_LEDGER_ORDINALS_V1 = 4_096;
const MAX_TREE_DEPTH_V1 = 64;
const MAX_TREE_ENTRIES_V1 = 10_000;
const MAX_FILE_BYTES_V1 = 33_554_432;
const MAX_TOTAL_BYTES_V1 = 536_870_912;
const MAX_AUTHORITY_BYTES_V1 = 1_048_576;
const MAX_NO_REPLACE_PUBLISHER_TEMP_CANDIDATES_V1 = 8;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const GIT_HASH = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const RECORD_NAME = /^(\d{20})-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.json$/;
const ARCHIVE_NAME = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.dist$/;
const ROTATION_LEDGER_DIRECTORY = ".setfarm/build-generation-rotation-ledger-v1";
const ARCHIVE_DIRECTORY = ".setfarm/build-generations-v1";
const MAINTENANCE_LOCK_FILE = "build-generation-maintenance-lock-v1.json";
const CODE_OWNED_REPOSITORY_ROOT_V1 = repositoryRootV1();
const CODE_OWNER_HOME_V1 = userInfo().homedir;
const CODE_OWNED_WORKSPACE_ROOT_V1 = path.join(CODE_OWNER_HOME_V1, "ai", "setrox");
const MISSION_CONTROL_ROOT_V1 = path.join(CODE_OWNED_WORKSPACE_ROOT_V1, "mission-control");
const RETENTION_STORE_ROOT_V1 = path.join(CODE_OWNED_WORKSPACE_ROOT_V1, "data", "internal-production-baseline", "build-generation-retention-v1");
const QUARANTINE_DIRECTORY_V1 = ".setfarm/build-generation-quarantine-v1";
const MAX_QUARANTINED_GENERATIONS_V1 = 1;
const LSOF_REFERENCE_OBSERVER_EXECUTABLE_V1 = "/usr/sbin/lsof";
const LSOF_REFERENCE_OBSERVER_TIMEOUT_MS_V1 = 10_000;
const LSOF_REFERENCE_OBSERVER_MAX_BUFFER_BYTES_V1 = 1_048_576;
const PLUTIL_EXECUTABLE_V1 = "/usr/bin/plutil";
const LAUNCHCTL_EXECUTABLE_V1 = "/bin/launchctl";
const RUNTIME_OBSERVER_TIMEOUT_MS_V1 = 10_000;
const RUNTIME_OBSERVER_MAX_BUFFER_BYTES_V1 = 1_048_576;
const MISSION_CONTROL_LOADED_BUILD_URL_V1 = "http://127.0.0.1:3080/api/internal-production/product-build-authority-v2-loaded-build";
const MISSION_CONTROL_LOADED_BUILD_OBSERVER_PROGRAM_V1 = String.raw`import http from "node:http";
const chunks=[]; let size=0; const token=await new Promise((resolve,reject)=>{const parts=[];process.stdin.on("data",(part)=>parts.push(part));process.stdin.on("end",()=>resolve(Buffer.concat(parts).toString("utf8")));process.stdin.on("error",reject);});
const request=http.request({agent:false,host:"127.0.0.1",port:3080,method:"GET",path:"/api/internal-production/product-build-authority-v2-loaded-build",headers:{accept:"application/json",connection:"close","x-setfarm-operational-token":token}},(response)=>{if(response.statusCode!==200){response.resume();process.exitCode=91;return;}response.on("data",(chunk)=>{size+=chunk.length;if(size>1048576){request.destroy();process.exitCode=92;return;}chunks.push(chunk);});response.on("end",()=>{if(process.exitCode)return;process.stdout.write(Buffer.concat(chunks));});});request.setTimeout(10000,()=>request.destroy(new Error("timeout")));request.on("error",()=>{process.exitCode=93;});request.end();`;
const EMPTY_SHA256_V1 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const LAUNCH_AGENT_CONFIGS_V1 = Object.freeze([
  Object.freeze({
    label: "com.setrox.setfarm-spawner",
    locator: path.join(CODE_OWNER_HOME_V1, "Library", "LaunchAgents", "com.setrox.setfarm-spawner.plist"),
    workingDirectory: null,
    environmentNames: Object.freeze(["PATH", "SETFARM_PG_URL"]),
  }),
  Object.freeze({
    label: "com.setrox.setfarm-dashboard",
    locator: path.join(CODE_OWNER_HOME_V1, "Library", "LaunchAgents", "com.setrox.setfarm-dashboard.plist"),
    workingDirectory: null,
    environmentNames: Object.freeze(["PATH", "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL"]),
  }),
  Object.freeze({
    label: "com.setrox.mission-control",
    locator: path.join(CODE_OWNER_HOME_V1, "Library", "LaunchAgents", "com.setrox.mission-control.plist"),
    workingDirectory: MISSION_CONTROL_ROOT_V1,
    environmentNames: Object.freeze([
      "CLI_PATH", "MC_HOST", "MC_INTERNAL_URL", "MC_PORT", "PATH", "PROJECTS_DIR", "PROJECTS_JSON",
      "SETFARM_DIR", "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL", "SETFARM_REPO_DIR", "SETFARM_URL",
    ]),
  }),
]);
const PROCESS_IDENTITY_EXECUTABLE_V1 = "/bin/ps";
const PROCESS_IDENTITY_TIMEOUT_MS_V1 = 10_000;
const PROCESS_IDENTITY_MAX_BUFFER_BYTES_V1 = 1_048_576;
const PROCESS_ENV_V1 = Object.freeze({
  PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
  LANG: "C",
  LC_ALL: "C",
});
const GIT_ENV_V2 = Object.freeze({
  PATH: "/usr/bin:/bin",
  LANG: "C",
  LC_ALL: "C",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_NO_REPLACE_OBJECTS: "1",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_TERMINAL_PROMPT: "0",
});
const GIT_PREFIX_V2 = Object.freeze([
  "-c", "core.hooksPath=/dev/null",
  "-c", "core.fsmonitor=false",
]);

function fail(message, code = "BUILD_GENERATION_AUTHORITY_CORRUPTION") {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function repositoryRootV1() {
  return path.dirname(path.dirname(fileURLToPath(import.meta.url)));
}

function compareBytes(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function hasExactKeys(value, expected) {
  return Array.isArray(expected)
    && canonicalJsonV1(Object.keys(value).sort(compareBytes)) === canonicalJsonV1([...expected].sort(compareBytes));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function missionControlBuildIdentityBytesHashV1(identity) {
  return sha256(Buffer.from(`${JSON.stringify({
    schema: identity.schema,
    sourceSha: identity.sourceSha,
    treeHash: identity.treeHash,
    buildHash: identity.buildHash,
  })}\n`, "utf8"));
}

export function canonicalJsonV1(value) {
  const ancestors = new WeakSet();
  function serialize(current) {
    if (current === null) return "null";
    if (typeof current === "string" || typeof current === "boolean") return JSON.stringify(current);
    if (typeof current === "number") {
      if (!Number.isFinite(current)) fail("canonical JSON contains a non-finite number");
      return Object.is(current, -0) ? "0" : JSON.stringify(current);
    }
    if (typeof current !== "object") fail("canonical JSON contains an unsupported value");
    if (ancestors.has(current)) fail("canonical JSON contains a cycle");
    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype) fail("canonical JSON array has an unsupported prototype");
        const ownKeys = Reflect.ownKeys(current);
        if (
          ownKeys.length !== current.length + 1
          || ownKeys.at(-1) !== "length"
          || ownKeys.slice(0, -1).some((key, ordinal) => key !== String(ordinal))
        ) fail("canonical JSON array is sparse or has extra members");
        const items = [];
        for (let ordinal = 0; ordinal < current.length; ordinal += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(current, String(ordinal));
          if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) fail("canonical JSON array member is not one enumerable value");
          items.push(serialize(descriptor.value));
        }
        return `[${items.join(",")}]`;
      }
      if (Object.getPrototypeOf(current) !== Object.prototype) fail("canonical JSON object has an unsupported prototype");
      const ownKeys = Reflect.ownKeys(current);
      if (ownKeys.some((key) => typeof key !== "string")) fail("canonical JSON object has a symbol member");
      const keys = ownKeys.sort(compareBytes);
      const members = [];
      for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) fail("canonical JSON object has a hidden or accessor member");
        members.push(`${JSON.stringify(key)}:${serialize(descriptor.value)}`);
      }
      return `{${members.join(",")}}`;
    } finally {
      ancestors.delete(current);
    }
  }
  return serialize(value);
}

export function hashCanonicalJsonV1(value) {
  return sha256(Buffer.from(canonicalJsonV1(value), "utf8"));
}

function modeOf(stats) {
  return Number(stats.mode & 0o777n);
}

function optionalLstat(target) {
  try {
    return lstatSync(target, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

function fsyncDirectory(directory) {
  const descriptor = openSync(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function directoryIdentity(directory, expectedDevice) {
  const realpath = realpathSync(directory);
  const stats = lstatSync(directory, { bigint: true });
  if (!stats.isDirectory() || stats.isSymbolicLink() || realpath !== directory) fail(`${directory} is not one real directory`);
  if (expectedDevice !== undefined && stats.dev !== expectedDevice) fail(`${directory} is on the wrong device`);
  const linkCount = Number(stats.nlink);
  if (!Number.isSafeInteger(linkCount) || linkCount < 1) fail(`${directory} has an invalid link count`);
  return Object.freeze({
    realpath,
    devDecimal: stats.dev.toString(10),
    inoDecimal: stats.ino.toString(10),
    mode: modeOf(stats),
    linkCount,
  });
}

function sameDirectoryIdentity(left, right) {
  return left.realpath === right.realpath
    && left.devDecimal === right.devDecimal
    && left.inoDecimal === right.inoDecimal
    && left.mode === right.mode
    && left.linkCount === right.linkCount;
}

function sameDirectoryObject(left, right) {
  return left.realpath === right.realpath
    && left.devDecimal === right.devDecimal
    && left.inoDecimal === right.inoDecimal
    && left.mode === right.mode;
}

function ensureDirectory(directory, mode, parent, device) {
  const before = directoryIdentity(parent, device);
  try {
    mkdirSync(directory, { mode });
    fsyncDirectory(parent);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  const observed = directoryIdentity(directory, device);
  if (observed.mode !== mode) fail(`${directory} has mode ${observed.mode.toString(8)} instead of ${mode.toString(8)}`);
  const after = directoryIdentity(parent, device);
  if (!sameDirectoryObject(before, after)) fail(`${parent} changed while creating ${directory}`);
  return observed;
}

function readStableRegular(file, { device, mode, linkCounts = [1], maxBytes = MAX_AUTHORITY_BYTES_V1 } = {}) {
  let descriptor;
  try {
    descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink()) fail(`${file} is not a regular file`);
    if (device !== undefined && before.dev !== device) fail(`${file} is on the wrong device`);
    if (!linkCounts.includes(Number(before.nlink))) fail(`${file} has an invalid link count`);
    if (mode !== undefined && modeOf(before) !== mode) fail(`${file} has an invalid mode`);
    if (before.size > BigInt(maxBytes)) fail(`${file} exceeds its byte cap`);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    const named = lstatSync(file, { bigint: true });
    if (
      before.dev !== after.dev || before.ino !== after.ino || before.mode !== after.mode
      || before.uid !== after.uid
      || before.nlink !== after.nlink || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs
      || after.dev !== named.dev || after.ino !== named.ino || after.mode !== named.mode
      || after.uid !== named.uid
      || after.nlink !== named.nlink || after.size !== named.size
      || after.mtimeNs !== named.mtimeNs || after.ctimeNs !== named.ctimeNs
      || BigInt(bytes.length) !== after.size
    ) fail(`${file} changed while being read`);
    return Object.freeze({ bytes, stats: after, mode: modeOf(after) });
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function unlinkStable(file, observed, parent) {
  const reopened = readStableRegular(file, {
    device: observed.stats.dev,
    mode: observed.mode,
    linkCounts: [Number(observed.stats.nlink)],
    maxBytes: Number(observed.stats.size),
  });
  if (reopened.stats.ino !== observed.stats.ino || !reopened.bytes.equals(observed.bytes)) fail(`${file} changed before unlink`);
  unlinkSync(file);
  fsyncDirectory(parent);
  if (optionalLstat(file)) fail(`${file} remained after unlink`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function publisherTempPattern(basename) {
  return new RegExp(`^\\.${escapeRegex(basename)}\\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\\.tmp$`);
}

function blockedPublisherPlan(basename, reason) {
  return Object.freeze({
    state: "block",
    fixedName: basename,
    selectedTempName: null,
    cleanupTempNames: Object.freeze([]),
    reason,
  });
}

// This is deliberately the only public recovery surface shared with the
// current-entry writer. It classifies already-observed immutable record state;
// it cannot select a filesystem root, pathname, process, command, or env.
export function planNoReplacePublisherRecoveryV1(input) {
  if (!input || !hasExactKeys(input, ["basename", "candidateBytes", "entries"])) {
    return blockedPublisherPlan(null, "input_shape");
  }
  const { basename, candidateBytes, entries } = input;
  if (
    typeof basename !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(basename)
    || basename === "." || basename === ".."
    || !Buffer.isBuffer(candidateBytes)
    || candidateBytes.length > MAX_AUTHORITY_BYTES_V1
    || !Array.isArray(entries)
  ) return blockedPublisherPlan(typeof basename === "string" ? basename : null, "input_value");
  let parsedCandidate;
  try {
    parsedCandidate = JSON.parse(candidateBytes.toString("utf8"));
  } catch {
    return blockedPublisherPlan(basename, "candidate_json");
  }
  if (!candidateBytes.equals(Buffer.from(`${canonicalJsonV1(parsedCandidate)}\n`, "utf8"))) {
    return blockedPublisherPlan(basename, "candidate_canonical_bytes");
  }
  const pattern = publisherTempPattern(basename);
  const seenNames = new Set();
  const normalized = [];
  for (const entry of entries) {
    if (
      !entry || !hasExactKeys(entry, ["name", "bytes", "mode", "linkCount", "devDecimal", "inoDecimal"])
      || typeof entry.name !== "string" || seenNames.has(entry.name)
      || (entry.name !== basename && !pattern.test(entry.name))
      || !Buffer.isBuffer(entry.bytes) || entry.bytes.length > MAX_AUTHORITY_BYTES_V1
      || entry.mode !== 0o600 || ![1, 2].includes(entry.linkCount)
      || !/^(?:0|[1-9][0-9]*)$/.test(entry.devDecimal)
      || !/^(?:0|[1-9][0-9]*)$/.test(entry.inoDecimal)
    ) return blockedPublisherPlan(basename, "entry_shape");
    seenNames.add(entry.name);
    if (!entry.bytes.equals(candidateBytes)) return blockedPublisherPlan(basename, "competing_bytes");
    normalized.push(entry);
  }
  normalized.sort((left, right) => compareBytes(left.name, right.name));
  const fixed = normalized.filter((entry) => entry.name === basename);
  const temps = normalized.filter((entry) => entry.name !== basename);
  if (fixed.length > 1 || temps.length > MAX_NO_REPLACE_PUBLISHER_TEMP_CANDIDATES_V1) {
    return blockedPublisherPlan(basename, "candidate_capacity");
  }
  if (fixed.length === 0) {
    if (temps.some((entry) => entry.linkCount !== 1)) return blockedPublisherPlan(basename, "temp_link_count");
    if (temps.length === 0) {
      return Object.freeze({ state: "resume", fixedName: basename, selectedTempName: null, cleanupTempNames: Object.freeze([]) });
    }
    const [selected, ...duplicates] = temps;
    if (duplicates.length === 0) {
      return Object.freeze({ state: "resume", fixedName: basename, selectedTempName: selected.name, cleanupTempNames: Object.freeze([]) });
    }
    return Object.freeze({
      state: "cleanup",
      fixedName: basename,
      selectedTempName: selected.name,
      cleanupTempNames: Object.freeze(duplicates.map((entry) => entry.name)),
      terminalState: "resume",
    });
  }
  const fixedEntry = fixed[0];
  if (temps.length === 0) {
    if (fixedEntry.linkCount !== 1) return blockedPublisherPlan(basename, "fixed_link_count");
    return Object.freeze({ state: "adopt", fixedName: basename, selectedTempName: null, cleanupTempNames: Object.freeze([]) });
  }
  const linkedTemps = temps.filter((entry) => (
    entry.devDecimal === fixedEntry.devDecimal && entry.inoDecimal === fixedEntry.inoDecimal
  ));
  if (linkedTemps.length > 0) {
    if (
      temps.length !== 1 || linkedTemps.length !== 1
      || fixedEntry.linkCount !== 2 || linkedTemps[0].linkCount !== 2
    ) return blockedPublisherPlan(basename, "linked_shape");
  } else if (fixedEntry.linkCount !== 1 || temps.some((entry) => entry.linkCount !== 1)) {
    return blockedPublisherPlan(basename, "duplicate_link_count");
  }
  return Object.freeze({
    state: "cleanup",
    fixedName: basename,
    selectedTempName: null,
    cleanupTempNames: Object.freeze(temps.map((entry) => entry.name)),
    terminalState: "adopt",
  });
}

function publishNoReplaceFileV1(directory, basename, bytes, expectedMode = 0o600) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_AUTHORITY_BYTES_V1) fail("publication bytes are invalid");
  const parent = directoryIdentity(directory);
  const device = BigInt(parent.devDecimal);
  const pattern = publisherTempPattern(basename);
  const family = readdirSync(directory).filter((name) => name === basename || name.startsWith(`.${basename}.`)).sort(compareBytes);
  const fixedPresent = family.includes(basename);
  const temps = family.filter((name) => name !== basename);
  if (temps.length > MAX_NO_REPLACE_PUBLISHER_TEMP_CANDIDATES_V1) fail("publisher temporary capacity exceeded");
  if (temps.some((name) => !pattern.test(name))) fail("unknown publisher-like dirent");
  const fixedPath = path.join(directory, basename);
  let fixed;
  if (fixedPresent) {
    fixed = readStableRegular(fixedPath, { device, mode: expectedMode, linkCounts: [1, 2] });
    if (!fixed.bytes.equals(bytes)) fail(`${basename} conflicts with immutable authority`);
    for (const name of temps) {
      const tempPath = path.join(directory, name);
      const temp = readStableRegular(tempPath, { device, mode: expectedMode, linkCounts: [1, 2] });
      if (!temp.bytes.equals(bytes)) fail(`${basename} has competing temporary bytes`);
      unlinkStable(tempPath, temp, directory);
    }
    fsyncDirectory(directory);
    const reopened = readStableRegular(fixedPath, { device, mode: expectedMode, linkCounts: [1] });
    if (!reopened.bytes.equals(bytes)) fail(`${basename} changed after recovery`);
    return Object.freeze({ path: fixedPath, bytes: reopened.bytes });
  }

  let selected;
  for (const name of temps) {
    const tempPath = path.join(directory, name);
    const temp = readStableRegular(tempPath, { device, mode: expectedMode, linkCounts: [1] });
    if (temp.bytes.equals(bytes)) {
      if (!selected) selected = Object.freeze({ name, path: tempPath, observed: temp });
    } else if (temps.length === 1) {
      unlinkStable(tempPath, temp, directory);
    } else fail(`${basename} has competing unpublished temporaries`);
  }
  let ownTemp = false;
  if (!selected) {
    const name = `.${basename}.${randomUUID()}.tmp`;
    const tempPath = path.join(directory, name);
    let descriptor;
    try {
      descriptor = openSync(tempPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      writeFileSync(descriptor, bytes);
      fsyncSync(descriptor);
      if (expectedMode !== 0o600) {
        fchmodSync(descriptor, expectedMode);
        fsyncSync(descriptor);
      }
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
    selected = Object.freeze({
      name,
      path: tempPath,
      observed: readStableRegular(tempPath, { device, mode: expectedMode, linkCounts: [1] }),
    });
    ownTemp = true;
  }
  try {
    linkSync(selected.path, fixedPath);
    fsyncDirectory(directory);
  } catch (error) {
    if (error?.code !== "EEXIST" && error?.code !== "ENOENT") throw error;
    const winner = readStableRegular(fixedPath, { device, mode: expectedMode, linkCounts: [1, 2] });
    if (!winner.bytes.equals(bytes)) {
      if (ownTemp && optionalLstat(selected.path)) {
        const loser = readStableRegular(selected.path, { device, mode: expectedMode, linkCounts: [1] });
        if (!loser.bytes.equals(bytes)) fail(`${basename} losing temporary changed`);
        unlinkStable(selected.path, loser, directory);
      }
      fail(`${basename} concurrent winner conflicts`);
    }
    if (!optionalLstat(selected.path)) {
      const reopened = readStableRegular(fixedPath, { device, mode: expectedMode, linkCounts: [1] });
      if (!reopened.bytes.equals(bytes)) fail(`${basename} concurrent winner changed`);
      return Object.freeze({ path: fixedPath, bytes: reopened.bytes });
    }
  }
  const linked = readStableRegular(selected.path, { device, mode: expectedMode, linkCounts: [1, 2] });
  if (!linked.bytes.equals(bytes)) fail(`${basename} temporary changed across link`);
  unlinkStable(selected.path, linked, directory);
  for (const name of temps) {
    if (name === selected.name || !optionalLstat(path.join(directory, name))) continue;
    const tempPath = path.join(directory, name);
    const duplicate = readStableRegular(tempPath, { device, mode: expectedMode, linkCounts: [1] });
    if (!duplicate.bytes.equals(bytes)) fail(`${basename} duplicate changed during recovery`);
    unlinkStable(tempPath, duplicate, directory);
  }
  fsyncDirectory(directory);
  const reopened = readStableRegular(fixedPath, { device, mode: expectedMode, linkCounts: [1] });
  if (!reopened.bytes.equals(bytes)) fail(`${basename} final authority bytes changed`);
  return Object.freeze({ path: fixedPath, bytes: reopened.bytes });
}

function canonicalRecordBytes(value) {
  return Buffer.from(`${canonicalJsonV1(value)}\n`, "utf8");
}

function parseCanonicalRecord(file, expectedMode = 0o600, linkCounts = [1]) {
  const observed = readStableRegular(file, { mode: expectedMode, linkCounts });
  let value;
  try {
    value = JSON.parse(observed.bytes.toString("utf8"));
  } catch {
    fail(`${file} contains invalid JSON`);
  }
  if (!observed.bytes.equals(canonicalRecordBytes(value))) fail(`${file} is not canonical JSON plus LF`);
  return Object.freeze({ value, observed });
}

function parseCanonicalRecordBytesV1(bytes, label) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_AUTHORITY_BYTES_V1) fail(`${label} bytes are invalid`);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(`${label} contains invalid JSON`);
  }
  if (!bytes.equals(canonicalRecordBytes(value))) fail(`${label} is not canonical JSON plus LF`);
  return value;
}

function immutablePublisherFamiliesV1(directory, acceptsBasename) {
  const families = new Map();
  const temp = /^\.(.+)\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.tmp$/;
  for (const name of readdirSync(directory).sort(compareBytes)) {
    const match = temp.exec(name);
    const basename = match?.[1] ?? name;
    if (!acceptsBasename(basename) || (match && !publisherTempPattern(basename).test(name))) {
      fail(`unknown immutable publisher dirent ${name}`);
    }
    const family = families.get(basename) ?? { basename, fixed: null, temps: [] };
    if (match) family.temps.push(name);
    else if (family.fixed !== null) fail(`duplicate immutable publisher fixed name ${basename}`);
    else family.fixed = name;
    families.set(basename, family);
  }
  for (const family of families.values()) {
    if (family.temps.length > MAX_NO_REPLACE_PUBLISHER_TEMP_CANDIDATES_V1) fail("publisher temporary capacity exceeded");
  }
  return [...families.values()].sort((left, right) => compareBytes(left.basename, right.basename));
}

function inspectImmutablePublisherDirectoryV1(directory, acceptsBasename, validateBody, normalize = false) {
  const parent = directoryIdentity(directory);
  const device = BigInt(parent.devDecimal);
  const fixedNames = [];
  for (const family of immutablePublisherFamiliesV1(directory, acceptsBasename)) {
    const fixed = family.fixed === null ? null : readStableRegular(path.join(directory, family.fixed), {
      device, mode: 0o600, linkCounts: [1, 2], maxBytes: MAX_AUTHORITY_BYTES_V1,
    });
    if (fixed) validateBody(family.basename, parseCanonicalRecordBytesV1(fixed.bytes, family.basename));
    const temps = family.temps.map((name) => {
      const observed = readStableRegular(path.join(directory, name), {
        device, mode: 0o600, linkCounts: [1, 2], maxBytes: MAX_AUTHORITY_BYTES_V1,
      });
      let value = null;
      try {
        value = parseCanonicalRecordBytesV1(observed.bytes, name);
        validateBody(family.basename, value);
      } catch {
        value = null;
      }
      return Object.freeze({ name, observed, value });
    });
    if (fixed) {
      if (temps.some((entry) => entry.value === null || !entry.observed.bytes.equals(fixed.bytes))) {
        fail(`${family.basename} has an unequal publisher temporary`);
      }
      const plan = planNoReplacePublisherRecoveryV1({
        basename: family.basename,
        candidateBytes: fixed.bytes,
        entries: [
          { name: family.basename, observed: fixed },
          ...temps,
        ].map((entry) => ({
          name: entry.name,
          bytes: entry.observed.bytes,
          mode: entry.observed.mode,
          linkCount: Number(entry.observed.stats.nlink),
          devDecimal: entry.observed.stats.dev.toString(10),
          inoDecimal: entry.observed.stats.ino.toString(10),
        })),
      });
      if (plan.state === "block") fail(`${family.basename} publisher recovery shape is invalid: ${plan.reason}`);
      if (normalize && temps.length > 0) publishNoReplaceFileV1(directory, family.basename, fixed.bytes, 0o600);
      fixedNames.push(family.basename);
      continue;
    }
    const valid = temps.filter((entry) => entry.value !== null);
    const invalid = temps.filter((entry) => entry.value === null);
    if (invalid.length > 0) {
      if (!normalize || temps.length !== 1) fail(`${family.basename} has incomplete competing publisher state`);
      unlinkStable(path.join(directory, invalid[0].name), invalid[0].observed, directory);
      fsyncDirectory(directory);
      continue;
    }
    if (valid.length === 0) continue;
    if (valid.some((entry) => !entry.observed.bytes.equals(valid[0].observed.bytes))) fail(`${family.basename} has competing unpublished bodies`);
    const candidateBytes = fixed?.bytes ?? valid[0].observed.bytes;
    const observedEntries = [
      ...(fixed ? [{ name: family.basename, observed: fixed }] : []),
      ...valid,
    ].map((entry) => ({
      name: entry.name,
      bytes: entry.observed.bytes,
      mode: entry.observed.mode,
      linkCount: Number(entry.observed.stats.nlink),
      devDecimal: entry.observed.stats.dev.toString(10),
      inoDecimal: entry.observed.stats.ino.toString(10),
    }));
    const plan = planNoReplacePublisherRecoveryV1({ basename: family.basename, candidateBytes, entries: observedEntries });
    if (plan.state === "block") fail(`${family.basename} publisher recovery shape is invalid: ${plan.reason}`);
    if (normalize) {
      publishNoReplaceFileV1(directory, family.basename, candidateBytes, 0o600);
      fixedNames.push(family.basename);
    }
  }
  return Object.freeze(fixedNames.sort(compareBytes));
}

function parseProcessIdentityRow(bytes) {
  const text = bytes.toString("utf8");
  const match = /^([A-Z][a-z]{2} [A-Z][a-z]{2} (?: [1-9]|[12][0-9]|3[01]) [0-9]{2}:[0-9]{2}:[0-9]{2} [0-9]{4}) +([1-9][0-9]*)\n$/.exec(text);
  if (!match) return undefined;
  const processGroupId = Number(match[2]);
  if (!Number.isSafeInteger(processGroupId) || processGroupId < 1) return undefined;
  return Object.freeze({ processLstart: match[1], processGroupId });
}

function observeProcessIdentityV1(pid, expected) {
  if (!Number.isSafeInteger(pid) || pid < 1) return Object.freeze({ state: "ambiguous" });
  const result = spawnSync(PROCESS_IDENTITY_EXECUTABLE_V1, ["-p", String(pid), "-o", "lstart=", "-o", "pgid="], {
    shell: false,
    env: PROCESS_ENV_V1,
    timeout: PROCESS_IDENTITY_TIMEOUT_MS_V1,
    maxBuffer: PROCESS_IDENTITY_MAX_BUFFER_BYTES_V1,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? "");
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.from(result.stderr ?? "");
  if (!result.error && result.signal === null && result.status === 1 && stdout.length === 0 && stderr.length === 0) {
    return Object.freeze({ state: "definitely_dead" });
  }
  if (!result.error && result.signal === null && result.status === 0 && stderr.length === 0) {
    const identity = parseProcessIdentityRow(stdout);
    if (identity) {
      if (expected && (identity.processLstart !== expected.processLstart || identity.processGroupId !== expected.processGroupId)) {
        return Object.freeze({ state: "live_pid_reused", ...identity });
      }
      return Object.freeze({ state: "live_match", ...identity, observationHash: sha256(stdout) });
    }
  }
  return Object.freeze({ state: "ambiguous" });
}

function parseMaintenanceLock(file) {
  const { value, observed } = parseCanonicalRecord(file);
  if (
    !hasExactKeys(value, [
      "schema", "kind", "nonce", "pid", "processLstart", "processGroupId", "candidateKeyHash",
    ])
    || value.schema !== "setfarm.platform-build-generation-maintenance-lock.v1"
    || !["writer_prepare", "retention_prepare", "retention_resume"].includes(value.kind)
    || !UUID_V4.test(value.nonce)
    || !Number.isSafeInteger(value.pid) || value.pid < 1
    || typeof value.processLstart !== "string"
    || !Number.isSafeInteger(value.processGroupId) || value.processGroupId < 1
    || !SHA256.test(value.candidateKeyHash)
  ) fail("maintenance lock body is invalid");
  return Object.freeze({ value, observed });
}

function recoverMaintenanceLock(setfarm) {
  const pattern = publisherTempPattern(MAINTENANCE_LOCK_FILE);
  const family = readdirSync(setfarm)
    .filter((name) => name === MAINTENANCE_LOCK_FILE || name.startsWith(`.${MAINTENANCE_LOCK_FILE}.`))
    .sort(compareBytes);
  const temps = family.filter((name) => name !== MAINTENANCE_LOCK_FILE);
  if (temps.length > MAX_NO_REPLACE_PUBLISHER_TEMP_CANDIDATES_V1 || temps.some((name) => !pattern.test(name))) {
    fail("maintenance lock temporary state is invalid");
  }
  for (const name of family) {
    const file = path.join(setfarm, name);
    const parsed = parseMaintenanceLock(file);
    const owner = observeProcessIdentityV1(parsed.value.pid, parsed.value);
    if (["definitely_dead", "live_pid_reused"].includes(owner.state)) {
      unlinkStable(file, parsed.observed, setfarm);
      continue;
    }
    fail(`maintenance lock owner is ${owner.state}`, "BUILD_GENERATION_MAINTENANCE_LOCK_UNAVAILABLE");
  }
}

function publishMaintenanceLockV1(setfarm, value) {
  const basename = MAINTENANCE_LOCK_FILE;
  const fixedPath = path.join(setfarm, basename);
  const tempPath = path.join(setfarm, `.${basename}.${value.nonce}.tmp`);
  const bytes = canonicalRecordBytes(value);
  const parent = directoryIdentity(setfarm);
  const device = BigInt(parent.devDecimal);
  let descriptor;
  try {
    descriptor = openSync(tempPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  const created = readStableRegular(tempPath, { device, mode: 0o600, linkCounts: [1] });
  if (!created.bytes.equals(bytes)) fail("maintenance lock temporary bytes changed");
  try {
    linkSync(tempPath, fixedPath);
    fsyncDirectory(setfarm);
  } catch (error) {
    if (optionalLstat(tempPath)) {
      const own = readStableRegular(tempPath, { device, mode: 0o600, linkCounts: [1] });
      if (own.stats.ino !== created.stats.ino || !own.bytes.equals(bytes)) fail("maintenance lock losing temporary changed");
      unlinkStable(tempPath, own, setfarm);
    }
    if (error?.code !== "EEXIST") throw error;
    if (!optionalLstat(fixedPath)) fail("maintenance lock concurrent result is ambiguous", "BUILD_GENERATION_MAINTENANCE_LOCK_UNAVAILABLE");
    const winner = parseMaintenanceLock(fixedPath);
    const owner = observeProcessIdentityV1(winner.value.pid, winner.value);
    fail(`maintenance lock owner is ${owner.state}`, "BUILD_GENERATION_MAINTENANCE_LOCK_UNAVAILABLE");
  }
  const linked = readStableRegular(tempPath, { device, mode: 0o600, linkCounts: [2] });
  const fixed = readStableRegular(fixedPath, { device, mode: 0o600, linkCounts: [2] });
  if (linked.stats.ino !== fixed.stats.ino || linked.stats.ino !== created.stats.ino || !linked.bytes.equals(bytes) || !fixed.bytes.equals(bytes)) {
    fail("maintenance lock fixed-link identity changed");
  }
  unlinkStable(tempPath, linked, setfarm);
  const reopened = readStableRegular(fixedPath, { device, mode: 0o600, linkCounts: [1] });
  if (!reopened.bytes.equals(bytes)) fail("maintenance lock authority changed after publication");
  return Object.freeze({ value, bytes, file: fixedPath });
}

function acquireMaintenanceLock(setfarm, kind, candidateKeyHash) {
  recoverMaintenanceLock(setfarm);
  const identity = observeProcessIdentityV1(process.pid);
  if (identity.state !== "live_match") fail("current maintenance process identity is ambiguous");
  const value = Object.freeze({
    schema: "setfarm.platform-build-generation-maintenance-lock.v1",
    kind,
    nonce: randomUUID(),
    pid: process.pid,
    processLstart: identity.processLstart,
    processGroupId: identity.processGroupId,
    candidateKeyHash,
  });
  return publishMaintenanceLockV1(setfarm, value);
}

function releaseMaintenanceLock(setfarm, lock) {
  const parsed = parseMaintenanceLock(lock.file);
  if (!parsed.observed.bytes.equals(lock.bytes) || canonicalJsonV1(parsed.value) !== canonicalJsonV1(lock.value)) {
    fail("maintenance lock ownership changed before release");
  }
  if (parsed.value.pid !== process.pid || observeProcessIdentityV1(process.pid, parsed.value).state !== "live_match") {
    fail("maintenance lock process identity changed before release");
  }
  unlinkStable(lock.file, parsed.observed, setfarm);
}

function ensureAuthorityRoots(root) {
  const repository = directoryIdentity(root);
  const device = BigInt(repository.devDecimal);
  const setfarm = path.join(root, ".setfarm");
  if (!optionalLstat(setfarm)) ensureDirectory(setfarm, 0o700, root, device);
  else if (directoryIdentity(setfarm, device).mode !== 0o700) fail(".setfarm must have mode 0o700");
  const archive = path.join(root, ARCHIVE_DIRECTORY);
  if (!optionalLstat(archive)) ensureDirectory(archive, 0o700, setfarm, device);
  else if (directoryIdentity(archive, device).mode !== 0o700) fail("archive root must have mode 0o700");
  const ledger = path.join(root, ROTATION_LEDGER_DIRECTORY);
  if (!optionalLstat(ledger)) ensureDirectory(ledger, 0o700, setfarm, device);
  else if (directoryIdentity(ledger, device).mode !== 0o700) fail("rotation ledger must have mode 0o700");
  const directories = {};
  for (const kind of ["intents", "completions", "dispositions"]) {
    const target = path.join(ledger, kind);
    if (!optionalLstat(target)) ensureDirectory(target, 0o700, ledger, device);
    else if (directoryIdentity(target, device).mode !== 0o700) fail(`${kind} ledger must have mode 0o700`);
    directories[kind] = target;
  }
  return Object.freeze({ root, repository, device, setfarm, archive, ledger, ...directories });
}

function readAuthorityRootsV1(root) {
  const repository = directoryIdentity(root);
  const device = BigInt(repository.devDecimal);
  const setfarm = path.join(root, ".setfarm");
  const archive = path.join(root, ARCHIVE_DIRECTORY);
  const ledger = path.join(root, ROTATION_LEDGER_DIRECTORY);
  const intents = path.join(ledger, "intents");
  const completions = path.join(ledger, "completions");
  const dispositions = path.join(ledger, "dispositions");
  for (const [directory, expectedMode, label] of [
    [setfarm, 0o700, ".setfarm"],
    [archive, 0o700, "archive root"],
    [ledger, 0o700, "rotation ledger"],
    [intents, 0o700, "rotation intents"],
    [completions, 0o700, "rotation completions"],
    [dispositions, 0o700, "rotation dispositions"],
  ]) {
    if (!optionalLstat(directory) || directoryIdentity(directory, device).mode !== expectedMode) fail(`${label} is missing or invalid`);
  }
  return Object.freeze({ root, repository, device, setfarm, archive, ledger, intents, completions, dispositions });
}

function canonicalRelativeLocator(locator) {
  if (!locator || locator.startsWith("/") || locator.includes("\\") || locator !== locator.normalize("NFC")) fail("inventory locator is not canonical");
  const segments = locator.split("/");
  if (segments.length > MAX_TREE_DEPTH_V1 || segments.some((part) => !part || part === "." || part === "..")) fail("inventory locator is invalid");
  return locator;
}

function inventoryBuildGenerationV1(root) {
  const rootIdentity = directoryIdentity(root);
  const device = BigInt(rootIdentity.devDecimal);
  const entries = [];
  let count = 0;
  let total = 0;
  function visit(directory, relative, depth) {
    if (depth > MAX_TREE_DEPTH_V1) fail("generation exceeds the depth cap");
    for (const name of readdirSync(directory).sort(compareBytes)) {
      count += 1;
      if (count > MAX_TREE_ENTRIES_V1) fail("generation exceeds the entry cap");
      const locator = canonicalRelativeLocator(relative ? `${relative}/${name}` : name);
      const target = path.join(directory, name);
      const stats = lstatSync(target, { bigint: true });
      if (stats.dev !== device || stats.isSymbolicLink()) fail(`invalid generation member ${locator}`);
      const linkCount = Number(stats.nlink);
      if (!Number.isSafeInteger(linkCount) || linkCount < 1) fail(`invalid generation link count ${locator}`);
      if (stats.isDirectory()) {
        entries.push(Object.freeze({
          locator, kind: "directory", devDecimal: stats.dev.toString(10), inoDecimal: stats.ino.toString(10),
          mode: modeOf(stats), linkCount, byteLength: null, sha256: null,
        }));
        visit(target, locator, depth + 1);
      } else if (stats.isFile()) {
        if (stats.nlink !== 1n || stats.size > BigInt(MAX_FILE_BYTES_V1)) fail(`invalid generation regular file ${locator}`);
        const observed = readStableRegular(target, { device, linkCounts: [1], maxBytes: MAX_FILE_BYTES_V1 });
        total += observed.bytes.length;
        if (total > MAX_TOTAL_BYTES_V1) fail("generation exceeds the byte cap");
        entries.push(Object.freeze({
          locator, kind: "regular_file", devDecimal: stats.dev.toString(10), inoDecimal: stats.ino.toString(10),
          mode: observed.mode, linkCount: 1, byteLength: observed.bytes.length, sha256: sha256(observed.bytes),
        }));
      } else fail(`special generation member ${locator}`);
    }
  }
  visit(root, "", 0);
  entries.sort((left, right) => compareBytes(left.locator, right.locator));
  const rootPhysicalIdentity = Object.freeze({
    devDecimal: rootIdentity.devDecimal,
    inoDecimal: rootIdentity.inoDecimal,
    mode: rootIdentity.mode,
    linkCount: rootIdentity.linkCount,
  });
  const common = {
    schema: "setfarm.platform-build-generation-inventory.v1",
    entryCount: entries.length,
    regularFileByteCount: total,
  };
  const physicalEntries = entries.map(({ sha256: ignored, ...entry }) => entry);
  const contentEntries = entries.map(({ locator, kind, mode, byteLength, sha256: digest }) => ({ locator, kind, mode, byteLength, sha256: digest }));
  return Object.freeze({
    schema: common.schema,
    rootPhysicalIdentity,
    entryCount: common.entryCount,
    regularFileByteCount: common.regularFileByteCount,
    entries: Object.freeze(entries),
    physicalInventoryHash: hashCanonicalJsonV1({ ...common, rootPhysicalIdentity, entries: physicalEntries }),
    contentInventoryHash: hashCanonicalJsonV1({ ...common, entries: contentEntries }),
  });
}

function assertCanonicalUnsignedDecimalV1(value, label) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value)) fail(`${label} is not canonical unsigned decimal`);
}

function assertModeV1(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0o7777) fail(`${label} mode is invalid`);
}

function assertDirectoryIdentityBodyV1(value, label, includeRealpath = true) {
  const keys = includeRealpath
    ? ["realpath", "devDecimal", "inoDecimal", "mode", "linkCount"]
    : ["devDecimal", "inoDecimal", "mode", "linkCount"];
  if (!value || !hasExactKeys(value, keys)) fail(`${label} identity shape is invalid`);
  if (includeRealpath && (typeof value.realpath !== "string" || !path.isAbsolute(value.realpath) || value.realpath.includes("\0"))) fail(`${label} realpath is invalid`);
  assertCanonicalUnsignedDecimalV1(value.devDecimal, `${label} device`);
  assertCanonicalUnsignedDecimalV1(value.inoDecimal, `${label} inode`);
  assertModeV1(value.mode, label);
  if (!Number.isSafeInteger(value.linkCount) || value.linkCount < 1) fail(`${label} link count is invalid`);
}

function assertRecordPairV1(value, kind, nullable = false) {
  if (nullable && value === null) return;
  const refKey = `${kind}Ref`;
  const hashKey = `${kind}Hash`;
  if (!value || !hasExactKeys(value, [refKey, hashKey]) || typeof value[refKey] !== "string" || !SHA256.test(value[hashKey])) {
    fail(`${kind} pair is invalid`);
  }
  const hash = value[hashKey];
  const exactRef = kind === "operation"
    ? `setfarm://internal-production/build-generation-retention-operation/sha256/${hash}`
    : kind === "receipt"
      ? `setfarm://internal-production/build-generation-retention-receipt/sha256/${hash}`
      : kind === "deliveryEvidence"
        ? `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${hash}`
        : kind === "eraseStepIntent" || kind === "eraseStepCompletion"
          ? `setfarm://internal-production/build-generation-retention-erase-step-${kind === "eraseStepIntent" ? "intent" : "completion"}/sha256/${hash}`
          : null;
  if (exactRef !== null) {
    if (value[refKey] !== exactRef) fail(`${kind} pair reference domain is invalid`);
    return;
  }
  if (kind === "intent" || kind === "completion") {
    const pattern = new RegExp(`^setfarm://internal-production/build-generation-rotation-${kind}/[0-9]{20}/${UUID_V4.source.slice(1, -1)}/sha256/${hash}$`);
    if (!pattern.test(value[refKey])) fail(`${kind} pair reference domain is invalid`);
    return;
  }
  fail(`${kind} pair kind is invalid`);
}

function assertInventoryBodyV1(value, label = "build-generation inventory") {
  if (!value || !hasExactKeys(value, [
    "schema", "rootPhysicalIdentity", "entryCount", "regularFileByteCount", "entries", "physicalInventoryHash", "contentInventoryHash",
  ]) || value.schema !== "setfarm.platform-build-generation-inventory.v1") fail(`${label} shape is invalid`);
  assertDirectoryIdentityBodyV1(value.rootPhysicalIdentity, `${label} root`, false);
  if (!Number.isSafeInteger(value.entryCount) || value.entryCount < 0 || value.entryCount > MAX_TREE_ENTRIES_V1 || !Array.isArray(value.entries) || value.entries.length !== value.entryCount) {
    fail(`${label} entry count is invalid`);
  }
  if (!Number.isSafeInteger(value.regularFileByteCount) || value.regularFileByteCount < 0 || value.regularFileByteCount > MAX_TOTAL_BYTES_V1) fail(`${label} byte count is invalid`);
  let prior = null;
  let regularBytes = 0;
  const physicalEntries = [];
  const contentEntries = [];
  for (const entry of value.entries) {
    if (!entry || !hasExactKeys(entry, ["locator", "kind", "devDecimal", "inoDecimal", "mode", "linkCount", "byteLength", "sha256"])) fail(`${label} entry shape is invalid`);
    canonicalRelativeLocator(entry.locator);
    if (prior !== null && compareBytes(prior, entry.locator) >= 0) fail(`${label} entries are not unique global byte order`);
    prior = entry.locator;
    if (!['regular_file', 'directory'].includes(entry.kind)) fail(`${label} entry kind is invalid`);
    assertCanonicalUnsignedDecimalV1(entry.devDecimal, `${label} entry device`);
    assertCanonicalUnsignedDecimalV1(entry.inoDecimal, `${label} entry inode`);
    assertModeV1(entry.mode, `${label} entry`);
    if (!Number.isSafeInteger(entry.linkCount) || entry.linkCount < 1) fail(`${label} entry link count is invalid`);
    if (entry.kind === "regular_file") {
      if (entry.linkCount !== 1 || !Number.isSafeInteger(entry.byteLength) || entry.byteLength < 0 || entry.byteLength > MAX_FILE_BYTES_V1 || !SHA256.test(entry.sha256)) fail(`${label} file entry is invalid`);
      regularBytes += entry.byteLength;
    } else if (entry.byteLength !== null || entry.sha256 !== null) fail(`${label} directory entry is invalid`);
    const { sha256: ignored, ...physicalEntry } = entry;
    physicalEntries.push(physicalEntry);
    contentEntries.push({ locator: entry.locator, kind: entry.kind, mode: entry.mode, byteLength: entry.byteLength, sha256: entry.sha256 });
  }
  if (regularBytes !== value.regularFileByteCount) fail(`${label} regular byte sum is invalid`);
  const common = { schema: value.schema, entryCount: value.entryCount, regularFileByteCount: value.regularFileByteCount };
  if (
    value.physicalInventoryHash !== hashCanonicalJsonV1({ ...common, rootPhysicalIdentity: value.rootPhysicalIdentity, entries: physicalEntries })
    || value.contentInventoryHash !== hashCanonicalJsonV1({ ...common, entries: contentEntries })
  ) fail(`${label} hashes are invalid`);
}

function pairOf(record, kind) {
  return Object.freeze({ [`${kind}Ref`]: record[`${kind}Ref`], [`${kind}Hash`]: record[`${kind}Hash`] });
}

function recordName(ordinal, buildId) {
  return `${String(ordinal).padStart(20, "0")}-${buildId}.json`;
}

function recordRef(kind, ordinal, buildId, digest) {
  return `setfarm://internal-production/build-generation-rotation-${kind}/${String(ordinal).padStart(20, "0")}/${buildId}/sha256/${digest}`;
}

function publishRotationRecord(directory, kind, projection) {
  const digest = hashCanonicalJsonV1(projection);
  const value = Object.freeze({ ...projection, [`${kind}Ref`]: recordRef(kind, projection.ordinal, projection.buildId, digest), [`${kind}Hash`]: digest });
  publishNoReplaceFileV1(directory, recordName(projection.ordinal, projection.buildId), canonicalRecordBytes(value), 0o600);
  return value;
}

function assertRotationRecordBodyV1(value, kind, filename) {
  const name = RECORD_NAME.exec(filename);
  if (!name) fail(`invalid ${kind} record filename ${filename}`);
  const ordinal = Number(name[1]);
  const buildId = name[2];
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > MAX_LEDGER_ORDINALS_V1 || !UUID_V4.test(buildId)) fail(`invalid ${kind} filename fields`);
  const refKey = `${kind}Ref`;
  const hashKey = `${kind}Hash`;
  const projection = { ...value };
  delete projection[refKey];
  delete projection[hashKey];
  const digest = hashCanonicalJsonV1(projection);
  if (
    value.ordinal !== ordinal || value.buildId !== buildId || value[hashKey] !== digest
    || value[refKey] !== recordRef(kind, ordinal, buildId, digest)
  ) fail(`${kind} record pair/body/filename mismatch`);
  if (kind === "intent") {
    if (!hasExactKeys(value, [
      "schema", "ordinal", "buildId", "predecessorCompletion", "sourceParentIdentity", "destinationParentIdentity",
      "sourceLocator", "destinationLocator", "inventory", "rotationControllerSource", "intentRef", "intentHash",
    ]) || value.schema !== "setfarm.platform-build-generation-rotation-intent.v1") fail("rotation intent shape is invalid");
    assertRecordPairV1(value.predecessorCompletion, "completion", true);
    assertDirectoryIdentityBodyV1(value.sourceParentIdentity, "rotation source parent");
    assertDirectoryIdentityBodyV1(value.destinationParentIdentity, "rotation destination parent");
    if (value.sourceLocator !== "dist" || value.destinationLocator !== `${ARCHIVE_DIRECTORY}/${buildId}.dist`) fail("rotation intent locator is invalid");
    assertInventoryBodyV1(value.inventory, "rotation intent inventory");
    assertRotationControllerSource(value.rotationControllerSource);
  } else if (kind === "completion") {
    if (!hasExactKeys(value, [
      "schema", "ordinal", "buildId", "predecessorCompletion", "intent", "sourceParentIdentity", "destinationParentIdentity",
      "archiveLocator", "archiveIdentity", "inventory", "rotationControllerSource", "completionRef", "completionHash",
    ]) || value.schema !== "setfarm.platform-build-generation-rotation-completion.v1") fail("rotation completion shape is invalid");
    assertRecordPairV1(value.predecessorCompletion, "completion", true);
    assertRecordPairV1(value.intent, "intent");
    assertDirectoryIdentityBodyV1(value.sourceParentIdentity, "rotation completion source parent");
    assertDirectoryIdentityBodyV1(value.destinationParentIdentity, "rotation completion destination parent");
    assertDirectoryIdentityBodyV1(value.archiveIdentity, "rotation completion archive");
    if (value.archiveLocator !== `${ARCHIVE_DIRECTORY}/${buildId}.dist`) fail("rotation completion locator is invalid");
    assertInventoryBodyV1(value.inventory, "rotation completion inventory");
    assertRotationControllerSource(value.rotationControllerSource);
  } else if (kind === "disposition") {
    if (!hasExactKeys(value, [
      "schema", "ordinal", "buildId", "completion", "retentionOperation", "retentionReceipt", "sourceAbsent",
      "quarantineLocator", "disposedRootPhysicalIdentity", "physicalInventoryHash", "contentInventoryHash",
      "permanentDisposition", "quarantineAbsent", "dispositionRef", "dispositionHash",
    ]) || value.schema !== "setfarm.platform-build-generation-rotation-disposition.v1") fail("rotation disposition shape is invalid");
    assertRecordPairV1(value.completion, "completion");
    assertRecordPairV1(value.retentionOperation, "operation");
    assertRecordPairV1(value.retentionReceipt, "receipt");
    assertDirectoryIdentityBodyV1(value.disposedRootPhysicalIdentity, "disposed root", false);
    if (!SHA256.test(value.physicalInventoryHash) || !SHA256.test(value.contentInventoryHash) || value.sourceAbsent !== true || value.permanentDisposition !== true || value.quarantineAbsent !== true) {
      fail("rotation disposition terminal fields are invalid");
    }
  } else fail("rotation record kind is invalid");
  return value;
}

function parseRotationRecord(file, kind, filename) {
  return assertRotationRecordBodyV1(parseCanonicalRecord(file, 0o600, [1, 2]).value, kind, filename);
}

function scanRotationLedgerFromRoots(roots, options = {}) {
  const readKind = (kind) => {
    const directory = roots[`${kind}s`];
    const names = inspectImmutablePublisherDirectoryV1(
      directory,
      (name) => RECORD_NAME.test(name),
      (name, value) => assertRotationRecordBodyV1(value, kind, name),
      options.recoverPublisherTemps === true,
    );
    if (names.length > MAX_LEDGER_ORDINALS_V1) fail("rotation ledger capacity exceeded", "BUILD_GENERATION_ROTATION_LEDGER_CAPACITY_REQUIRED");
    return names.map((name) => parseRotationRecord(path.join(directory, name), kind, name));
  };
  const intents = readKind("intent");
  const completions = readKind("completion");
  const dispositions = readKind("disposition");
  const intentByOrdinal = new Map();
  const completionByOrdinal = new Map();
  const dispositionByOrdinal = new Map();
  for (const value of intents) {
    if (intentByOrdinal.has(value.ordinal)) fail("rotation intent fork");
    intentByOrdinal.set(value.ordinal, value);
  }
  for (const value of completions) {
    if (completionByOrdinal.has(value.ordinal)) fail("rotation completion fork");
    completionByOrdinal.set(value.ordinal, value);
  }
  for (const value of dispositions) {
    if (dispositionByOrdinal.has(value.ordinal)) fail("rotation disposition fork");
    dispositionByOrdinal.set(value.ordinal, value);
  }
  const maxOrdinal = Math.max(0, ...intentByOrdinal.keys(), ...completionByOrdinal.keys());
  if (maxOrdinal > MAX_LEDGER_ORDINALS_V1) fail("rotation ledger capacity exceeded", "BUILD_GENERATION_ROTATION_LEDGER_CAPACITY_REQUIRED");
  let predecessor = null;
  let danglingIntent = null;
  const active = [];
  for (let ordinal = 1; ordinal <= maxOrdinal; ordinal += 1) {
    const intent = intentByOrdinal.get(ordinal);
    const completion = completionByOrdinal.get(ordinal);
    if (!intent) fail(`rotation ledger gap at ordinal ${ordinal}`);
    if (canonicalJsonV1(intent.predecessorCompletion) !== canonicalJsonV1(predecessor)) fail(`rotation predecessor mismatch at ordinal ${ordinal}`);
    if (!completion) {
      if (ordinal !== maxOrdinal) fail("nonterminal dangling rotation intent");
      danglingIntent = intent;
      break;
    }
    if (
      completion.schema !== "setfarm.platform-build-generation-rotation-completion.v1"
      || canonicalJsonV1(completion.predecessorCompletion) !== canonicalJsonV1(predecessor)
      || canonicalJsonV1(completion.intent) !== canonicalJsonV1(pairOf(intent, "intent"))
      || completion.archiveLocator !== intent.destinationLocator
      || completion.ordinal !== intent.ordinal || completion.buildId !== intent.buildId
      || canonicalJsonV1(completion.sourceParentIdentity) !== canonicalJsonV1(intent.sourceParentIdentity)
      || canonicalJsonV1(completion.destinationParentIdentity) !== canonicalJsonV1(intent.destinationParentIdentity)
      || canonicalJsonV1(completion.inventory) !== canonicalJsonV1(intent.inventory)
      || canonicalJsonV1(completion.rotationControllerSource) !== canonicalJsonV1(intent.rotationControllerSource)
      || canonicalJsonV1(completion.archiveIdentity) !== canonicalJsonV1({
        realpath: path.join(roots.root, completion.archiveLocator),
        ...completion.inventory.rootPhysicalIdentity,
      })
    ) fail(`rotation completion mismatch at ordinal ${ordinal}`);
    predecessor = pairOf(completion, "completion");
    const disposition = dispositionByOrdinal.get(ordinal);
    if (disposition && (
      disposition.schema !== "setfarm.platform-build-generation-rotation-disposition.v1"
      || disposition.ordinal !== completion.ordinal || disposition.buildId !== completion.buildId
      || canonicalJsonV1(disposition.completion) !== canonicalJsonV1(pairOf(completion, "completion"))
      || !disposition.retentionOperation || !SHA256.test(disposition.retentionOperation.operationHash)
      || !disposition.retentionReceipt || !SHA256.test(disposition.retentionReceipt.receiptHash)
      || disposition.sourceAbsent !== true || disposition.permanentDisposition !== true || disposition.quarantineAbsent !== true
      || canonicalJsonV1(disposition.disposedRootPhysicalIdentity) !== canonicalJsonV1(completion.inventory.rootPhysicalIdentity)
      || disposition.physicalInventoryHash !== completion.inventory.physicalInventoryHash
      || disposition.contentInventoryHash !== completion.inventory.contentInventoryHash
    )) fail(`rotation disposition mismatch at ordinal ${ordinal}`);
    active.push(Object.freeze({ ordinal, intent, completion, disposition: disposition ?? null }));
  }
  for (const ordinal of dispositionByOrdinal.keys()) if (!completionByOrdinal.has(ordinal)) fail("disposition lacks completion");
  const archives = readdirSync(roots.archive).sort(compareBytes);
  for (const name of archives) {
    const match = ARCHIVE_NAME.exec(name);
    if (!match) fail(`invalid archive ${name}`);
    const generation = active.find((entry) => entry.completion.buildId === match[1]);
    const danglingDestination = danglingIntent?.destinationLocator === `${ARCHIVE_DIRECTORY}/${name}`;
    if ((!generation && !danglingDestination) || generation?.disposition) fail(`unindexed or disposed archive ${name}`);
  }
  for (const generation of active) {
    const archivePath = path.join(roots.root, generation.completion.archiveLocator);
    const present = optionalLstat(archivePath);
    const authorizedTransientAbsence = !present && !generation.disposition
      && options.allowAbsentCompletionPair
      && canonicalJsonV1(pairOf(generation.completion, "completion")) === canonicalJsonV1(options.allowAbsentCompletionPair);
    if ((present && generation.disposition) || (!present && !generation.disposition && !authorizedTransientAbsence)) fail(`archive/disposition mismatch at ordinal ${generation.ordinal}`);
    if (present && !generation.disposition) {
      const identity = directoryIdentity(archivePath, roots.device);
      if (!sameDirectoryObject(identity, generation.completion.archiveIdentity)) fail(`active archive identity mismatch at ordinal ${generation.ordinal}`);
      const inventory = inventoryBuildGenerationV1(archivePath);
      if (canonicalJsonV1(inventory) !== canonicalJsonV1(generation.completion.inventory)) fail(`active archive inventory mismatch at ordinal ${generation.ordinal}`);
    }
    if (generation.disposition && options.deferDisposedClosure !== true) resolveDisposedGenerationClosureV1(roots, generation);
  }
  return Object.freeze({
    schema: "setfarm.platform-build-generation-rotation-ledger-inspection.v1",
    completionTip: predecessor,
    danglingIntent,
    generations: Object.freeze(active),
  });
}

export function inspectBuildGenerationRotationLedgerV1() {
  const root = repositoryRootV1();
  const ledger = path.join(root, ROTATION_LEDGER_DIRECTORY);
  const archive = path.join(root, ARCHIVE_DIRECTORY);
  if (!optionalLstat(ledger)) {
    if (optionalLstat(archive) && readdirSync(archive).length !== 0) fail("legacy unindexed archive blocks rotation");
    return Object.freeze({
      schema: "setfarm.platform-build-generation-rotation-ledger-inspection.v1",
      completionTip: null,
      danglingIntent: null,
      generations: Object.freeze([]),
    });
  }
  const roots = {
    root,
    archive,
    ledger,
    intents: path.join(ledger, "intents"),
    completions: path.join(ledger, "completions"),
    dispositions: path.join(ledger, "dispositions"),
  };
  for (const directory of [archive, ledger, roots.intents, roots.completions, roots.dispositions]) {
    if (!optionalLstat(directory)) fail(`rotation authority directory missing: ${directory}`);
  }
  return scanRotationLedgerFromRoots(roots);
}

function existingRetentionStoreDirectoriesV1() {
  if (!optionalLstat(RETENTION_STORE_ROOT_V1)) return null;
  if (directoryIdentity(RETENTION_STORE_ROOT_V1).mode !== 0o700) fail("retention store must have mode 0o700");
  const directories = { root: RETENTION_STORE_ROOT_V1 };
  for (const [name, locator] of [
    ["operations", "operations"],
    ["operationCandidates", "operation-candidates"],
    ["eraseSteps", "erase-steps"],
    ["receipts", "receipts"],
  ]) {
    const outer = path.join(RETENTION_STORE_ROOT_V1, locator);
    const content = path.join(outer, "sha256");
    if (!optionalLstat(outer) || !optionalLstat(content) || directoryIdentity(outer).mode !== 0o700 || directoryIdentity(content).mode !== 0o700) {
      fail(`retention store ${locator}/sha256 is missing or invalid`);
    }
    directories[name] = content;
  }
  return Object.freeze(directories);
}

function inspectMaintenanceLockV1(setfarm) {
  if (!optionalLstat(setfarm)) return Object.freeze([]);
  const family = readdirSync(setfarm)
    .filter((name) => name === MAINTENANCE_LOCK_FILE || name.startsWith(`.${MAINTENANCE_LOCK_FILE}.`))
    .sort(compareBytes);
  const pattern = publisherTempPattern(MAINTENANCE_LOCK_FILE);
  if (
    family.filter((name) => name !== MAINTENANCE_LOCK_FILE).length > MAX_NO_REPLACE_PUBLISHER_TEMP_CANDIDATES_V1
    || family.some((name) => name !== MAINTENANCE_LOCK_FILE && !pattern.test(name))
  ) fail("maintenance lock inspection shape is invalid");
  return Object.freeze(family.map((name) => {
    const parsed = parseMaintenanceLock(path.join(setfarm, name));
    return Object.freeze({ name, body: parsed.value, owner: observeProcessIdentityV1(parsed.value.pid, parsed.value) });
  }));
}

export function inspectBuildGenerationRetentionV1() {
  const root = repositoryRootV1();
  const ledgerRoot = path.join(root, ROTATION_LEDGER_DIRECTORY);
  const archive = path.join(root, ARCHIVE_DIRECTORY);
  const setfarm = path.join(root, ".setfarm");
  const stores = existingRetentionStoreDirectoriesV1();
  const operations = [];
  const operationIndexes = [];
  const receipts = [];
  if (stores) {
    const operationNames = inspectImmutablePublisherDirectoryV1(stores.operations, (name) => /^[0-9a-f]{64}\.json$/.test(name), (name, value) => {
      const operation = parseRetentionOperationV1OrV2(value);
      if (name !== `${operation.operationHash}.json`) fail("retention operation inspection filename mismatch");
    });
    const candidateNames = inspectImmutablePublisherDirectoryV1(stores.operationCandidates, (name) => /^[0-9a-f]{64}\.json$/.test(name), (name, value) => assertCandidateIndexBodyV1(value, name));
    inspectImmutablePublisherDirectoryV1(stores.eraseSteps, (name) => /^[0-9a-f]{64}\.json$/.test(name), (name, value) => assertEraseStoreBodyV1(value, name));
    const receiptNames = inspectImmutablePublisherDirectoryV1(stores.receipts, (name) => /^[0-9a-f]{64}\.json$/.test(name), (name, value) => assertReceiptPublisherBodyV1(value, name));
    for (const name of operationNames) {
      const match = /^([0-9a-f]{64})\.json$/.exec(name);
      if (!match) fail("retention operation store has an invalid dirent");
      const operation = parseRetentionOperationV1OrV2(parseCanonicalRecord(path.join(stores.operations, name), 0o600, [1, 2]).value);
      if (operation.operationHash !== match[1]) fail("retention operation inspection filename mismatch");
      operations.push(operation);
    }
    for (const operation of operations) {
      const candidateFile = path.join(stores.operationCandidates, candidateIndexNameV1(operation.operationCore.candidateCompletion));
      if (!optionalLstat(candidateFile)) fail("retention operation lacks its candidate index");
      const index = parseCanonicalRecord(candidateFile, 0o600, [1, 2]).value;
      assertCandidateIndexBodyV1(index, path.basename(candidateFile));
      if (canonicalJsonV1(index.candidateCompletion) !== canonicalJsonV1(operation.operationCore.candidateCompletion)) fail("retention candidate index completion crossed");
      if (canonicalJsonV1(index.operation) !== canonicalJsonV1(operationPairV1(operation))) fail("retention operation candidate index crossed");
      operationIndexes.push(index);
    }
    const expectedCandidateNames = new Set(operations.map((operation) => candidateIndexNameV1(operation.operationCore.candidateCompletion)));
    for (const name of candidateNames) if (!expectedCandidateNames.has(name)) fail("retention candidate index lacks an operation");
    for (const name of receiptNames) {
      const match = /^([0-9a-f]{64})\.json$/.exec(name);
      if (!match) fail("retention receipt store has an invalid dirent");
      const value = parseCanonicalRecord(path.join(stores.receipts, name), 0o600, [1, 2]).value;
      assertReceiptPublisherBodyV1(value, name);
      const projection = { ...value };
      delete projection.receiptRef;
      delete projection.receiptHash;
      if (value.receiptHash !== match[1] || value.receiptHash !== hashCanonicalJsonV1(projection) || value.receiptRef !== receiptRefV1(value.receiptHash)) {
        fail("retention receipt inspection mismatch");
      }
      receipts.push(value);
    }
  }
  let rotation;
  if (!optionalLstat(ledgerRoot)) {
    rotation = inspectBuildGenerationRotationLedgerV1();
  } else {
    const roots = { root, archive, ledger: ledgerRoot, intents: path.join(ledgerRoot, "intents"), completions: path.join(ledgerRoot, "completions"), dispositions: path.join(ledgerRoot, "dispositions") };
    const candidates = operations.length > 0 ? operations.map((operation) => operation.operationCore.candidateCompletion) : [null];
    let firstError;
    for (const candidate of candidates) {
      try {
        rotation = scanRotationLedgerFromRoots(roots, candidate ? { allowAbsentCompletionPair: candidate } : {});
        break;
      } catch (error) {
        firstError ??= error;
      }
    }
    if (!rotation) throw firstError;
  }
  const quarantineRoot = path.join(root, QUARANTINE_DIRECTORY_V1);
  let quarantine = Object.freeze([]);
  if (optionalLstat(quarantineRoot)) {
    if (directoryIdentity(quarantineRoot).mode !== 0o700) fail("quarantine root must have mode 0o700");
    const children = readdirSync(quarantineRoot).sort(compareBytes);
    if (children.length > MAX_QUARANTINED_GENERATIONS_V1 || children.some((name) => !/^[0-9a-f]{64}\.dist$/.test(name))) fail("quarantine inspection shape is invalid");
    quarantine = Object.freeze(children);
  }
  return Object.freeze({
    schema: "setfarm.platform-build-generation-retention-inspection.v1",
    rotation,
    maintenanceLocks: inspectMaintenanceLockV1(setfarm),
    operations: Object.freeze(operations.map(operationPairV1)),
    operationIndexes: Object.freeze(operationIndexes),
    receipts: Object.freeze(receipts.map((receipt) => ({ receiptRef: receipt.receiptRef, receiptHash: receipt.receiptHash }))),
    quarantine,
  });
}

function ensureRetentionStoreV1() {
  const parent = path.dirname(RETENTION_STORE_ROOT_V1);
  const dataRoot = path.dirname(parent);
  const dataRootIdentity = directoryIdentity(dataRoot);
  if (dataRootIdentity.mode !== 0o700) fail("retention authority data root must have mode 0o700");
  const device = BigInt(dataRootIdentity.devDecimal);
  const parentIdentity = !optionalLstat(parent)
    ? ensureDirectory(parent, 0o700, dataRoot, device)
    : directoryIdentity(parent, device);
  if (parentIdentity.mode !== 0o700) fail("retention authority parent must have mode 0o700");
  fsyncDirectory(dataRoot);
  const dataRootAfter = directoryIdentity(dataRoot, device);
  const parentAfter = directoryIdentity(parent, device);
  if (!sameDirectoryObject(dataRootIdentity, dataRootAfter) || !sameDirectoryIdentity(parentIdentity, parentAfter)) {
    fail("retention authority parent changed while adopting it");
  }
  if (!optionalLstat(RETENTION_STORE_ROOT_V1)) ensureDirectory(RETENTION_STORE_ROOT_V1, 0o700, parent, device);
  else if (directoryIdentity(RETENTION_STORE_ROOT_V1, device).mode !== 0o700) fail("retention store must have mode 0o700");
  const directories = { root: RETENTION_STORE_ROOT_V1 };
  for (const [name, locator] of [
    ["operations", "operations"],
    ["operationCandidates", "operation-candidates"],
    ["eraseSteps", "erase-steps"],
    ["receipts", "receipts"],
  ]) {
    const outer = path.join(RETENTION_STORE_ROOT_V1, locator);
    if (!optionalLstat(outer)) ensureDirectory(outer, 0o700, RETENTION_STORE_ROOT_V1, device);
    else if (directoryIdentity(outer, device).mode !== 0o700) fail(`${locator} store must have mode 0o700`);
    const content = path.join(outer, "sha256");
    if (!optionalLstat(content)) ensureDirectory(content, 0o700, outer, device);
    else if (directoryIdentity(content, device).mode !== 0o700) fail(`${locator}/sha256 store must have mode 0o700`);
    directories[name] = content;
  }
  return Object.freeze(directories);
}

function fixedChildResult(executable, argv, options = {}) {
  return spawnSync(executable, argv, {
    shell: false,
    cwd: options.cwd,
    env: PROCESS_ENV_V1,
    timeout: options.timeout ?? RUNTIME_OBSERVER_TIMEOUT_MS_V1,
    maxBuffer: options.maxBuffer ?? RUNTIME_OBSERVER_MAX_BUFFER_BYTES_V1,
    input: options.input,
    stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
}

function requireSuccessfulChild(result, purpose) {
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.from(result.stderr ?? "");
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? "");
  if (result.error || result.signal !== null || result.status !== 0 || stderr.length !== 0) {
    const detail = stderr.length > 0 ? `: ${stderr.toString("utf8").trim()}` : "";
    fail(`${purpose} failed${detail}`);
  }
  return stdout;
}

function parseCanonicalChildJsonLine(bytes, purpose) {
  if (bytes.length === 0 || bytes.length > MAX_AUTHORITY_BYTES_V1 || bytes[bytes.length - 1] !== 0x0a) fail(`${purpose} output is invalid`);
  let value;
  try {
    value = JSON.parse(bytes.subarray(0, bytes.length - 1).toString("utf8"));
  } catch {
    fail(`${purpose} output is not JSON`);
  }
  if (!bytes.equals(Buffer.from(`${JSON.stringify(value)}\n`, "utf8"))) fail(`${purpose} output is not one compact JSON line`);
  return value;
}

function parsePlutilJsonV1(bytes, purpose) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 2 || bytes.length > MAX_AUTHORITY_BYTES_V1 || bytes.includes(0) || bytes.includes(0x0a) || bytes.includes(0x0d)) {
    fail(`${purpose} output bytes are invalid`);
  }
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { fail(`${purpose} output is not strict UTF-8`); }
  if (!Buffer.from(text, "utf8").equals(bytes) || text[0] !== "{" || text.at(-1) !== "}") fail(`${purpose} output shape is invalid`);
  let value;
  try { value = JSON.parse(text); } catch { fail(`${purpose} output is not JSON`); }
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) fail(`${purpose} output root is invalid`);
  return value;
}

function fixedGitResultV2(root, argv) {
  return spawnSync("/usr/bin/git", [...GIT_PREFIX_V2, ...argv], {
    shell: false,
    cwd: root,
    env: GIT_ENV_V2,
    timeout: RUNTIME_OBSERVER_TIMEOUT_MS_V1,
    maxBuffer: RUNTIME_OBSERVER_MAX_BUFFER_BYTES_V1,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function requireFixedGitBlobV2(root, blobHash, purpose) {
  if (!GIT_HASH.test(blobHash)) fail(`${purpose} object hash is invalid`);
  const bytes = requireSuccessfulChild(spawnSync("/usr/bin/git", [...GIT_PREFIX_V2, "cat-file", "blob", blobHash], {
    shell: false,
    cwd: root,
    env: GIT_ENV_V2,
    timeout: RUNTIME_OBSERVER_TIMEOUT_MS_V1,
    maxBuffer: MAX_FILE_BYTES_V1,
    stdio: ["ignore", "pipe", "pipe"],
  }), purpose);
  if (bytes.length > MAX_FILE_BYTES_V1) fail(`${purpose} exceeds the file byte cap`);
  return bytes;
}

function requireFixedGitLineV2(root, argv, purpose) {
  const bytes = requireSuccessfulChild(fixedGitResultV2(root, argv), purpose);
  if (
    bytes.length < 2 || bytes.length > MAX_AUTHORITY_BYTES_V1 || bytes.at(-1) !== 0x0a
    || bytes.subarray(0, -1).includes(0x0a) || bytes.includes(0x0d) || bytes.includes(0)
  ) fail(`${purpose} output is not one exact LF-terminated line`);
  const value = strictUtf8V1(bytes.subarray(0, -1), purpose);
  if (value.length === 0) fail(`${purpose} output line is empty`);
  return value;
}

function isAcceptedPinnedGitPhysicalModeV1(gitMode, physicalMode) {
  if (gitMode !== "100644" && gitMode !== "100755") return false;
  const declaredMode = gitMode === "100755" ? 0o755 : 0o644;
  const requiredMode = gitMode === "100755" ? 0o500 : 0o400;
  return Number.isSafeInteger(physicalMode)
    && physicalMode >= 0
    && physicalMode <= 0o7777
    && (physicalMode & (0o7777 ^ declaredMode)) === 0
    && (physicalMode & requiredMode) === requiredMode;
}

function observeCurrentRetentionControllerSourcePassV2(root) {
  if (root !== repositoryRootV1() || realpathSync(root) !== root) fail("retention controller repository root is invalid");
  const include = fixedGitResultV2(root, ["config", "--local", "--no-includes", "--name-only", "--get-regexp", "^include"]);
  if (include.error || include.signal !== null || include.status !== 1 || include.stdout.length !== 0 || include.stderr.length !== 0) {
    fail("retention controller local Git includes are forbidden");
  }
  const origin = fixedGitResultV2(root, ["config", "--local", "--no-includes", "--get-all", "remote.origin.url"]);
  if (
    origin.error || origin.signal !== null || origin.status !== 0 || origin.stderr.length !== 0
    || !origin.stdout.equals(Buffer.from("https://github.com/hikmetgulsesli/setfarm.git\n", "utf8"))
  ) fail("retention controller canonical origin is invalid");
  const branch = requireFixedGitLineV2(root, ["branch", "--show-current"], "retention controller branch");
  const sourceSha = requireFixedGitLineV2(root, ["rev-parse", "--verify", "HEAD^{commit}"], "retention controller commit");
  const sourceTreeHash = requireFixedGitLineV2(root, ["rev-parse", "--verify", "HEAD^{tree}"], "retention controller tree");
  const originMainSha = requireFixedGitLineV2(root, ["rev-parse", "--verify", "refs/remotes/origin/main^{commit}"], "retention controller origin/main");
  const status = fixedGitResultV2(root, ["status", "--porcelain=v2", "--untracked-files=all"]);
  if (
    branch !== "main" || !GIT_HASH.test(sourceSha) || !GIT_HASH.test(sourceTreeHash)
    || sourceSha.length !== sourceTreeHash.length || originMainSha !== sourceSha
    || status.error || status.signal !== null || status.status !== 0 || status.stdout.length !== 0 || status.stderr.length !== 0
  ) fail("retention controller source is not clean synchronized main");
  const historical = historicalGitInputSetV2(root, sourceSha, sourceTreeHash);
  const repository = directoryIdentity(root);
  const liveInputPhysicalProjection = [];
  for (const entry of historical.entries) {
    const target = path.join(root, ...entry.locator.split("/"));
    if (!isWithinLocator(root, target) || realpathSync(target) !== target) fail("retention controller live input escaped the repository");
    const observed = readStableRegular(target, { device: BigInt(repository.devDecimal), linkCounts: [1], maxBytes: MAX_FILE_BYTES_V1 });
    const physicalMode = Number(observed.stats.mode & 0o7777n);
    if (
      observed.stats.uid !== BigInt(process.getuid())
      || !isAcceptedPinnedGitPhysicalModeV1(entry.gitMode, physicalMode)
      || !observed.bytes.equals(historical.blobs.get(entry.gitBlobHash))
    ) {
      fail(`retention controller live input differs from Git: ${entry.locator}`);
    }
    liveInputPhysicalProjection.push(Object.freeze({
      locator: entry.locator,
      physicalMode,
      uidDecimal: observed.stats.uid.toString(10),
      devDecimal: observed.stats.dev.toString(10),
      inoDecimal: observed.stats.ino.toString(10),
      linkCount: Number(observed.stats.nlink),
      byteLength: observed.bytes.length,
      sha256: sha256(observed.bytes),
    }));
  }
  return Object.freeze({
    branch: "main",
    clean: true,
    sourceSha,
    sourceTreeHash,
    originMainSha: sourceSha,
    buildInputSetHash: historical.buildInputSetHash,
    controllerPhysicalInputSetHash: sha256(canonicalJsonV1(Object.freeze({
      schema: "setfarm.platform-build-generation-retention-controller-physical-input-set.v1",
      entries: Object.freeze(liveInputPhysicalProjection),
    }))),
  });
}

function assertRetentionControllerSourceV2(value) {
  assertRotationControllerSource(value);
}

function observeCurrentRetentionControllerSourceV2(root) {
  const before = observeCurrentRetentionControllerSourcePassV2(root);
  const after = observeCurrentRetentionControllerSourcePassV2(root);
  if (canonicalJsonV1(before) !== canonicalJsonV1(after)) fail("retention controller source changed during observation");
  const { controllerPhysicalInputSetHash: _privateObservation, ...controllerSource } = before;
  return Object.freeze(controllerSource);
}

function assertRetainedCurrentBuildV1(value) {
  if (
    !value || !hasExactKeys(value, [
      "schema", "sourceSha", "sourceTreeHash", "buildHash", "buildInputSetHash", "buildInfoHash", "outputTreeHash", "releaseManifestHash",
    ])
    || value.schema !== "setfarm.platform-build-generation-retained-current-build.v1"
    || !GIT_HASH.test(value.sourceSha) || !GIT_HASH.test(value.sourceTreeHash) || value.sourceSha.length !== value.sourceTreeHash.length
    || !SHA256.test(value.buildHash) || !SHA256.test(value.buildInputSetHash) || !SHA256.test(value.buildInfoHash)
    || !SHA256.test(value.outputTreeHash) || !SHA256.test(value.releaseManifestHash)
  ) fail("retained current build authority is invalid");
}

function observeRetainedCurrentBuildV1(root, controllerSource) {
  assertRetentionControllerSourceV2(controllerSource);
  if (root !== repositoryRootV1() || realpathSync(root) !== root) fail("retained current build repository root is invalid");
  const dist = path.join(root, "dist");
  const distIdentity = directoryIdentity(dist);
  if (distIdentity.mode !== 0o755) fail("retained current build dist mode is invalid");
  const buildInfoObserved = readStableRegular(path.join(dist, "BUILD_INFO.json"), {
    device: BigInt(distIdentity.devDecimal), linkCounts: [1], maxBytes: MAX_AUTHORITY_BYTES_V1,
  });
  if (buildInfoObserved.mode !== 0o444) fail("retained current build BUILD_INFO mode is invalid");
  const buildInfo = parseFinalizedJsonV1(buildInfoObserved, [
    "sha", "shortSha", "branch", "dirty", "packageVersion", "displayVersion", "builtAt",
  ], "retained current build BUILD_INFO", true);
  if (!GIT_HASH.test(buildInfo.sha)) fail("retained current build source SHA is invalid");
  const sourceTreeHash = requireFixedGitLineV2(root, ["rev-parse", "--verify", `${buildInfo.sha}^{tree}`], "retained current build tree");
  const historical = historicalGitInputSetV2(root, buildInfo.sha, sourceTreeHash);
  const outputTreeObserved = readStableRegular(path.join(dist, "PLATFORM_BUILD_OUTPUT_TREE.json"), {
    device: BigInt(distIdentity.devDecimal), linkCounts: [1], maxBytes: MAX_AUTHORITY_BYTES_V1,
  });
  const manifestObserved = readStableRegular(path.join(dist, "PLATFORM_RELEASE_MANIFEST.json"), {
    device: BigInt(distIdentity.devDecimal), linkCounts: [1], maxBytes: MAX_AUTHORITY_BYTES_V1,
  });
  if (outputTreeObserved.mode !== 0o444 || manifestObserved.mode !== 0o444) fail("retained current build terminal authority mode is invalid");
  const outputTree = parseFinalizedJsonV1(outputTreeObserved, [
    "schema", "sourceSha", "sourceTreeHash", "entries", "outputTreeHash",
  ], "retained current build output tree", false);
  const manifest = parseFinalizedJsonV1(manifestObserved, [
    "schema", "releaseSha", "branch", "dirty", "stitchConverter",
  ], "retained current build release manifest", false);
  const stableBuildInfo = {
    schema: "setfarm.internal-production-stable-setfarm-build-info.v1",
    sha: buildInfo.sha,
    shortSha: buildInfo.shortSha,
    branch: buildInfo.branch,
    dirty: buildInfo.dirty,
    packageVersion: buildInfo.packageVersion,
    displayVersion: buildInfo.displayVersion,
  };
  const buildHash = hashCanonicalJsonV1({
    schema: "setfarm.internal-production-controller-build.v1",
    stableBuildInfo,
    buildInputSetHash: historical.buildInputSetHash,
    outputTreeHash: outputTree.outputTreeHash,
    releaseManifestHash: hashCanonicalJsonV1(manifest),
  });
  const expectedSourceBuild = Object.freeze({
    branch: "main",
    clean: true,
    sha: buildInfo.sha,
    treeHash: sourceTreeHash,
    buildHash,
    originMainSha: buildInfo.sha,
  });
  const entrypoint = realpathSync(path.join(root, historical.outputs[0]));
  const actual = observeActualSetfarmRuntimeSourceV1(entrypoint, expectedSourceBuild);
  if (actual.sha !== buildInfo.sha || actual.treeHash !== sourceTreeHash || actual.buildHash !== buildHash) {
    fail("retained current build finalized source is crossed");
  }
  const ancestry = fixedGitResultV2(root, ["merge-base", "--is-ancestor", buildInfo.sha, controllerSource.sourceSha]);
  if (
    buildInfo.sha === controllerSource.sourceSha || ancestry.error || ancestry.signal !== null || ancestry.status !== 0
    || ancestry.stdout.length !== 0 || ancestry.stderr.length !== 0
  ) fail("retained current build is not a strict ancestor of the retention controller");
  const buildInfoAfter = readStableRegular(path.join(dist, "BUILD_INFO.json"), {
    device: BigInt(distIdentity.devDecimal), linkCounts: [1], maxBytes: MAX_AUTHORITY_BYTES_V1,
  });
  const outputTreeAfter = readStableRegular(path.join(dist, "PLATFORM_BUILD_OUTPUT_TREE.json"), {
    device: BigInt(distIdentity.devDecimal), linkCounts: [1], maxBytes: MAX_AUTHORITY_BYTES_V1,
  });
  const manifestAfter = readStableRegular(path.join(dist, "PLATFORM_RELEASE_MANIFEST.json"), {
    device: BigInt(distIdentity.devDecimal), linkCounts: [1], maxBytes: MAX_AUTHORITY_BYTES_V1,
  });
  if (
    !buildInfoAfter.bytes.equals(buildInfoObserved.bytes) || !outputTreeAfter.bytes.equals(outputTreeObserved.bytes)
    || !manifestAfter.bytes.equals(manifestObserved.bytes)
  ) fail("retained current build authority changed during observation");
  const value = Object.freeze({
    schema: "setfarm.platform-build-generation-retained-current-build.v1",
    sourceSha: buildInfo.sha,
    sourceTreeHash,
    buildHash,
    buildInputSetHash: historical.buildInputSetHash,
    buildInfoHash: sha256(buildInfoObserved.bytes),
    outputTreeHash: outputTree.outputTreeHash,
    releaseManifestHash: hashCanonicalJsonV1(manifest),
  });
  assertRetainedCurrentBuildV1(value);
  return value;
}

function observeOperationAuthoritiesV1(root) {
  // OA18_PRIVATE_FIXTURE_AUTHORITIES_START
  const program = [
    'import { observeCurrentInternalProductionCleanSetfarmSourceBuildV1 } from "./src/internal-production/baseline-post-handoff-receipt-v1.ts";',
    'import { observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1 } from "./src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts";',
    "const sourceBuild = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();",
    "const productBuildAuthorityV2Observation = await observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1();",
    "process.stdout.write(`${JSON.stringify({sourceBuild,productBuildAuthorityV2Observation})}\\n`);",
  ].join("\n");
  const observed = parseCanonicalChildJsonLine(requireSuccessfulChild(fixedChildResult(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", program],
    { cwd: root },
  ), "current retention authorities"), "current retention authorities");
  // OA18_PRIVATE_FIXTURE_AUTHORITIES_END
  const sourceBuild = observed?.sourceBuild;
  const pba = observed?.productBuildAuthorityV2Observation;
  if (
    !sourceBuild || !hasExactKeys(sourceBuild, ["branch", "clean", "sha", "treeHash", "buildHash", "originMainSha"])
    || sourceBuild.branch !== "main" || sourceBuild.clean !== true
    || !GIT_HASH.test(sourceBuild.sha) || !GIT_HASH.test(sourceBuild.treeHash)
    || !SHA256.test(sourceBuild.buildHash) || sourceBuild.originMainSha !== sourceBuild.sha
  ) fail("current Setfarm source/build authority is invalid");
  assertProductBuildAuthorityV2ObservationV1(pba);
  const response = pba?.response;
  if (
    pba?.schema !== "setfarm.product-build-authority-v2-delivery-evidence-observation.v1"
    || pba.observationTransport !== "source-cli"
    || response?.schema !== "mission-control.product-build-authority-v2-delivery-evidence-response.v1"
    || response.currentStatus !== "current"
    || typeof response.deliveryEvidenceRef !== "string" || !SHA256.test(response.deliveryEvidenceHash)
    || response.evidence?.deliveryEvidenceRef !== response.deliveryEvidenceRef
    || response.evidence?.deliveryEvidenceHash !== response.deliveryEvidenceHash
    || response.deliveryEvidenceRef !== `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${response.deliveryEvidenceHash}`
    || !GIT_HASH.test(response.evidence?.currentSource?.sha)
    || !GIT_HASH.test(response.evidence?.currentSource?.treeHash)
    || !SHA256.test(response.evidence?.currentSource?.buildHash)
  ) fail("current Mission Control delivery authority is invalid");
  const setfarmPair = Object.freeze({
    sourceSha: sourceBuild.sha,
    sourceTreeHash: sourceBuild.treeHash,
    controllerBuildHash: sourceBuild.buildHash,
  });
  const pbaPair = Object.freeze({
    deliveryEvidenceRef: response.deliveryEvidenceRef,
    deliveryEvidenceHash: response.deliveryEvidenceHash,
  });
  const expectedRuntimeSources = Object.freeze([
    Object.freeze({ label: "com.setrox.setfarm-spawner", provenance: "operation_current_oa17_setfarm_source_build", sourcePair: setfarmPair, sourceBody: sourceBuild }),
    Object.freeze({ label: "com.setrox.setfarm-dashboard", provenance: "operation_current_oa17_setfarm_source_build", sourcePair: setfarmPair, sourceBody: sourceBuild }),
    Object.freeze({ label: "com.setrox.mission-control", provenance: "operation_embedded_current_pba_v2_delivery_evidence", sourcePair: pbaPair, sourceBody: pba }),
  ]);
  return Object.freeze({ sourceBuild, productBuildAuthorityV2Observation: pba, productBuildAuthorityV2DeliveryEvidence: pbaPair, expectedRuntimeSources });
}

function observeCurrentProductBuildAuthorityForRetentionV2(root) {
  // OA18_PRIVATE_FIXTURE_PBA_V2_START
  const program = [
    'import { observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1 } from "./src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts";',
    "const productBuildAuthorityV2Observation = await observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1();",
    "process.stdout.write(`${JSON.stringify(productBuildAuthorityV2Observation)}\\n`);",
  ].join("\n");
  const pba = parseCanonicalChildJsonLine(requireSuccessfulChild(fixedChildResult(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", program],
    { cwd: root },
  ), "current retention PBA authority"), "current retention PBA authority");
  // OA18_PRIVATE_FIXTURE_PBA_V2_END
  assertProductBuildAuthorityV2ObservationV1(pba);
  const response = pba?.response;
  if (
    pba?.schema !== "setfarm.product-build-authority-v2-delivery-evidence-observation.v1"
    || pba.observationTransport !== "source-cli"
    || response?.schema !== "mission-control.product-build-authority-v2-delivery-evidence-response.v1"
    || response.currentStatus !== "current"
    || typeof response.deliveryEvidenceRef !== "string" || !SHA256.test(response.deliveryEvidenceHash)
    || response.evidence?.deliveryEvidenceRef !== response.deliveryEvidenceRef
    || response.evidence?.deliveryEvidenceHash !== response.deliveryEvidenceHash
    || response.deliveryEvidenceRef !== `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${response.deliveryEvidenceHash}`
    || !GIT_HASH.test(response.evidence?.currentSource?.sha)
    || !GIT_HASH.test(response.evidence?.currentSource?.treeHash)
    || !SHA256.test(response.evidence?.currentSource?.buildHash)
  ) fail("current Mission Control delivery authority is invalid");
  return Object.freeze({
    body: pba,
    pair: Object.freeze({
      deliveryEvidenceRef: response.deliveryEvidenceRef,
      deliveryEvidenceHash: response.deliveryEvidenceHash,
    }),
  });
}

function observeOperationAuthoritiesV2(root, inspection) {
  if (inspection.danglingIntent) fail("retention v2 cannot cross a dangling rotation intent");
  const active = inspection.generations.filter((generation) => generation.disposition === null);
  if (active.length !== 8) fail("retention v2 requires exactly eight active completed generations");
  const controllerSource = observeCurrentRetentionControllerSourceV2(root);
  const retainedCurrentBuild = observeRetainedCurrentBuildV1(root, controllerSource);
  const pba = observeCurrentProductBuildAuthorityForRetentionV2(root);
  const setfarmPair = Object.freeze({
    sourceSha: retainedCurrentBuild.sourceSha,
    sourceTreeHash: retainedCurrentBuild.sourceTreeHash,
    controllerBuildHash: retainedCurrentBuild.buildHash,
  });
  const expectedRuntimeSources = Object.freeze([
    Object.freeze({ label: "com.setrox.setfarm-spawner", provenance: "operation_retained_current_setfarm_build", sourcePair: setfarmPair, sourceBody: retainedCurrentBuild }),
    Object.freeze({ label: "com.setrox.setfarm-dashboard", provenance: "operation_retained_current_setfarm_build", sourcePair: setfarmPair, sourceBody: retainedCurrentBuild }),
    Object.freeze({ label: "com.setrox.mission-control", provenance: "operation_embedded_current_pba_v2_delivery_evidence", sourcePair: pba.pair, sourceBody: pba.body }),
  ]);
  assertExpectedRuntimeSourcesV2(expectedRuntimeSources, retainedCurrentBuild, pba.pair, pba.body);
  return Object.freeze({
    controllerSource,
    retainedCurrentBuild,
    productBuildAuthorityV2Observation: pba.body,
    productBuildAuthorityV2DeliveryEvidence: pba.pair,
    expectedRuntimeSources,
  });
}

function gitBytes(root, args, purpose) {
  return requireSuccessfulChild(fixedGitResultV2(root, args), purpose);
}

function executingImplementationClosureV1(root, sourceBuild) {
  const entryLocator = "scripts/build-generation-retention.mjs";
  const pending = [entryLocator];
  const visited = new Set();
  const entries = [];
  const importEdges = [];
  const builtinSet = new Set();
  let totalBytes = 0;
  while (pending.length > 0) {
    const locator = pending.shift();
    if (visited.has(locator)) continue;
    visited.add(locator);
    if (visited.size > 256) fail("retention executing closure module cap exceeded");
    const file = path.join(root, locator);
    const real = realpathSync(file);
    if (path.relative(root, real).startsWith("..") || path.isAbsolute(path.relative(root, real))) fail("retention closure escapes the repository");
    const observed = readStableRegular(file, { linkCounts: [1], maxBytes: MAX_AUTHORITY_BYTES_V1 });
    totalBytes += observed.bytes.length;
    if (totalBytes > 16_777_216) fail("retention executing closure byte cap exceeded");
    const text = observed.bytes.toString("utf8");
    if (/\bimport\s*\(/.test(text)) fail("dynamic import is forbidden in the retention closure");
    const specifiers = [];
    const statements = [];
    let statement = "";
    for (const line of text.split("\n")) {
      if (statement === "" && !(/^\s*import\b/.test(line) || /^\s*export\s*(?:\*|\{)/.test(line))) continue;
      statement += `${line}\n`;
      if (line.includes(";")) {
        statements.push(statement);
        statement = "";
      }
    }
    if (statement !== "") fail("unterminated retention closure import/export statement");
    for (const sourceStatement of statements) {
      if (/^\s*export\s*\{\s*[A-Za-z_$][A-Za-z0-9_$]*(?:\s+as\s+[A-Za-z_$][A-Za-z0-9_$]*)?(?:\s*,\s*[A-Za-z_$][A-Za-z0-9_$]*(?:\s+as\s+[A-Za-z_$][A-Za-z0-9_$]*)?)*\s*,?\s*\}\s*;\s*$/.test(sourceStatement)) continue;
      const match = /^\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']\s*;/m.exec(sourceStatement);
      if (!match) fail("unsupported retention closure import/export syntax");
      specifiers.push(match[1]);
    }
    for (const specifier of specifiers) {
      if (specifier.startsWith("node:")) {
        builtinSet.add(specifier);
        continue;
      }
      if (!specifier.startsWith("./") && !specifier.startsWith("../")) fail("bare/absolute retention closure import is forbidden");
      const importedLocator = path.posix.normalize(path.posix.join(path.posix.dirname(locator), specifier));
      if (importedLocator.startsWith("../") || importedLocator === ".." || !importedLocator.endsWith(".mjs")) fail("retention closure import locator is invalid");
      importEdges.push(Object.freeze({ importerLocator: locator, literalSpecifier: specifier, importedLocator }));
      pending.push(importedLocator);
    }
    const line = requireFixedGitLineV2(root, ["ls-tree", sourceBuild.sha, "--", locator], `Git tree entry ${locator}`);
    const match = /^(100644|100755) blob ([0-9a-f]{40}|[0-9a-f]{64})\t(.+)$/.exec(line);
    if (!match || match[3] !== locator) fail(`retention closure Git entry mismatch for ${locator}`);
    const blob = gitBytes(root, ["cat-file", "blob", match[2]], `Git blob ${locator}`);
    if (!blob.equals(observed.bytes)) fail(`retention executing bytes differ from Git for ${locator}`);
    entries.push(Object.freeze({ locator, gitMode: match[1], gitBlobHash: match[2], byteLength: observed.bytes.length, sha256: sha256(observed.bytes) }));
  }
  entries.sort((left, right) => compareBytes(left.locator, right.locator));
  importEdges.sort((left, right) => compareBytes(`${left.importerLocator}\0${left.literalSpecifier}\0${left.importedLocator}`, `${right.importerLocator}\0${right.literalSpecifier}\0${right.importedLocator}`));
  const nodeBuiltinSpecifiers = [...builtinSet].sort(compareBytes);
  const projection = {
    schema: "setfarm.platform-build-generation-retention-executing-closure.v1",
    moduleRootKind: "code_derived_import_meta",
    moduleRootRepositoryLocator: ".",
    entryLocator,
    maxModuleCount: 256,
    maxImportEdgeCount: 2_048,
    maxLocatorUtf8Octets: 1_024,
    maxModuleBytes: 1_048_576,
    maxTotalModuleBytes: 16_777_216,
    entries,
    importEdges,
    nodeBuiltinSpecifiers,
  };
  return Object.freeze({ ...projection, closureHash: hashCanonicalJsonV1(projection) });
}

function fieldContractV1(name) {
  if (name === "PATH") return { valueGrammar: "colon_path_list", classification: "path_list", tokenization: "colon-path-list-v1", scanPolicy: "none-v1" };
  if (["CLI_PATH", "PROJECTS_DIR", "SETFARM_DIR", "SETFARM_REPO_DIR"].includes(name)) {
    return { valueGrammar: "absolute_path", classification: "single_path", tokenization: "single-v1", scanPolicy: "none-v1" };
  }
  if (name === "PROJECTS_JSON") return { valueGrammar: "absolute_file_path", classification: "single_path", tokenization: "single-v1", scanPolicy: "none-v1" };
  if (["MC_INTERNAL_URL", "SETFARM_URL"].includes(name)) {
    return { valueGrammar: "absolute_http_url", classification: "absolute_url", tokenization: "url-components-v1", scanPolicy: "none-v1" };
  }
  if (name === "MC_HOST") return { valueGrammar: "host_scalar", classification: "scalar", tokenization: "conservative-path-url-scan-v1", scanPolicy: "conservative-path-and-url-token-scan-v1" };
  if (name === "MC_PORT") return { valueGrammar: "decimal_port_scalar", classification: "scalar", tokenization: "conservative-path-url-scan-v1", scanPolicy: "conservative-path-and-url-token-scan-v1" };
  if (name === "SETFARM_OPERATIONAL_WRITE_TOKEN") return { valueGrammar: "opaque_secret_scalar", classification: "scalar", tokenization: "conservative-path-url-scan-v1", scanPolicy: "conservative-path-and-url-token-scan-v1" };
  if (name === "SETFARM_PG_URL") return { valueGrammar: "postgresql_connection_url", classification: "database_url", tokenization: "database-url-components-and-conservative-scan-v1", scanPolicy: "conservative-path-and-url-token-scan-v1" };
  fail(`unknown environment field ${name}`);
}

function isWithinLocator(candidate, locator) {
  const relative = path.relative(candidate, locator);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function pathTokenCommitmentV1(rawToken, tokenOrdinal, workingDirectory, candidate, quarantine) {
  const lexical = rawToken === "" ? workingDirectory : (path.isAbsolute(rawToken) ? path.normalize(rawToken) : path.resolve(workingDirectory, rawToken));
  if (!path.isAbsolute(lexical) || lexical.includes("\0")) fail("path token is not canonical absolute");
  const safeLstat = (locator) => {
    try { return lstatSync(locator, { bigint: true }); } catch { fail("path token component is unavailable"); }
  };
  const safeReadlink = (locator) => {
    try { return readlinkSync(locator, "utf8"); } catch { fail("path token symlink is unavailable"); }
  };
  const safeRealpath = (locator) => {
    try { return realpathSync(locator); } catch { fail("path token realpath is unavailable"); }
  };
  const sameIdentity = (left, right) => (
    left.dev === right.dev && left.ino === right.ino && left.mode === right.mode && left.nlink === right.nlink
  );
  const candidateBefore = safeLstat(candidate);
  const quarantineBefore = optionalLstat(quarantine);
  if (
    !candidateBefore.isDirectory()
    || (quarantineBefore !== undefined && (!quarantineBefore.isDirectory() || sameIdentity(candidateBefore, quarantineBefore)))
  ) {
    fail("path token forbidden roots are invalid");
  }
  const isForbiddenIdentity = (stats) => sameIdentity(stats, candidateBefore)
    || (quarantineBefore !== undefined && sameIdentity(stats, quarantineBefore));
  const hops = [];
  let cursor = path.parse(lexical).root;
  let pending = lexical.slice(cursor.length).split(path.sep).filter(Boolean);
  const seen = new Set();
  let symlinkCount = 0;
  let componentCount = 0;
  while (pending.length > 0) {
    componentCount += 1;
    if (componentCount > 1_024) fail("path token component cap exceeded");
    const name = pending.shift();
    const next = path.join(cursor, name);
    const stats = safeLstat(next);
    if (isForbiddenIdentity(stats)) fail("runtime configuration references the retained candidate");
    const identity = {
      devDecimal: stats.dev.toString(10),
      inoDecimal: stats.ino.toString(10),
      mode: modeOf(stats),
      linkCount: Number(stats.nlink),
      lexicalLocatorHash: sha256(Buffer.from(next, "utf8")),
    };
    if (!Number.isSafeInteger(identity.linkCount) || identity.linkCount < 1) fail("path token identity is invalid");
    if (stats.isSymbolicLink()) {
      symlinkCount += 1;
      if (symlinkCount > 32) fail("path token symlink depth exceeded");
      const target = safeReadlink(next);
      const reopened = safeLstat(next);
      if (!sameIdentity(reopened, stats)) fail("path token symlink changed during resolution");
      const resolved = path.isAbsolute(target) ? path.normalize(target) : path.resolve(path.dirname(next), target);
      const loopKey = `${next}\0${resolved}`;
      if (seen.has(loopKey)) fail("path token symlink loop");
      seen.add(loopKey);
      hops.push(Object.freeze({ ...identity, resolvedLocatorHash: sha256(Buffer.from(resolved, "utf8")) }));
      cursor = path.parse(resolved).root;
      pending = [...resolved.slice(cursor.length).split(path.sep).filter(Boolean), ...pending];
      continue;
    }
    const reopened = safeLstat(next);
    if (!sameIdentity(reopened, stats)) fail("path token component changed during resolution");
    hops.push(Object.freeze({ ...identity, resolvedLocatorHash: sha256(Buffer.from(next, "utf8")) }));
    cursor = next;
  }
  const finalRealpath = safeRealpath(cursor);
  if (isWithinLocator(candidate, finalRealpath) || isWithinLocator(quarantine, finalRealpath) || isWithinLocator(candidate, lexical) || isWithinLocator(quarantine, lexical)) {
    fail("runtime configuration references the retained candidate");
  }
  const quarantineAfter = optionalLstat(quarantine);
  if (
    !sameIdentity(candidateBefore, safeLstat(candidate))
    || (quarantineBefore === undefined) !== (quarantineAfter === undefined)
    || (quarantineBefore !== undefined && !sameIdentity(quarantineBefore, quarantineAfter))
  ) {
    fail("path token forbidden root changed during resolution");
  }
  return Object.freeze({
    tokenOrdinal,
    tokenHash: sha256(Buffer.from(rawToken, "utf8")),
    tokenKind: "path",
    emptyPathListSegment: rawToken === "",
    resolutionKind: path.isAbsolute(rawToken) ? "absolute" : "effective_working_directory_relative",
    symlinkHops: Object.freeze(hops),
    finalRealpathHash: sha256(Buffer.from(finalRealpath, "utf8")),
    outsideCandidateAndQuarantine: true,
  });
}

function nonPathTokenCommitmentV1(rawToken, ordinal, kind = "nonpath") {
  return Object.freeze({
    tokenOrdinal: ordinal,
    tokenHash: sha256(Buffer.from(rawToken, "utf8")),
    tokenKind: kind,
    emptyPathListSegment: false,
    resolutionKind: "not_applicable",
    symlinkHops: Object.freeze([]),
    finalRealpathHash: null,
    outsideCandidateAndQuarantine: true,
  });
}

function decodedScanFormsV1(rawValue) {
  const forms = [rawValue];
  let current = rawValue;
  for (let count = 0; count < 2; count += 1) {
    if (!current.includes("%")) break;
    if (/%(?![0-9A-Fa-f]{2})/.test(current)) fail("environment percent encoding is invalid");
    let decoded;
    try { decoded = decodeURIComponent(current); } catch { fail("environment percent encoding is invalid"); }
    if (decoded === current) break;
    forms.push(decoded);
    current = decoded;
  }
  return Object.freeze(forms);
}

function assertNoForbiddenLocatorTextV1(rawValue, candidate, quarantine) {
  for (const form of decodedScanFormsV1(rawValue)) {
    for (const forbidden of [candidate, quarantine]) {
      if (form.includes(forbidden) || form.includes(`file://${forbidden}`)) fail("environment scan references the candidate or quarantine path");
    }
    const absoluteTokens = form.match(/(?:^|[\s=,;"'])(\/(?:[^\s,;"']*))/g) ?? [];
    for (const match of absoluteTokens) {
      const token = match.replace(/^[\s=,;"']+/, "");
      const normalized = path.normalize(token);
      if (isWithinLocator(candidate, normalized) || isWithinLocator(quarantine, normalized)) fail("environment scan references the candidate or quarantine path");
    }
  }
}

function urlTokenCommitmentsV1(rawValue, url) {
  return Object.freeze([
    rawValue,
    url.protocol,
    url.username,
    url.password,
    url.hostname,
    url.port,
    url.pathname,
    `${url.search}${url.hash}`,
  ].map((token, ordinal) => nonPathTokenCommitmentV1(token, ordinal, "url")));
}

function conservativeTokenCommitmentsV1(rawValue, workingDirectory, candidate, quarantine) {
  const commitments = [];
  const seen = new Set();
  const pushNonpath = (token, kind = "nonpath") => {
    const key = `${kind}\0${token}`;
    if (seen.has(key)) return;
    seen.add(key);
    commitments.push(nonPathTokenCommitmentV1(token, commitments.length, kind));
  };
  const pushPath = (token) => {
    const key = `path\0${token}`;
    if (seen.has(key)) return;
    seen.add(key);
    commitments.push(pathTokenCommitmentV1(token, commitments.length, workingDirectory, candidate, quarantine));
  };
  for (const form of decodedScanFormsV1(rawValue)) {
    pushNonpath(form);
    const lexemes = [];
    const delimiter = String.raw`[\s,;="'<>\(\)\[\]\{\}]`;
    const urlPattern = new RegExp(`(?:^|${delimiter})([A-Za-z][A-Za-z0-9+.-]*:\/\/[^\\s,;="'<>\\(\\)\\[\\]\\{\\}]+)`, "gu");
    const pathPattern = new RegExp(`(?:^|${delimiter})((?:\/|\\.{1,2}\/)[^\\s,;="'<>\\(\\)\\[\\]\\{\\}]+)`, "gu");
    for (const match of form.matchAll(urlPattern)) lexemes.push({ index: match.index, kind: "url", token: match[1] });
    for (const match of form.matchAll(pathPattern)) lexemes.push({ index: match.index, kind: "path", token: match[1] });
    lexemes.sort((left, right) => left.index - right.index || compareBytes(left.kind, right.kind) || compareBytes(left.token, right.token));
    for (const lexeme of lexemes) {
      if (lexeme.kind === "path") {
        pushPath(lexeme.token);
        continue;
      }
      let parsed;
      try { parsed = new URL(lexeme.token); } catch { fail("environment conservative URL token is invalid"); }
      pushNonpath(lexeme.token, "url");
      if (parsed.protocol === "file:") {
        if (parsed.hostname !== "" && parsed.hostname !== "localhost") fail("environment file URL host is invalid");
        pushPath(decodeURIComponent(parsed.pathname));
      }
    }
  }
  return Object.freeze(commitments.map((commitment, tokenOrdinal) => Object.freeze({ ...commitment, tokenOrdinal })));
}

function redactedEnvironmentEntryV1(name, rawValue, fieldOrdinal, workingDirectory, candidate, quarantine) {
  if (typeof rawValue !== "string" || rawValue.includes("\0")) fail(`environment ${name} is invalid`);
  const contract = fieldContractV1(name);
  let tokens;
  if (contract.classification === "path_list") {
    tokens = rawValue.split(":").map((token, ordinal) => pathTokenCommitmentV1(token, ordinal, workingDirectory, candidate, quarantine));
  } else if (contract.classification === "single_path") {
    if (!path.isAbsolute(rawValue)) fail(`environment ${name} must be absolute`);
    tokens = [pathTokenCommitmentV1(rawValue, 0, workingDirectory, candidate, quarantine)];
  } else if (contract.classification === "absolute_url" || contract.classification === "database_url") {
    let url;
    try { url = new URL(rawValue); } catch { fail(`environment ${name} URL is invalid`); }
    if (contract.classification === "absolute_url" && !["http:", "https:"].includes(url.protocol)) fail(`environment ${name} URL scheme is invalid`);
    if (contract.classification === "database_url" && !["postgres:", "postgresql:"].includes(url.protocol)) fail("database URL scheme is invalid");
    assertNoForbiddenLocatorTextV1(rawValue, candidate, quarantine);
    tokens = contract.classification === "absolute_url"
      ? urlTokenCommitmentsV1(rawValue, url)
      : Object.freeze([...urlTokenCommitmentsV1(rawValue, url), ...conservativeTokenCommitmentsV1(rawValue, workingDirectory, candidate, quarantine).map((token, ordinal) => Object.freeze({ ...token, tokenOrdinal: ordinal + 8 }))]);
  } else {
    if (name === "MC_PORT" && !/^(?:[1-9][0-9]{0,4})$/.test(rawValue)) fail("Mission Control port is invalid");
    if (name === "MC_PORT" && Number(rawValue) > 65_535) fail("Mission Control port is outside the valid range");
    if (name === "MC_HOST" && (!/^(?:localhost|[A-Za-z0-9.-]+|\[[0-9A-Fa-f:]+\])$/.test(rawValue) || rawValue.includes(".."))) fail("Mission Control host is invalid");
    assertNoForbiddenLocatorTextV1(rawValue, candidate, quarantine);
    tokens = conservativeTokenCommitmentsV1(rawValue, workingDirectory, candidate, quarantine);
  }
  const rawValueHash = sha256(Buffer.from(rawValue, "utf8"));
  return Object.freeze({
    name,
    valueHash: rawValueHash,
    classificationCommitment: Object.freeze({
      source: "environment",
      sourceName: name,
      fieldOrdinal,
      rawValueHash,
      ...contract,
      tokenCommitments: Object.freeze(tokens),
      exposure: "redacted_secret",
      rawValue: null,
      rawValueRedacted: true,
    }),
    noCandidateReference: true,
  });
}

function nonsecretCommitmentV1(source, sourceName, fieldOrdinal, rawValue, workingDirectory, candidate, quarantine) {
  const pathBearing = rawValue.startsWith("/") || rawValue.startsWith("./") || rawValue.startsWith("../");
  const rawValueHash = sha256(Buffer.from(rawValue, "utf8"));
  return Object.freeze({
    source,
    sourceName,
    fieldOrdinal,
    rawValueHash,
    classification: pathBearing ? "single_path" : "not_path_bearing",
    tokenization: pathBearing ? "single-v1" : "none-v1",
    tokenCommitments: Object.freeze(pathBearing
      ? [pathTokenCommitmentV1(rawValue, 0, workingDirectory, candidate, quarantine)]
      : []),
    exposure: "nonsecret",
    rawValue,
    rawValueRedacted: false,
  });
}

function parseLaunchctlPrintV1(bytes, { uid, label, expectedPath, environmentNames }) {
  if (!Number.isSafeInteger(uid) || uid < 0 || typeof label !== "string" || typeof expectedPath !== "string" || !path.isAbsolute(expectedPath) || !Array.isArray(environmentNames)) {
    fail("launchctl parser authority is invalid");
  }
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > RUNTIME_OBSERVER_MAX_BUFFER_BYTES_V1 || bytes.includes(0) || bytes[bytes.length - 1] !== 0x0a) {
    fail(`${label} launchctl output bytes are invalid`);
  }
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes) || text.includes("\r")) fail(`${label} launchctl output is not strict UTF-8 LF text`);
  const lines = text.slice(0, -1).split("\n");
  if (lines[0] !== `gui/${uid}/${label} = {` || lines.at(-1) !== "}") fail(`${label} launchctl root is invalid`);
  const scalars = new Map();
  const blocks = new Map();
  for (let index = 1; index < lines.length - 1; index += 1) {
    const line = lines[index];
    if (line === "") continue;
    const block = /^\t([^=\t]+) = \{$/.exec(line);
    if (block) {
      const key = block[1];
      if (blocks.has(key) || scalars.has(key)) fail(`${label} launchctl duplicates ${key}`);
      const body = [];
      let depth = 1;
      while (++index < lines.length - 1) {
        const member = lines[index];
        if (/^\t+[^=]+ = \{$/.test(member)) depth += 1;
        if (/^\t+\}$/.test(member)) {
          depth -= 1;
          if (depth === 0) break;
        }
        if (depth === 1) body.push(member);
      }
      if (depth !== 0) fail(`${label} launchctl block ${key} is unterminated`);
      blocks.set(key, Object.freeze(body));
      continue;
    }
    const scalar = /^\t([^=\t]+) = (.*)$/.exec(line);
    if (!scalar || scalar[2] === "") fail(`${label} launchctl top-level line is ambiguous`);
    if (scalars.has(scalar[1]) || blocks.has(scalar[1])) fail(`${label} launchctl duplicates ${scalar[1]}`);
    scalars.set(scalar[1], scalar[2]);
  }
  const scalarNames = [...scalars.keys()].filter((name) => ["path", "pid", "program", "working directory"].includes(name)).sort(compareBytes);
  const blockNames = [...blocks.keys()].filter((name) => ["arguments", "environment"].includes(name)).sort(compareBytes);
  const allowedScalars = ["path", "pid", ...(scalars.has("program") ? ["program"] : []), ...(scalars.has("working directory") ? ["working directory"] : [])].sort(compareBytes);
  if (canonicalJsonV1(scalarNames) !== canonicalJsonV1(allowedScalars) || canonicalJsonV1(blockNames) !== canonicalJsonV1(["arguments", "environment"])) {
    fail(`${label} launchctl top-level selected fields are invalid`);
  }
  if (scalars.get("path") !== expectedPath) fail(`${label} launchctl path is crossed`);
  const argumentLines = blocks.get("arguments");
  const environmentLines = blocks.get("environment");
  if (!argumentLines || !environmentLines) fail(`${label} launchctl selected blocks are missing`);
  const programArguments = argumentLines.map((line) => {
    const match = /^\t\t([^\t\n]+)$/.exec(line);
    if (!match || match[1] === "") fail(`${label} launchctl arguments are invalid`);
    return match[1];
  });
  if (programArguments.length === 0) fail(`${label} launchctl arguments are empty`);
  const rawEnvironment = new Map();
  for (const line of environmentLines) {
    const match = /^\t\t([A-Za-z_][A-Za-z0-9_]*) => (.*)$/.exec(line);
    if (!match || rawEnvironment.has(match[1])) fail(`${label} launchctl environment is invalid`);
    rawEnvironment.set(match[1], match[2]);
  }
  const allowedLaunchd = new Map([
    ["OSLogRateLimit", "64"],
    ["XPC_SERVICE_NAME", label],
  ]);
  const expectedEnvironmentNames = [...environmentNames, ...allowedLaunchd.keys()].sort(compareBytes);
  if (canonicalJsonV1([...rawEnvironment.keys()].sort(compareBytes)) !== canonicalJsonV1(expectedEnvironmentNames)) {
    fail(`${label} launchctl environment names or cardinality are invalid`);
  }
  for (const [name, rawValue] of rawEnvironment) {
    if (environmentNames.includes(name)) continue;
    if (!allowedLaunchd.has(name) || allowedLaunchd.get(name) !== rawValue) fail(`${label} launchctl environment has an unknown field`);
  }
  const environment = environmentNames.map((name) => {
    if (!rawEnvironment.has(name)) fail(`${label} launchctl environment is missing ${name}`);
    return Object.freeze([name, rawEnvironment.get(name)]);
  });
  const pidText = scalars.get("pid");
  const pid = pidText && /^[1-9][0-9]*$/.test(pidText) ? Number(pidText) : NaN;
  if (!Number.isSafeInteger(pid)) fail(`${label} launchctl PID is invalid`);
  const reportedProgram = scalars.get("program") ?? null;
  const reportedWorkingDirectory = scalars.get("working directory") ?? null;
  return Object.freeze({
    pid,
    reportedProgram,
    reportedWorkingDirectory,
    programArguments: Object.freeze(programArguments),
    environment: Object.freeze(environment),
  });
}

function parseStableJsonFileV1(file, maxBytes = MAX_AUTHORITY_BYTES_V1) {
  const observed = readStableRegular(file, { linkCounts: [1], maxBytes });
  let value;
  try { value = JSON.parse(observed.bytes.toString("utf8")); } catch { fail(`${file} contains invalid JSON`); }
  return Object.freeze({ value, observed });
}

function strictUtf8V1(bytes, label, allowNul = false) {
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { fail(`${label} is not strict UTF-8`); }
  if (!Buffer.from(text, "utf8").equals(bytes) || (!allowNul && text.includes("\0")) || text.includes("\r")) fail(`${label} UTF-8 bytes are invalid`);
  return text;
}

function parseFinalizedJsonV1(observed, keys, label, pretty) {
  const text = strictUtf8V1(observed.bytes, label);
  let value;
  try { value = JSON.parse(text); } catch { fail(`${label} is not JSON`); }
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || canonicalJsonV1(Object.keys(value)) !== canonicalJsonV1(keys)) {
    fail(`${label} declared-order shape is invalid`);
  }
  const expectedBytes = Buffer.from(`${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`, "utf8");
  if (!observed.bytes.equals(expectedBytes)) fail(`${label} bytes are not exact declared-order JSON plus LF`);
  return value;
}

function historicalGitInputSetV2(root, sourceSha, sourceTreeHash) {
  if (!GIT_HASH.test(sourceSha) || !GIT_HASH.test(sourceTreeHash) || sourceSha.length !== sourceTreeHash.length) {
    fail("historical Setfarm source/tree authority is invalid");
  }
  const expectedSourceBuild = Object.freeze({ sha: sourceSha, treeHash: sourceTreeHash });
  const commit = requireFixedGitLineV2(root, ["rev-parse", "--verify", `${expectedSourceBuild.sha}^{commit}`], "loaded Setfarm historical commit");
  const treeHash = requireFixedGitLineV2(root, ["rev-parse", "--verify", `${expectedSourceBuild.sha}^{tree}`], "loaded Setfarm historical tree");
  if (commit !== expectedSourceBuild.sha || treeHash !== expectedSourceBuild.treeHash) fail("loaded Setfarm historical commit/tree is crossed");
  const listingBytes = gitBytes(root, ["ls-tree", "-r", "-z", "--full-tree", expectedSourceBuild.sha], "loaded Setfarm historical tree listing");
  const records = strictUtf8V1(listingBytes, "loaded Setfarm historical tree listing", true).split("\0");
  if (records.pop() !== "" || records.length > MAX_TREE_ENTRIES_V1) fail("loaded Setfarm historical tree listing is invalid");
  const entries = records.map((record) => {
    const match = /^(100644|100755) blob ([0-9a-f]{40}|[0-9a-f]{64})\t(.+)$/.exec(record);
    if (!match) fail("loaded Setfarm historical tree entry is invalid");
    canonicalRelativeLocator(match[3]);
    return Object.freeze({ locator: match[3], gitMode: match[1], gitBlobHash: match[2] });
  }).sort((left, right) => compareBytes(left.locator, right.locator));
  const blobs = new Map();
  let totalBytes = 0;
  let prior = null;
  for (const entry of entries) {
    if (prior !== null && compareBytes(prior, entry.locator) >= 0) fail("loaded Setfarm historical tree has duplicate locators");
    prior = entry.locator;
    if (!blobs.has(entry.gitBlobHash)) blobs.set(entry.gitBlobHash, requireFixedGitBlobV2(root, entry.gitBlobHash, `loaded Setfarm Git blob ${entry.locator}`));
    totalBytes += blobs.get(entry.gitBlobHash).length;
    if (totalBytes > MAX_TOTAL_BYTES_V1) fail("loaded Setfarm historical blobs exceed the byte cap");
  }
  const buildInputSetHash = hashCanonicalJsonV1({
    schema: "setfarm.internal-production-pinned-build-input-set.v1",
    sourceSha: expectedSourceBuild.sha,
    sourceTreeHash: expectedSourceBuild.treeHash,
    entries,
  });
  const packageEntry = entries.find((entry) => entry.locator === "package.json");
  const stitchEntry = entries.find((entry) => entry.locator === "scripts/stitch-to-jsx.mjs");
  if (!packageEntry || packageEntry.gitMode !== "100644" || !stitchEntry || stitchEntry.gitMode !== "100644") {
    fail("loaded Setfarm historical package/Stitch authority is missing or has the wrong mode");
  }
  let packageValue;
  try { packageValue = JSON.parse(strictUtf8V1(blobs.get(packageEntry.gitBlobHash), "loaded Setfarm historical package.json")); } catch { fail("loaded Setfarm historical package.json is invalid"); }
  if (!packageValue || Object.getPrototypeOf(packageValue) !== Object.prototype || typeof packageValue.version !== "string" || packageValue.version === "") {
    fail("loaded Setfarm historical package version is invalid");
  }
  const outputs = [];
  for (const entry of entries) {
    const locator = entry.locator;
    if (locator.startsWith("src/") && locator.endsWith(".ts") && !/\.(?:d|m|c)\.ts$/.test(locator)) outputs.push(`dist/${locator.slice(4, -3)}.js`);
    else if (locator === "src/server/index.html" || locator === "src/installer/compat-rules.json") outputs.push(`dist/${locator.slice(4)}`);
    else if (/^src\/installer\/prompts\/[^/]+\.md$/.test(locator) || /^src\/installer\/steps\/.+\.md$/.test(locator)) outputs.push(`dist/${locator.slice(4)}`);
  }
  outputs.sort(compareBytes);
  if (outputs.length === 0 || outputs.some((locator, ordinal) => ordinal > 0 && compareBytes(outputs[ordinal - 1], locator) >= 0)) fail("loaded Setfarm expected output inventory is empty or collided");
  const directories = new Set();
  for (const locator of outputs) {
    canonicalRelativeLocator(locator);
    let parent = path.posix.dirname(locator);
    while (parent !== "dist" && parent !== ".") {
      directories.add(parent);
      parent = path.posix.dirname(parent);
    }
  }
  return Object.freeze({
    entries: Object.freeze(entries),
    blobs,
    buildInputSetHash,
    packageVersion: packageValue.version,
    stitchBytes: blobs.get(stitchEntry.gitBlobHash),
    outputs: Object.freeze(outputs),
    directories: Object.freeze([...directories].sort(compareBytes)),
  });
}

function historicalBuildInputsV1(root, expectedSourceBuild) {
  assertSourceBuildBodyV1(expectedSourceBuild, "loaded Setfarm expected source/build");
  return historicalGitInputSetV2(root, expectedSourceBuild.sha, expectedSourceBuild.treeHash);
}

function observeActualSetfarmRuntimeSourceV1(entrypointRealpath, expectedSourceBuild) {
  const root = repositoryRootV1();
  const distRoot = realpathSync(path.join(root, "dist"));
  if (!isWithinLocator(distRoot, entrypointRealpath)) fail("Setfarm loaded entrypoint is outside the current finalized dist");
  const historical = historicalBuildInputsV1(root, expectedSourceBuild);
  const distIdentity = directoryIdentity(distRoot);
  if (distIdentity.mode !== 0o755) fail("loaded Setfarm finalized dist mode is invalid");
  const files = new Map();
  const directories = [];
  let entryCount = 0;
  let totalBytes = 0;
  function visit(directory, relative, depth) {
    if (depth > MAX_TREE_DEPTH_V1) fail("loaded Setfarm finalized dist exceeds the depth cap");
    for (const name of readdirSync(directory).sort(compareBytes)) {
      entryCount += 1;
      if (entryCount > MAX_TREE_ENTRIES_V1) fail("loaded Setfarm finalized dist exceeds the entry cap");
      const locator = relative ? `${relative}/${name}` : `dist/${name}`;
      canonicalRelativeLocator(locator);
      const target = path.join(directory, name);
      const stats = lstatSync(target, { bigint: true });
      if (stats.dev.toString(10) !== distIdentity.devDecimal || stats.isSymbolicLink()) fail(`loaded Setfarm finalized member is invalid: ${locator}`);
      if (stats.isDirectory()) {
        if (modeOf(stats) !== 0o755) fail(`loaded Setfarm finalized directory mode is invalid: ${locator}`);
        directories.push(locator);
        visit(target, locator, depth + 1);
      } else if (stats.isFile()) {
        if (stats.nlink !== 1n) fail(`loaded Setfarm finalized file link count is invalid: ${locator}`);
        const observed = readStableRegular(target, { device: stats.dev, linkCounts: [1], maxBytes: MAX_FILE_BYTES_V1 });
        totalBytes += observed.bytes.length;
        if (totalBytes > MAX_TOTAL_BYTES_V1) fail("loaded Setfarm finalized files exceed the byte cap");
        files.set(locator, observed);
      } else fail(`loaded Setfarm finalized member type is invalid: ${locator}`);
    }
  }
  visit(distRoot, "", 0);
  directories.sort(compareBytes);
  if (canonicalJsonV1(directories) !== canonicalJsonV1(historical.directories)) fail("loaded Setfarm finalized directory inventory is not exact");
  const expectedFiles = [...historical.outputs, "dist/BUILD_INFO.json", "dist/PLATFORM_BUILD_OUTPUT_TREE.json", "dist/PLATFORM_RELEASE_MANIFEST.json"].sort(compareBytes);
  if (canonicalJsonV1([...files.keys()].sort(compareBytes)) !== canonicalJsonV1(expectedFiles)) fail("loaded Setfarm finalized file inventory is not exact");
  const outputEntries = historical.outputs.map((locator) => {
    const observed = files.get(locator);
    const expectedMode = locator === "dist/cli/cli.js" ? 0o755 : 0o644;
    if (!observed || observed.mode !== expectedMode) fail(`loaded Setfarm ordinary output mode is invalid: ${locator}`);
    return Object.freeze({ locator, mode: expectedMode, byteLength: observed.bytes.length, sha256: sha256(observed.bytes) });
  });
  const buildInfoObserved = files.get("dist/BUILD_INFO.json");
  const outputTreeObserved = files.get("dist/PLATFORM_BUILD_OUTPUT_TREE.json");
  const manifestObserved = files.get("dist/PLATFORM_RELEASE_MANIFEST.json");
  if ([buildInfoObserved, outputTreeObserved, manifestObserved].some((observed) => observed.mode !== 0o444)) fail("loaded Setfarm terminal authority mode is invalid");
  const buildInfo = parseFinalizedJsonV1(buildInfoObserved, ["sha", "shortSha", "branch", "dirty", "packageVersion", "displayVersion", "builtAt"], "loaded Setfarm BUILD_INFO", true);
  if (
    buildInfo.sha !== expectedSourceBuild.sha || buildInfo.shortSha !== expectedSourceBuild.sha.slice(0, 8)
    || buildInfo.branch !== "main" || buildInfo.dirty !== false || buildInfo.packageVersion !== historical.packageVersion
    || buildInfo.displayVersion !== `${historical.packageVersion}+${expectedSourceBuild.sha.slice(0, 8)}`
    || typeof buildInfo.builtAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(buildInfo.builtAt)
    || new Date(buildInfo.builtAt).toISOString() !== buildInfo.builtAt
  ) fail("loaded Setfarm BUILD_INFO fields are invalid");
  const outputTree = parseFinalizedJsonV1(outputTreeObserved, ["schema", "sourceSha", "sourceTreeHash", "entries", "outputTreeHash"], "loaded Setfarm output tree", false);
  if (
    outputTree.schema !== "setfarm.platform-build-output-tree.v1" || outputTree.sourceSha !== expectedSourceBuild.sha
    || outputTree.sourceTreeHash !== expectedSourceBuild.treeHash || !Array.isArray(outputTree.entries)
    || canonicalJsonV1(outputTree.entries) !== canonicalJsonV1(outputEntries)
  ) fail("loaded Setfarm output tree fields or inventory are invalid");
  for (const entry of outputTree.entries) if (!entry || canonicalJsonV1(Object.keys(entry)) !== canonicalJsonV1(["locator", "mode", "byteLength", "sha256"])) fail("loaded Setfarm output-tree entry shape is invalid");
  const outputProjection = { schema: outputTree.schema, sourceSha: outputTree.sourceSha, sourceTreeHash: outputTree.sourceTreeHash, entries: outputTree.entries };
  if (outputTree.outputTreeHash !== hashCanonicalJsonV1(outputProjection)) fail("loaded Setfarm output-tree hash is invalid");
  const manifest = parseFinalizedJsonV1(manifestObserved, ["schema", "releaseSha", "branch", "dirty", "stitchConverter"], "loaded Setfarm release manifest", false);
  const expectedManifest = {
    schema: "setfarm.platform-release-manifest.v1",
    releaseSha: expectedSourceBuild.sha,
    branch: "main",
    dirty: false,
    stitchConverter: {
      converterId: "setfarm.stitch-to-jsx",
      source: {
        schema: "setfarm.source-artifact-ref.v1",
        hash: sha256(historical.stitchBytes),
        mediaType: "text/javascript",
        locator: "scripts/stitch-to-jsx.mjs",
        byteLength: historical.stitchBytes.length,
      },
    },
  };
  if (canonicalJsonV1(manifest) !== canonicalJsonV1(expectedManifest)) fail("loaded Setfarm release manifest differs from historical Git authority");
  const stableBuildInfo = {
    schema: "setfarm.internal-production-stable-setfarm-build-info.v1",
    sha: buildInfo.sha,
    shortSha: buildInfo.shortSha,
    branch: buildInfo.branch,
    dirty: buildInfo.dirty,
    packageVersion: buildInfo.packageVersion,
    displayVersion: buildInfo.displayVersion,
  };
  const buildHash = hashCanonicalJsonV1({
    schema: "setfarm.internal-production-controller-build.v1",
    stableBuildInfo,
    buildInputSetHash: historical.buildInputSetHash,
    outputTreeHash: outputTree.outputTreeHash,
    releaseManifestHash: hashCanonicalJsonV1(manifest),
  });
  if (buildHash !== expectedSourceBuild.buildHash) fail("loaded Setfarm controller build hash differs from the operation-frozen authority");
  const entryLocator = path.relative(root, entrypointRealpath).split(path.sep).join("/");
  const entry = outputEntries.find((candidate) => candidate.locator === entryLocator);
  const entryObserved = files.get(entryLocator);
  if (!entry || !entryObserved || entry.mode !== entryObserved.mode || entry.byteLength !== entryObserved.bytes.length || entry.sha256 !== sha256(entryObserved.bytes)) {
    fail("loaded Setfarm entrypoint is not an exact output-tree member");
  }
  return Object.freeze({ sha: expectedSourceBuild.sha, treeHash: expectedSourceBuild.treeHash, buildHash });
}

function observeActualMissionControlRuntimeSourceV1(operationalToken, expectedSource, pid) {
  if (typeof operationalToken !== "string" || operationalToken.length < 32) {
    fail("Mission Control operational token is unavailable", "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED");
  }
  let bytes;
  try {
    bytes = requireSuccessfulChild(fixedChildResult(
      process.execPath,
      ["--input-type=module", "--eval", MISSION_CONTROL_LOADED_BUILD_OBSERVER_PROGRAM_V1],
      { input: Buffer.from(operationalToken, "utf8") },
    ), "loaded Mission Control startup authority");
  } catch {
    fail("Mission Control loaded-build endpoint is unavailable", "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED");
  }
  const text = strictUtf8V1(bytes, "loaded Mission Control startup authority");
  let response;
  try { response = JSON.parse(text); } catch { fail("Mission Control loaded-build response is invalid", "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED"); }
  const startup = response?.startupInstance;
  const loadedBuild = response?.loadedBuild;
  const identity = loadedBuild?.buildIdentity;
  const loadedBuildHash = loadedBuild ? hashCanonicalJsonV1(loadedBuild) : null;
  if (
    !response || !hasExactKeys(response, ["schema", "loadedBuildRef", "loadedBuildHash", "startupInstance", "loadedBuild"])
    || response.schema !== "mission-control.product-build-authority-v2-loaded-build-response.v1"
    || !startup || !hasExactKeys(startup, ["schema", "pid", "instanceId"])
    || startup.schema !== "mission-control.product-build-authority-v2-startup-instance.v1" || startup.pid !== pid || !UUID_V4.test(startup.instanceId)
    || !loadedBuild || !hasExactKeys(loadedBuild, ["schema", "entryModulePath", "entryModuleHash", "buildIdentity", "buildIdentityHash"])
    || loadedBuild.schema !== "mission-control.product-build-authority-v2-loaded-build.v1"
    || loadedBuild.entryModulePath !== "dist-server/services/product-build-authority-v2-delivery-evidence-v1.js"
    || !SHA256.test(loadedBuild.entryModuleHash) || !identity || !hasExactKeys(identity, ["schema", "sourceSha", "treeHash", "buildHash"])
    || identity.schema !== "mission-control.internal-production-build-identity.v1" || !GIT_HASH.test(identity.sourceSha)
    || !GIT_HASH.test(identity.treeHash) || !SHA256.test(identity.buildHash) || loadedBuild.buildIdentityHash !== missionControlBuildIdentityBytesHashV1(identity)
    || response.loadedBuildHash !== loadedBuildHash
    || response.loadedBuildRef !== `mission-control://internal-production/product-build-authority-v2-loaded-build/sha256/${loadedBuildHash}`
    || identity.sourceSha !== expectedSource?.sha || identity.treeHash !== expectedSource?.treeHash || identity.buildHash !== expectedSource?.buildHash
  ) fail("Mission Control loaded-build response is crossed or invalid", "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED");
  return Object.freeze({ response, source: expectedSource });
}

function parseMissionControlListenerV1(bytes, expectedPid) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > RUNTIME_OBSERVER_MAX_BUFFER_BYTES_V1) {
    fail("Mission Control listener bytes are invalid", "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED");
  }
  const text = strictUtf8V1(bytes, "Mission Control listener", true);
  const match = /^p([1-9][0-9]*)\0c([^\0\n]+)\0\nf(0|[1-9][0-9]*)\0n([^\0\n]+)\0\n$/.exec(text);
  const pid = match ? Number(match[1]) : NaN;
  const fileDescriptor = match ? Number(match[3]) : NaN;
  if (!match || !Number.isSafeInteger(pid) || pid !== expectedPid || !Number.isSafeInteger(fileDescriptor)
    || !["127.0.0.1:3080", "[::1]:3080", "*:3080"].includes(match[4])) {
    fail("Mission Control listener bytes are ambiguous or crossed", "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED");
  }
  return Object.freeze({ pid, command: match[2], fileDescriptor, endpoint: match[4] });
}

function observeMissionControlListenerV1(expectedPid) {
  let bytes;
  try {
    bytes = requireSuccessfulChild(fixedChildResult(
      LSOF_REFERENCE_OBSERVER_EXECUTABLE_V1,
      ["-nP", "-iTCP:3080", "-sTCP:LISTEN", "-F0pcfn"],
    ), "Mission Control listener");
  } catch {
    fail("Mission Control listener proof is unavailable", "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED");
  }
  return Object.freeze({ ...parseMissionControlListenerV1(bytes, expectedPid), bytesHash: sha256(bytes) });
}

function observeLoadedExecutableTextV1(pid, authenticatedExecutableRealpath, label) {
  if (!Number.isSafeInteger(pid) || pid < 1 || typeof authenticatedExecutableRealpath !== "string" || !path.isAbsolute(authenticatedExecutableRealpath)
    || realpathSync(authenticatedExecutableRealpath) !== authenticatedExecutableRealpath) {
    fail(`${label} executable authority is invalid`);
  }
  const bytes = requireSuccessfulChild(fixedChildResult(
    LSOF_REFERENCE_OBSERVER_EXECUTABLE_V1,
    ["-a", "-p", String(pid), "-d", "txt", "-F0pn", authenticatedExecutableRealpath],
  ), `${label} executable observation`);
  const expected = Buffer.from(`p${pid}\0\nftxt\0n${authenticatedExecutableRealpath}\0\n`, "utf8");
  if (!bytes.equals(expected)) fail(`${label} executable observation is crossed`);
  return bytes;
}

function observeLoadedProcessV1(pid, loadedArguments, expectedIdentity, deferAfter = false) {
  if (!Array.isArray(loadedArguments) || loadedArguments.length === 0 || loadedArguments.some((argument) => typeof argument !== "string" || argument === "" || /[\0\r\n]/.test(argument))) {
    fail("loaded process arguments are invalid");
  }
  const before = observeProcessIdentityV1(pid, expectedIdentity);
  if (before.state !== "live_match") fail("loaded process identity is unavailable");
  const executableRealpath = realpathSync(loadedArguments[0]);
  const lsofBytes = observeLoadedExecutableTextV1(pid, executableRealpath, "loaded process");
  const commBytes = requireSuccessfulChild(fixedChildResult(
    PROCESS_IDENTITY_EXECUTABLE_V1,
    ["-ww", "-p", String(pid), "-o", "comm="],
  ), "loaded process comm observation");
  const commText = strictUtf8V1(commBytes, "loaded process comm");
  if (!commText.endsWith("\n") || commText.slice(0, -1).includes("\n")) fail("loaded process comm output is ambiguous");
  const observedComm = commText.slice(0, -1);
  if (!/^[!-~]+$/.test(observedComm)) fail("loaded process comm is not a visible ASCII token");
  const commMatches = observedComm === path.basename(executableRealpath)
    || (path.isAbsolute(observedComm) && realpathSync(observedComm) === executableRealpath);
  if (!commMatches) fail("loaded process comm differs from its executable");
  const commandBytes = requireSuccessfulChild(fixedChildResult(
    PROCESS_IDENTITY_EXECUTABLE_V1,
    ["-ww", "-p", String(pid), "-o", "command="],
  ), "loaded process argv observation");
  const commandText = commandBytes.toString("utf8");
  if (!Buffer.from(commandText, "utf8").equals(commandBytes) || !commandText.endsWith("\n") || commandText.slice(0, -1).includes("\n")) fail("loaded process argv output is ambiguous");
  if (loadedArguments.some((argument) => !/^[!-~]+$/.test(argument) || /["'\\]/.test(argument))) fail("loaded process argv cannot be represented losslessly as visible ASCII by the fixed observer");
  const executableName = path.basename(executableRealpath);
  const observedCommand = commandText.slice(0, -1);
  const observedArguments = observedCommand.split(" ");
  const observedExecutable = observedArguments[0];
  const executableTokenMatches = observedExecutable === executableName
    || (path.isAbsolute(observedExecutable) && realpathSync(observedExecutable) === executableRealpath);
  let entrypoint;
  if (
    executableTokenMatches
    && canonicalJsonV1(observedArguments.slice(1)) === canonicalJsonV1(loadedArguments.slice(1))
    && realpathSync(loadedArguments[0]) === executableRealpath
  ) {
    if (loadedArguments.length < 2) fail("loaded process has no application entrypoint");
    entrypoint = loadedArguments[1];
  } else if (executableTokenMatches && canonicalJsonV1(observedArguments.slice(1)) === canonicalJsonV1(loadedArguments)) entrypoint = loadedArguments[0];
  else fail("loaded process argv differs from launchctl");
  const entrypointRealpath = realpathSync(entrypoint);
  const after = deferAfter ? before : observeProcessIdentityV1(pid, before);
  if (!deferAfter && after.state !== "live_match") fail("loaded process identity drifted during observation");
  return Object.freeze({
    processLstart: before.processLstart,
    processGroupId: before.processGroupId,
    executableRealpath,
    entrypointRealpath,
    commHash: sha256(commBytes),
    commandHash: sha256(commandBytes),
    lsofHash: sha256(lsofBytes),
    lsofBytes,
    processBeforeHash: before.observationHash,
    processAfterHash: deferAfter ? null : after.observationHash,
  });
}

function detachedSetfarmServiceProfileV1(label) {
  const program = path.join(CODE_OWNER_HOME_V1, ".local", "bin", "setfarm");
  const root = repositoryRootV1();
  if (label === "com.setrox.setfarm-spawner") {
    return Object.freeze({
      label,
      launchArguments: Object.freeze([program, "spawner", "start"]),
      entrypoint: path.join(root, "dist", "spawner.js"),
      daemonArguments: Object.freeze([]),
      port: null,
    });
  }
  if (label === "com.setrox.setfarm-dashboard") {
    return Object.freeze({
      label,
      launchArguments: Object.freeze([program, "dashboard", "start", "--port", "3333"]),
      entrypoint: path.join(root, "dist", "server", "daemon.js"),
      daemonArguments: Object.freeze(["3333"]),
      port: 3333,
    });
  }
  fail("detached Setfarm service label is invalid");
}

function oneDetachedLaunchctlScalarV1(text, name, label) {
  const matches = [...text.matchAll(new RegExp(`^\\t${escapeRegex(name)} = (.+)$`, "gm"))];
  if (matches.length !== 1 || !matches[0][1]) fail(`${label} launchctl ${name} is ambiguous`);
  return matches[0][1];
}

function oneDetachedLaunchctlBlockV1(text, name, label) {
  const matches = [...text.matchAll(new RegExp(`^\\t${escapeRegex(name)} = \\{\\n([\\s\\S]*?)^\\t\\}$`, "gm"))];
  if (matches.length !== 1) fail(`${label} launchctl ${name} is ambiguous`);
  const lines = matches[0][1].split("\n");
  if (lines.pop() !== "" || lines.length === 0 || lines.some((line) => line === "" || !line.startsWith("\t\t"))) fail(`${label} launchctl ${name} is malformed`);
  return Object.freeze(lines.map((line) => line.slice(2)));
}

function detachedLaunchctlEnvironmentBlockV1(text, name, label, expectedNames) {
  const environment = {};
  for (const line of oneDetachedLaunchctlBlockV1(text, name, label)) {
    const match = /^([A-Za-z][A-Za-z0-9_]*) => (.+)$/.exec(line);
    if (!match || Object.prototype.hasOwnProperty.call(environment, match[1])) fail(`${label} launchctl ${name} is malformed`);
    environment[match[1]] = match[2];
  }
  if (canonicalJsonV1(Object.keys(environment)) !== canonicalJsonV1(expectedNames)) fail(`${label} launchctl ${name} order is invalid`);
  return Object.freeze(environment);
}

function observeDetachedLaunchProjectionV1(profile, config, uid) {
  const bytes = requireSuccessfulChild(fixedChildResult(
    LAUNCHCTL_EXECUTABLE_V1,
    ["print", `gui/${uid}/${profile.label}`],
  ), `launchctl ${profile.label}`);
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > RUNTIME_OBSERVER_MAX_BUFFER_BYTES_V1 || bytes.includes(0) || bytes.at(-1) !== 0x0a) {
    fail(`${profile.label} launchctl output bytes are invalid`);
  }
  const text = strictUtf8V1(bytes, `${profile.label} launchctl`);
  if (!text.startsWith(`gui/${uid}/${profile.label} = {\n`) || !text.endsWith("}\n")) fail(`${profile.label} launchctl envelope is invalid`);
  const selectedRecords = [
    ["scalar", "active count"], ["scalar", "path"], ["scalar", "type"], ["scalar", "state"], ["scalar", "program"],
    ["block", "arguments"], ["scalar", "stdout path"], ["scalar", "stderr path"], ["block", "inherited environment"],
    ["block", "default environment"], ["block", "environment"], ["scalar", "run interval"], ["scalar", "properties"],
  ];
  let selectedOffset = -1;
  for (const [kind, name] of selectedRecords) {
    const pattern = kind === "scalar"
      ? new RegExp(`^\\t${escapeRegex(name)} = .+$`, "gm")
      : new RegExp(`^\\t${escapeRegex(name)} = \\{$`, "gm");
    const matches = [...text.matchAll(pattern)];
    if (matches.length !== 1 || matches[0].index <= selectedOffset) fail(`${profile.label} launchctl selected record order is invalid`);
    selectedOffset = matches[0].index;
  }
  const state = oneDetachedLaunchctlScalarV1(text, "state", profile.label);
  const activeCount = oneDetachedLaunchctlScalarV1(text, "active count", profile.label);
  const type = oneDetachedLaunchctlScalarV1(text, "type", profile.label);
  if ((state !== "not running" && state !== "spawn scheduled") || activeCount !== "0" || type !== "LaunchAgent" || /^\tpid = /m.test(text)) {
    fail(`${profile.label} launcher is not in its stable detached state`);
  }
  if (oneDetachedLaunchctlScalarV1(text, "path", profile.label) !== config.locator
    || oneDetachedLaunchctlScalarV1(text, "program", profile.label) !== profile.launchArguments[0]
    || oneDetachedLaunchctlScalarV1(text, "stdout path", profile.label) !== profile.stdoutPath
    || oneDetachedLaunchctlScalarV1(text, "stderr path", profile.label) !== profile.stderrPath
    || oneDetachedLaunchctlScalarV1(text, "run interval", profile.label) !== "60 seconds"
    || !["runatload | inferred program", "runatload | penalty box | inferred program"].includes(oneDetachedLaunchctlScalarV1(text, "properties", profile.label))
    || /^\tworking directory = /m.test(text)) {
    fail(`${profile.label} loaded launcher projection is crossed`);
  }
  const programArguments = oneDetachedLaunchctlBlockV1(text, "arguments", profile.label);
  if (canonicalJsonV1(programArguments) !== canonicalJsonV1(profile.launchArguments)) fail(`${profile.label} loaded arguments differ from the fixed launcher profile`);
  const environmentOrder = profile.label === "com.setrox.setfarm-dashboard"
    ? ["OSLogRateLimit", "SETFARM_OPERATIONAL_WRITE_TOKEN", "PATH", "SETFARM_PG_URL", "XPC_SERVICE_NAME"]
    : ["OSLogRateLimit", "PATH", "SETFARM_PG_URL", "XPC_SERVICE_NAME"];
  const environmentRecord = detachedLaunchctlEnvironmentBlockV1(text, "environment", profile.label, environmentOrder);
  if (!hasExactKeys(environmentRecord, environmentOrder)
    || environmentRecord.OSLogRateLimit !== "64" || environmentRecord.XPC_SERVICE_NAME !== profile.label) {
    fail(`${profile.label} loaded launch environment is invalid`);
  }
  const inheritedEnvironment = detachedLaunchctlEnvironmentBlockV1(text, "inherited environment", profile.label, ["SETFARM_ENV_DIR", "SSH_AUTH_SOCK"]);
  const expectedScripts = path.join(CODE_OWNER_HOME_V1, "ai", "setrox", "setfarm", "scripts");
  if (!hasExactKeys(inheritedEnvironment, ["SETFARM_ENV_DIR", "SSH_AUTH_SOCK"])
    || inheritedEnvironment.SETFARM_ENV_DIR !== expectedScripts
    || !/^\/var\/run\/com\.apple\.launchd\.[A-Za-z0-9]+\/Listeners$/.test(inheritedEnvironment.SSH_AUTH_SOCK ?? "")) {
    fail(`${profile.label} inherited launch environment is invalid`);
  }
  const defaultEnvironment = detachedLaunchctlEnvironmentBlockV1(text, "default environment", profile.label, ["PATH"]);
  if (!hasExactKeys(defaultEnvironment, ["PATH"]) || defaultEnvironment.PATH !== PROCESS_ENV_V1.PATH) fail(`${profile.label} default launch environment is invalid`);
  const environment = Object.freeze(config.environmentNames.map((name) => {
    if (typeof environmentRecord[name] !== "string" || environmentRecord[name] === "") fail(`${profile.label} loaded environment is missing ${name}`);
    return Object.freeze([name, environmentRecord[name]]);
  }));
  return Object.freeze({ bytes, state, activeCount: 0, programArguments, environment });
}

function observeDetachedLaunchPlistV1(profile, config) {
  const observed = readStableRegular(config.locator, { linkCounts: [1], maxBytes: MAX_AUTHORITY_BYTES_V1 });
  const uid = process.getuid?.();
  if (!Number.isSafeInteger(uid) || observed.stats.uid !== BigInt(uid) || (modeOf(observed.stats) & 0o022) !== 0) fail(`${profile.label} plist ownership is invalid`);
  const plist = parsePlutilJsonV1(
    requireSuccessfulChild(fixedChildResult(PLUTIL_EXECUTABLE_V1, ["-convert", "json", "-o", "-", "-"], { input: observed.bytes }), `plist ${profile.label}`),
    `plist ${profile.label}`,
  );
  if (!hasExactKeys(plist, ["EnvironmentVariables", "Label", "ProgramArguments", "RunAtLoad", "StandardErrorPath", "StandardOutPath", "StartInterval"])) fail(`${profile.label} plist keys are invalid`);
  if (plist.Label !== profile.label || Object.prototype.hasOwnProperty.call(plist, "Program")) fail(`${profile.label} plist label/program is crossed`);
  if (canonicalJsonV1(plist.ProgramArguments) !== canonicalJsonV1(profile.launchArguments)) fail(`${profile.label} plist arguments are crossed`);
  if (plist.RunAtLoad !== true || plist.StartInterval !== 60) fail(`${profile.label} plist schedule is crossed`);
  if (plist.StandardOutPath !== profile.stdoutPath || plist.StandardErrorPath !== profile.stderrPath) fail(`${profile.label} plist log paths are crossed`);
  if (!plist.EnvironmentVariables || Object.getPrototypeOf(plist.EnvironmentVariables) !== Object.prototype
    || !hasExactKeys(plist.EnvironmentVariables, config.environmentNames)) fail(`${profile.label} plist environment is invalid`);
  for (const name of config.environmentNames) if (typeof plist.EnvironmentVariables[name] !== "string" || plist.EnvironmentVariables[name] === "") fail(`${profile.label} plist environment value is invalid`);
  return Object.freeze({ observed, plist });
}

function sameObservedRegularV1(left, right) {
  return left.bytes.equals(right.bytes)
    && left.stats.dev === right.stats.dev && left.stats.ino === right.stats.ino && left.stats.mode === right.stats.mode
    && left.stats.nlink === right.stats.nlink && left.stats.size === right.stats.size
    && left.stats.mtimeNs === right.stats.mtimeNs && left.stats.ctimeNs === right.stats.ctimeNs;
}

function observeDetachedCliLinkV1(profile, uid) {
  const stats = lstatSync(profile.launchArguments[0], { bigint: true });
  if (!stats.isSymbolicLink() || stats.nlink !== 1n || stats.uid !== BigInt(uid)) fail(`${profile.label} launcher link is invalid`);
  const target = readlinkSync(profile.launchArguments[0]);
  const realpath = realpathSync(profile.launchArguments[0]);
  if (realpath !== path.join(repositoryRootV1(), "dist", "cli", "cli.js")) fail(`${profile.label} launcher link target is crossed`);
  const targetObserved = readStableRegular(realpath, { linkCounts: [1], maxBytes: MAX_FILE_BYTES_V1 });
  return Object.freeze({ stats, target, realpath, targetObserved });
}

function sameDetachedCliLinkV1(left, right) {
  return left.target === right.target && left.realpath === right.realpath && sameObservedRegularV1(left.targetObserved, right.targetObserved)
    && left.stats.dev === right.stats.dev && left.stats.ino === right.stats.ino && left.stats.mode === right.stats.mode
    && left.stats.nlink === right.stats.nlink && left.stats.uid === right.stats.uid && left.stats.size === right.stats.size
    && left.stats.mtimeNs === right.stats.mtimeNs && left.stats.ctimeNs === right.stats.ctimeNs;
}

function parseDetachedPhysicalProcessesV1(bytes) {
  const text = strictUtf8V1(bytes, "detached Setfarm process inventory");
  if (!text.endsWith("\n") || text.includes("\0")) fail("detached Setfarm process inventory is malformed");
  const lines = text.slice(0, -1).split("\n");
  if (lines.some((line) => line === "")) fail("detached Setfarm process inventory contains a blank row");
  if (lines.length > MAX_LEDGER_ORDINALS_V1) fail("detached Setfarm process inventory exceeds its row cap");
  const pids = new Set();
  const processes = lines.map((line) => {
    const match = /^\s*(-2|[0-9]+)\s+([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+(\S+)\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+[ 0-9][0-9]\s+[0-9]{2}:[0-9]{2}:[0-9]{2}\s+[0-9]{4})\s+(.+)$/.exec(line);
    if (!match) fail("detached Setfarm process row is malformed");
    const [uid, pid, ppid, pgid] = match.slice(1, 5).map(Number);
    if (![uid, pid, ppid, pgid].every(Number.isSafeInteger) || (uid < 0 && uid !== -2) || pid < 1 || ppid < 0 || pgid < 0 || pids.has(pid)) {
      fail("detached Setfarm process identity is invalid");
    }
    pids.add(pid);
    return Object.freeze({ uid, pid, ppid, pgid, stat: match[5], lstart: match[6], command: match[7] });
  });
  return Object.freeze(processes.sort((left, right) => left.pid - right.pid));
}

function observeDetachedListenersV1(profile, pid) {
  const network = profile.port === null ? "-iTCP" : `-iTCP@127.0.0.1:${profile.port}`;
  const result = fixedChildResult(LSOF_REFERENCE_OBSERVER_EXECUTABLE_V1, ["-nP", "-a", "-p", String(pid), network, "-sTCP:LISTEN", "-F0pcfn"]);
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? "");
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.from(result.stderr ?? "");
  if (result.error || result.signal !== null || ![0, 1].includes(result.status) || stderr.length !== 0) fail(`${profile.label} listener observation failed`);
  if (result.status === 1) {
    if (stdout.length !== 0) fail(`${profile.label} empty listener observation has output`);
    return Object.freeze({ status: 1, bytes: stdout, listeners: Object.freeze([]) });
  }
  const text = strictUtf8V1(stdout, `${profile.label} listener`, true);
  const matches = [...text.matchAll(/(?:^|\n)p([1-9][0-9]*)\0c([^\0\n]+)\0\n(?:f(?:0|[1-9][0-9]*)\0n([^\0\n]+)\0\n)+/g)];
  if (matches.length !== 1 || matches[0][0].length !== text.length || Number(matches[0][1]) !== pid) fail(`${profile.label} listener inventory is ambiguous`);
  const endpoints = [...text.matchAll(/f(?:0|[1-9][0-9]*)\0n([^\0\n]+)\0\n/g)].map((match) => match[1]);
  return Object.freeze({ status: 0, bytes: stdout, listeners: Object.freeze(endpoints) });
}

function observeDetachedSetfarmProcessV1(profile, expectedSetfarmSourceBuild, candidate, quarantine) {
  const uid = process.getuid?.();
  if (!Number.isSafeInteger(uid) || uid < 0) fail("runtime UID is invalid");
  const nodeExecutable = realpathSync(process.execPath);
  const expectedCommand = [nodeExecutable, profile.entrypoint, ...profile.daemonArguments].join(" ");
  const inventoryBeforeBytes = requireSuccessfulChild(fixedChildResult(PROCESS_IDENTITY_EXECUTABLE_V1, ["-axo", "uid=,pid=,ppid=,pgid=,stat=,lstart=,command="]), `${profile.label} process inventory`);
  const inventoryBefore = parseDetachedPhysicalProcessesV1(inventoryBeforeBytes);
  const familyBefore = inventoryBefore.filter((item) => item.command.split(" ").includes(profile.entrypoint));
  if (familyBefore.length !== 1) fail(`${profile.label} detached daemon family count is not exactly one`);
  const processBefore = familyBefore[0];
  if (processBefore.uid !== uid || processBefore.ppid !== 1 || processBefore.pgid !== processBefore.pid || processBefore.stat.includes("Z") || processBefore.command !== expectedCommand) {
    fail(`${profile.label} detached daemon identity is invalid`);
  }
  if (!Number.isSafeInteger(Date.parse(processBefore.lstart)) || Date.parse(processBefore.lstart) < 1) fail(`${profile.label} detached daemon start is invalid`);
  const commBefore = requireSuccessfulChild(fixedChildResult(PROCESS_IDENTITY_EXECUTABLE_V1, ["-ww", "-p", String(processBefore.pid), "-o", "comm="]), `${profile.label} daemon executable`);
  if (!commBefore.equals(Buffer.from(`${nodeExecutable}\n`, "utf8"))) fail(`${profile.label} detached daemon executable is crossed`);
  const commandBefore = requireSuccessfulChild(fixedChildResult(PROCESS_IDENTITY_EXECUTABLE_V1, ["-ww", "-p", String(processBefore.pid), "-o", "command="]), `${profile.label} daemon command`);
  if (!commandBefore.equals(Buffer.from(`${expectedCommand}\n`, "utf8"))) fail(`${profile.label} detached daemon command is crossed`);
  const txtBefore = observeLoadedExecutableTextV1(processBefore.pid, nodeExecutable, `${profile.label} daemon`);
  const listenersBefore = observeDetachedListenersV1(profile, processBefore.pid);
  if (profile.port === null
    ? listenersBefore.status !== 1 || listenersBefore.listeners.length !== 0
    : listenersBefore.status !== 0 || listenersBefore.listeners.length !== 1 || listenersBefore.listeners[0] !== `127.0.0.1:${profile.port}`) {
    fail(`${profile.label} detached daemon listener identity is invalid`);
  }
  if (isWithinLocator(candidate, nodeExecutable) || isWithinLocator(quarantine, nodeExecutable)
    || isWithinLocator(candidate, profile.entrypoint) || isWithinLocator(quarantine, profile.entrypoint)) fail(`${profile.label} actual process references the retained generation`);
  const loadedSource = observeActualSetfarmRuntimeSourceV1(profile.entrypoint, expectedSetfarmSourceBuild);
  const inventoryAfterBytes = requireSuccessfulChild(fixedChildResult(PROCESS_IDENTITY_EXECUTABLE_V1, ["-axo", "uid=,pid=,ppid=,pgid=,stat=,lstart=,command="]), `${profile.label} process inventory after source`);
  const inventoryAfter = parseDetachedPhysicalProcessesV1(inventoryAfterBytes);
  const familyAfter = inventoryAfter.filter((item) => item.command.split(" ").includes(profile.entrypoint));
  if (familyAfter.length !== 1 || canonicalJsonV1(familyAfter[0]) !== canonicalJsonV1(processBefore)) fail(`${profile.label} detached daemon changed during observation`);
  const commAfter = requireSuccessfulChild(fixedChildResult(PROCESS_IDENTITY_EXECUTABLE_V1, ["-ww", "-p", String(processBefore.pid), "-o", "comm="]), `${profile.label} daemon executable after source`);
  const commandAfter = requireSuccessfulChild(fixedChildResult(PROCESS_IDENTITY_EXECUTABLE_V1, ["-ww", "-p", String(processBefore.pid), "-o", "command="]), `${profile.label} daemon command after source`);
  const txtAfter = observeLoadedExecutableTextV1(processBefore.pid, nodeExecutable, `${profile.label} daemon after source`);
  const listenersAfter = observeDetachedListenersV1(profile, processBefore.pid);
  if (!commAfter.equals(commBefore) || !commandAfter.equals(commandBefore) || !txtAfter.equals(txtBefore)
    || !listenersAfter.bytes.equals(listenersBefore.bytes) || canonicalJsonV1(listenersAfter.listeners) !== canonicalJsonV1(listenersBefore.listeners)
  ) {
    fail(`${profile.label} detached daemon authority changed during observation`);
  }
  return Object.freeze({
    pid: processBefore.pid,
    processLstart: processBefore.lstart,
    processGroupId: processBefore.pgid,
    executableRealpath: nodeExecutable,
    entrypointRealpath: profile.entrypoint,
    commHash: sha256(commBefore),
    commandHash: sha256(commandBefore),
    lsofHash: sha256(txtBefore),
    loadedSource,
  });
}

function observeDetachedLaunchAgentConfigBodyV1(config, expectedRuntimeSource, candidate, quarantine) {
  const profileBase = detachedSetfarmServiceProfileV1(config.label);
  const logBase = path.join(CODE_OWNER_HOME_V1, ".openclaw", "logs", config.label === "com.setrox.setfarm-spawner" ? "setfarm-spawner.watch" : "setfarm-dashboard.watch");
  const profile = Object.freeze({ ...profileBase, stdoutPath: `${logBase}.log`, stderrPath: `${logBase}.err.log` });
  const uid = process.getuid?.();
  if (!Number.isSafeInteger(uid) || uid < 0) fail("runtime UID is invalid");
  const plistBefore = observeDetachedLaunchPlistV1(profile, config);
  const cliBefore = observeDetachedCliLinkV1(profile, uid);
  const entryBefore = readStableRegular(profile.entrypoint, { linkCounts: [1], maxBytes: MAX_FILE_BYTES_V1 });
  const launchBefore = observeDetachedLaunchProjectionV1(profile, config, uid);
  for (const [name, value] of launchBefore.environment) if (value !== plistBefore.plist.EnvironmentVariables[name]) fail(`${config.label} loaded environment differs from plist`);
  const environment = Object.freeze(config.environmentNames.map((name, ordinal) => redactedEnvironmentEntryV1(name, plistBefore.plist.EnvironmentVariables[name], ordinal, "/", candidate, quarantine)));
  const pathResolutionCommitments = Object.freeze([
    nonsecretCommitmentV1("effective_program", null, 0, profile.launchArguments[0], "/", candidate, quarantine),
    ...profile.launchArguments.map((argument, ordinal) => nonsecretCommitmentV1("argument", null, ordinal, argument, "/", candidate, quarantine)),
    ...environment.map((entry) => entry.classificationCommitment),
  ]);
  const loadedEnvironment = Object.freeze(launchBefore.environment.map(([name, value], ordinal) => redactedEnvironmentEntryV1(name, value, ordinal, "/", candidate, quarantine)));
  const loadedPathResolutionCommitments = Object.freeze([
    nonsecretCommitmentV1("effective_program", null, 0, profile.launchArguments[0], "/", candidate, quarantine),
    ...profile.launchArguments.map((argument, ordinal) => nonsecretCommitmentV1("argument", null, ordinal, argument, "/", candidate, quarantine)),
    ...loadedEnvironment.map((entry) => entry.classificationCommitment),
  ]);
  let expectedSetfarmSourceBuild = expectedRuntimeSource.sourceBody;
  if (expectedRuntimeSource.provenance === "operation_retained_current_setfarm_build") {
    assertRetainedCurrentBuildV1(expectedRuntimeSource.sourceBody);
    expectedSetfarmSourceBuild = Object.freeze({
      branch: "main", clean: true, sha: expectedRuntimeSource.sourceBody.sourceSha,
      treeHash: expectedRuntimeSource.sourceBody.sourceTreeHash, buildHash: expectedRuntimeSource.sourceBody.buildHash,
      originMainSha: expectedRuntimeSource.sourceBody.sourceSha,
    });
  }
  const actualProcess = observeDetachedSetfarmProcessV1(profile, expectedSetfarmSourceBuild, candidate, quarantine);
  const expectedLoadedSource = { sha: expectedRuntimeSource.sourcePair.sourceSha, treeHash: expectedRuntimeSource.sourcePair.sourceTreeHash, buildHash: expectedRuntimeSource.sourcePair.controllerBuildHash };
  if (canonicalJsonV1(actualProcess.loadedSource) !== canonicalJsonV1(expectedLoadedSource)) fail(`${config.label} actual source/build differs from expected authority`);
  const launchAfter = observeDetachedLaunchProjectionV1(profile, config, uid);
  const plistAfter = observeDetachedLaunchPlistV1(profile, config);
  const cliAfter = observeDetachedCliLinkV1(profile, uid);
  const entryAfter = readStableRegular(profile.entrypoint, { linkCounts: [1], maxBytes: MAX_FILE_BYTES_V1 });
  const selectedLaunchProjection = (value) => ({
    state: value.state, activeCount: value.activeCount, programArguments: value.programArguments, environment: value.environment,
  });
  if (!launchAfter.bytes.equals(launchBefore.bytes) || canonicalJsonV1(selectedLaunchProjection(launchAfter)) !== canonicalJsonV1(selectedLaunchProjection(launchBefore))
    || !sameObservedRegularV1(plistBefore.observed, plistAfter.observed) || !sameDetachedCliLinkV1(cliBefore, cliAfter)
    || !sameObservedRegularV1(entryBefore, entryAfter)) fail(`${config.label} launcher authority changed during observation`);
  const loadedProcessBase = {
    pid: actualProcess.pid,
    processLstart: actualProcess.processLstart,
    processGroupId: actualProcess.processGroupId,
    processIdentityHash: hashCanonicalJsonV1({ pid: actualProcess.pid, processLstart: actualProcess.processLstart, processGroupId: actualProcess.processGroupId }),
    executableRealpathHash: sha256(Buffer.from(actualProcess.executableRealpath, "utf8")),
    entrypointRealpathHash: sha256(Buffer.from(actualProcess.entrypointRealpath, "utf8")),
    commHash: actualProcess.commHash,
    commandHash: actualProcess.commandHash,
    lsofHash: actualProcess.lsofHash,
    sourceSha: actualProcess.loadedSource.sha,
    sourceTreeHash: actualProcess.loadedSource.treeHash,
    controllerBuildHash: actualProcess.loadedSource.buildHash,
    missionControlLoadedBuildProof: null,
    serviceGenerationHash: hashCanonicalJsonV1({
      schema: "setfarm.platform-build-generation-loaded-service-generation.v1",
      label: config.label,
      pid: actualProcess.pid,
      processLstart: actualProcess.processLstart,
      processGroupId: actualProcess.processGroupId,
      executableRealpathHash: sha256(Buffer.from(actualProcess.executableRealpath, "utf8")),
      loadedArgumentsHash: hashCanonicalJsonV1(profile.launchArguments),
      entrypointRealpathHash: sha256(Buffer.from(actualProcess.entrypointRealpath, "utf8")),
      commHash: actualProcess.commHash,
      commandHash: actualProcess.commandHash,
      lsofHash: actualProcess.lsofHash,
      sourceSha: actualProcess.loadedSource.sha,
      sourceTreeHash: actualProcess.loadedSource.treeHash,
      controllerBuildHash: actualProcess.loadedSource.buildHash,
    }),
    actualGenerationAuthenticated: true,
  };
  const expectedObservedFieldEqualityHash = hashCanonicalJsonV1({
    schema: "setfarm.platform-build-generation-expected-observed-field-equality.v1",
    label: config.label,
    expectedRuntimeSource,
    loadedProcessObservation: loadedProcessBase,
  });
  const plistProjection = Object.freeze({ program: null, effectiveProgram: profile.launchArguments[0], workingDirectory: null, programArguments: profile.launchArguments, environment, pathResolutionCommitments });
  const loadedJobProjection = Object.freeze({
    program: Object.freeze({ kind: "explicit", reported: profile.launchArguments[0], effective: profile.launchArguments[0] }),
    workingDirectory: Object.freeze({ kind: "absent_launchd_default", reported: null, effective: "/" }),
    programArguments: profile.launchArguments,
    environment: loadedEnvironment,
    pathResolutionCommitments: loadedPathResolutionCommitments,
    loadedProcess: Object.freeze({ ...loadedProcessBase, expectedObservedFieldEqualityHash }),
  });
  const projectionBase = {
    locator: config.locator, label: config.label, launchctlExecutable: LAUNCHCTL_EXECUTABLE_V1, launchctlDomain: `gui/${uid}`,
    expectedRuntimeSource, plistProjection, loadedJobProjection, plistBytesHash: sha256(plistBefore.observed.bytes),
    launchctlBytesHash: sha256(launchBefore.bytes), noCandidateReference: true,
  };
  return Object.freeze({ ...projectionBase, projectionHash: hashCanonicalJsonV1(projectionBase) });
}

function observeLaunchAgentConfigBodyV1(config, expectedRuntimeSource, candidate, quarantine) {
  if (config.label === "com.setrox.setfarm-spawner" || config.label === "com.setrox.setfarm-dashboard") {
    return observeDetachedLaunchAgentConfigBodyV1(config, expectedRuntimeSource, candidate, quarantine);
  }
  const plistObserved = readStableRegular(config.locator, { linkCounts: [1], maxBytes: MAX_AUTHORITY_BYTES_V1 });
  const plist = parsePlutilJsonV1(
    requireSuccessfulChild(fixedChildResult(PLUTIL_EXECUTABLE_V1, ["-convert", "json", "-o", "-", config.locator]), `plist ${config.label}`),
    `plist ${config.label}`,
  );
  if (plist.Label !== config.label || Object.prototype.hasOwnProperty.call(plist, "Program")) fail(`${config.label} plist Program must be absent`);
  if (!Array.isArray(plist.ProgramArguments) || plist.ProgramArguments.length === 0 || plist.ProgramArguments.some((value) => typeof value !== "string" || value === "")) {
    fail(`${config.label} plist arguments are invalid`);
  }
  const workingDirectory = Object.prototype.hasOwnProperty.call(plist, "WorkingDirectory") ? plist.WorkingDirectory : null;
  if (workingDirectory !== config.workingDirectory) fail(`${config.label} plist working directory is invalid`);
  const rawEnvironment = plist.EnvironmentVariables;
  if (!rawEnvironment || Object.getPrototypeOf(rawEnvironment) !== Object.prototype) fail(`${config.label} plist environment is invalid`);
  if (canonicalJsonV1(Object.keys(rawEnvironment).sort(compareBytes)) !== canonicalJsonV1(config.environmentNames)) fail(`${config.label} plist environment names are invalid`);
  const effectiveWorkingDirectory = workingDirectory ?? "/";
  const environment = Object.freeze(config.environmentNames.map((name, ordinal) => (
    redactedEnvironmentEntryV1(name, rawEnvironment[name], ordinal, effectiveWorkingDirectory, candidate, quarantine)
  )));
  const pathResolutionCommitments = Object.freeze([
    nonsecretCommitmentV1("effective_program", null, 0, plist.ProgramArguments[0], effectiveWorkingDirectory, candidate, quarantine),
    ...plist.ProgramArguments.map((argument, ordinal) => nonsecretCommitmentV1("argument", null, ordinal, argument, effectiveWorkingDirectory, candidate, quarantine)),
    ...(workingDirectory === null ? [] : [nonsecretCommitmentV1("working_directory", null, 0, workingDirectory, effectiveWorkingDirectory, candidate, quarantine)]),
    ...environment.map((entry) => entry.classificationCommitment),
  ]);
  const uid = process.getuid?.();
  if (!Number.isSafeInteger(uid) || uid < 0) fail("runtime UID is invalid");
  const launchctlBytes = requireSuccessfulChild(fixedChildResult(
    LAUNCHCTL_EXECUTABLE_V1,
    ["print", `gui/${uid}/${config.label}`],
  ), `launchctl ${config.label}`);
  const loaded = parseLaunchctlPrintV1(launchctlBytes, {
    uid,
    label: config.label,
    expectedPath: config.locator,
    environmentNames: config.environmentNames,
  });
  if (canonicalJsonV1(loaded.programArguments) !== canonicalJsonV1(plist.ProgramArguments)) fail(`${config.label} loaded arguments differ from plist`);
  for (const [name, rawValue] of loaded.environment) {
    if (rawValue !== rawEnvironment[name]) {
      if (config.label === "com.setrox.mission-control" && name === "SETFARM_OPERATIONAL_WRITE_TOKEN") {
        fail("Mission Control operational token differs between plist and loaded job", "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED");
      }
      fail(`${config.label} loaded environment differs from plist`);
    }
  }
  const reportedProgram = loaded.reportedProgram;
  const effectiveProgram = reportedProgram ?? loaded.programArguments[0];
  if (realpathSync(effectiveProgram) !== realpathSync(loaded.programArguments[0]) || realpathSync(effectiveProgram) !== realpathSync(plist.ProgramArguments[0])) {
    fail(`${config.label} loaded Program differs from argument zero`);
  }
  const reportedWorkingDirectory = loaded.reportedWorkingDirectory;
  const loadedWorkingDirectory = reportedWorkingDirectory === null
    ? Object.freeze({ kind: "absent_launchd_default", reported: null, effective: "/" })
    : reportedWorkingDirectory === "/"
      ? Object.freeze({ kind: "reported_launchd_default", reported: "/", effective: "/" })
      : Object.freeze({ kind: "explicit", reported: reportedWorkingDirectory, effective: reportedWorkingDirectory });
  if (config.workingDirectory === null ? loadedWorkingDirectory.effective !== "/" : loadedWorkingDirectory.effective !== config.workingDirectory) {
    fail(`${config.label} loaded working directory is invalid`);
  }
  const loadedEnvironment = Object.freeze(loaded.environment.map(([name, rawValue], ordinal) => (
    redactedEnvironmentEntryV1(name, rawValue, ordinal, loadedWorkingDirectory.effective, candidate, quarantine)
  )));
  const loadedPathResolutionCommitments = Object.freeze([
    nonsecretCommitmentV1("effective_program", null, 0, loaded.programArguments[0], loadedWorkingDirectory.effective, candidate, quarantine),
    ...loaded.programArguments.map((argument, ordinal) => nonsecretCommitmentV1("argument", null, ordinal, argument, loadedWorkingDirectory.effective, candidate, quarantine)),
    ...(loaded.reportedWorkingDirectory === null ? [] : [nonsecretCommitmentV1("working_directory", null, 0, loaded.reportedWorkingDirectory, loadedWorkingDirectory.effective, candidate, quarantine)]),
    ...loadedEnvironment.map((entry) => entry.classificationCommitment),
  ]);
  if (canonicalJsonV1(loadedEnvironment) !== canonicalJsonV1(environment)) fail(`${config.label} loaded environment commitments differ from plist`);
  const actualProcess = observeLoadedProcessV1(loaded.pid, loaded.programArguments, undefined, config.label === "com.setrox.mission-control");
  const { entrypointRealpath } = actualProcess;
  const expectedRoot = config.label === "com.setrox.mission-control" ? MISSION_CONTROL_ROOT_V1 : repositoryRootV1();
  if (!isWithinLocator(expectedRoot, entrypointRealpath)) fail(`${config.label} entrypoint is outside its expected repository`);
  if (
    isWithinLocator(candidate, actualProcess.executableRealpath) || isWithinLocator(quarantine, actualProcess.executableRealpath)
    || isWithinLocator(candidate, entrypointRealpath) || isWithinLocator(quarantine, entrypointRealpath)
  ) fail(`${config.label} actual process references the retained generation`);
  const expectedLoadedSource = config.label === "com.setrox.mission-control"
    ? expectedRuntimeSource.sourceBody.response.evidence.currentSource
    : { sha: expectedRuntimeSource.sourcePair.sourceSha, treeHash: expectedRuntimeSource.sourcePair.sourceTreeHash, buildHash: expectedRuntimeSource.sourcePair.controllerBuildHash };
  const loadedOperationalToken = config.label === "com.setrox.mission-control"
    ? loaded.environment.find(([name]) => name === "SETFARM_OPERATIONAL_WRITE_TOKEN")?.[1]
    : null;
  const listenerBefore = config.label === "com.setrox.mission-control" ? observeMissionControlListenerV1(loaded.pid) : null;
  const actualMissionControl = config.label === "com.setrox.mission-control"
    ? observeActualMissionControlRuntimeSourceV1(loadedOperationalToken, expectedLoadedSource, loaded.pid)
    : null;
  let missionControlLoadedBuildProof = null;
  if (config.label === "com.setrox.mission-control") {
    const launchctlAfterBytes = requireSuccessfulChild(fixedChildResult(
      LAUNCHCTL_EXECUTABLE_V1,
      ["print", `gui/${uid}/${config.label}`],
    ), `launchctl ${config.label} after endpoint`);
    const loadedAfter = parseLaunchctlPrintV1(launchctlAfterBytes, {
      uid,
      label: config.label,
      expectedPath: config.locator,
      environmentNames: config.environmentNames,
    });
    if (!launchctlAfterBytes.equals(launchctlBytes) || canonicalJsonV1(loadedAfter) !== canonicalJsonV1(loaded)) {
      fail("Mission Control launchctl identity drifted", "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED");
    }
    const processAfter = observeProcessIdentityV1(loaded.pid, actualProcess);
    if (processAfter.state !== "live_match") fail("Mission Control process identity drifted", "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED");
    if (processAfter.observationHash !== actualProcess.processBeforeHash) {
      fail("Mission Control process observation bytes drifted", "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED");
    }
    let executableAfterBytes;
    try {
      executableAfterBytes = observeLoadedExecutableTextV1(loaded.pid, actualProcess.executableRealpath, "Mission Control loaded process after endpoint");
    } catch {
      fail("Mission Control executable observation drifted", "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED");
    }
    if (!executableAfterBytes.equals(actualProcess.lsofBytes)) {
      fail("Mission Control executable observation bytes drifted", "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED");
    }
    const listenerAfter = observeMissionControlListenerV1(loaded.pid);
    if (canonicalJsonV1(listenerAfter) !== canonicalJsonV1(listenerBefore)) {
      fail("Mission Control listener drifted", "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED");
    }
    missionControlLoadedBuildProof = Object.freeze({
      schema: "setfarm.platform-build-generation-mission-control-loaded-build-proof.v1",
      endpoint: MISSION_CONTROL_LOADED_BUILD_URL_V1,
      processFence: Object.freeze({
        schema: "setfarm.platform-build-generation-mission-control-process-fence.v1",
        launchctlPid: loaded.pid,
        processLstart: actualProcess.processLstart,
        processGroupId: actualProcess.processGroupId,
        initialLaunchctlBytesHash: sha256(launchctlBytes),
        initialPsBytesHash: actualProcess.processBeforeHash,
        finalLaunchctlBytesHash: sha256(launchctlAfterBytes),
        finalPsBytesHash: processAfter.observationHash,
      }),
      listenerFence: Object.freeze({
        schema: "setfarm.platform-build-generation-mission-control-listener-fence.v1",
        port: 3080,
        protocol: "TCP",
        state: "LISTEN",
        listenerPid: listenerBefore.pid,
        command: listenerBefore.command,
        fileDescriptor: listenerBefore.fileDescriptor,
        endpoint: listenerBefore.endpoint,
        initialLsofBytesHash: listenerBefore.bytesHash,
        finalLsofBytesHash: listenerAfter.bytesHash,
      }),
      response: actualMissionControl.response,
    });
  }
  let expectedSetfarmSourceBuild = expectedRuntimeSource.sourceBody;
  if (expectedRuntimeSource.provenance === "operation_retained_current_setfarm_build") {
    assertRetainedCurrentBuildV1(expectedRuntimeSource.sourceBody);
    expectedSetfarmSourceBuild = Object.freeze({
      branch: "main",
      clean: true,
      sha: expectedRuntimeSource.sourceBody.sourceSha,
      treeHash: expectedRuntimeSource.sourceBody.sourceTreeHash,
      buildHash: expectedRuntimeSource.sourceBody.buildHash,
      originMainSha: expectedRuntimeSource.sourceBody.sourceSha,
    });
  }
  const loadedSource = actualMissionControl?.source ?? observeActualSetfarmRuntimeSourceV1(entrypointRealpath, expectedSetfarmSourceBuild);
  if (canonicalJsonV1(loadedSource) !== canonicalJsonV1(expectedLoadedSource)) fail(`${config.label} actual source/build differs from expected authority`);
  if (config.label !== "com.setrox.mission-control" && observeProcessIdentityV1(loaded.pid, actualProcess).state !== "live_match") fail(`${config.label} process changed after generation observation`);
  const loadedProcessBase = {
    pid: loaded.pid,
    processLstart: actualProcess.processLstart,
    processGroupId: actualProcess.processGroupId,
    processIdentityHash: hashCanonicalJsonV1({ pid: loaded.pid, processLstart: actualProcess.processLstart, processGroupId: actualProcess.processGroupId }),
    executableRealpathHash: sha256(Buffer.from(actualProcess.executableRealpath, "utf8")),
    entrypointRealpathHash: sha256(Buffer.from(entrypointRealpath, "utf8")),
    commHash: actualProcess.commHash,
    commandHash: actualProcess.commandHash,
    lsofHash: actualProcess.lsofHash,
    sourceSha: loadedSource.sha,
    sourceTreeHash: loadedSource.treeHash,
    controllerBuildHash: loadedSource.buildHash,
    missionControlLoadedBuildProof,
    serviceGenerationHash: hashCanonicalJsonV1(missionControlLoadedBuildProof ? {
      schema: "setfarm.platform-build-generation-loaded-service-generation.v1",
      label: config.label,
      startupInstance: missionControlLoadedBuildProof.response.startupInstance,
      loadedBuild: missionControlLoadedBuildProof.response.loadedBuild,
      processFence: missionControlLoadedBuildProof.processFence,
      listenerFence: missionControlLoadedBuildProof.listenerFence,
    } : {
      schema: "setfarm.platform-build-generation-loaded-service-generation.v1",
      label: config.label,
      pid: loaded.pid,
      processLstart: actualProcess.processLstart,
      processGroupId: actualProcess.processGroupId,
      executableRealpathHash: sha256(Buffer.from(actualProcess.executableRealpath, "utf8")),
      loadedArgumentsHash: hashCanonicalJsonV1(loaded.programArguments),
      entrypointRealpathHash: sha256(Buffer.from(entrypointRealpath, "utf8")),
      commHash: actualProcess.commHash,
      commandHash: actualProcess.commandHash,
      lsofHash: actualProcess.lsofHash,
      sourceSha: loadedSource.sha,
      sourceTreeHash: loadedSource.treeHash,
      controllerBuildHash: loadedSource.buildHash,
    }),
    actualGenerationAuthenticated: true,
  };
  const expectedObservedFieldEqualityHash = hashCanonicalJsonV1({
    schema: "setfarm.platform-build-generation-expected-observed-field-equality.v1",
    label: config.label,
    expectedRuntimeSource,
    loadedProcessObservation: loadedProcessBase,
  });
  const plistProjection = Object.freeze({ program: null, effectiveProgram: plist.ProgramArguments[0], workingDirectory, programArguments: Object.freeze(plist.ProgramArguments), environment, pathResolutionCommitments });
  const loadedJobProjection = Object.freeze({
    program: Object.freeze(reportedProgram === null
      ? { kind: "derived_program_arguments_0", reported: null, effective: effectiveProgram }
      : { kind: "explicit", reported: reportedProgram, effective: effectiveProgram }),
    workingDirectory: loadedWorkingDirectory,
    programArguments: loaded.programArguments,
    environment: loadedEnvironment,
    pathResolutionCommitments: loadedPathResolutionCommitments,
    loadedProcess: Object.freeze({ ...loadedProcessBase, expectedObservedFieldEqualityHash }),
  });
  const projectionBase = { locator: config.locator, label: config.label, launchctlExecutable: LAUNCHCTL_EXECUTABLE_V1, launchctlDomain: `gui/${uid}`, expectedRuntimeSource, plistProjection, loadedJobProjection, plistBytesHash: sha256(plistObserved.bytes), launchctlBytesHash: sha256(launchctlBytes), noCandidateReference: true };
  return Object.freeze({ ...projectionBase, projectionHash: hashCanonicalJsonV1(projectionBase) });
}

function observeLaunchAgentConfigV1(config, expectedRuntimeSource, candidate, quarantine) {
  try {
    return observeLaunchAgentConfigBodyV1(config, expectedRuntimeSource, candidate, quarantine);
  } catch (error) {
    if (config.label !== "com.setrox.mission-control" || error?.code === "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED") throw error;
    fail("Mission Control loaded-generation proof is unavailable", "BUILD_GENERATION_LOADED_MISSION_CONTROL_PROOF_REQUIRED");
  }
}

function observeZeroReferenceProofBodyV1({ phase, operation, candidateCompletion, candidate, expectedRuntimeSources }) {
  // OA18_PRIVATE_FIXTURE_ZERO_REFERENCE_START
  const lsof = fixedChildResult(
    LSOF_REFERENCE_OBSERVER_EXECUTABLE_V1,
    ["-nP", "-F0", "+D", candidate.locator],
    { timeout: LSOF_REFERENCE_OBSERVER_TIMEOUT_MS_V1, maxBuffer: LSOF_REFERENCE_OBSERVER_MAX_BUFFER_BYTES_V1 },
  );
  const lsofStdout = Buffer.isBuffer(lsof.stdout) ? lsof.stdout : Buffer.from(lsof.stdout ?? "");
  const lsofStderr = Buffer.isBuffer(lsof.stderr) ? lsof.stderr : Buffer.from(lsof.stderr ?? "");
  if (lsof.error || lsof.signal !== null || lsof.status !== 1 || lsofStdout.length !== 0 || lsofStderr.length !== 0) fail("candidate has an open reference or lsof is ambiguous");
  const quarantine = path.join(repositoryRootV1(), QUARANTINE_DIRECTORY_V1);
  const launchAgentConfigs = Object.freeze(LAUNCH_AGENT_CONFIGS_V1.map((config, ordinal) => (
    observeLaunchAgentConfigV1(config, expectedRuntimeSources[ordinal], candidate.locator, quarantine)
  )));
  const body = {
    schema: "setfarm.platform-build-generation-zero-reference-proof.v1",
    phase,
    operation,
    candidateCompletion,
    observedUid: process.getuid(),
    candidate: Object.freeze({ locator: candidate.locator, rootPhysicalIdentity: candidate.inventory.rootPhysicalIdentity, physicalInventoryHash: candidate.inventory.physicalInventoryHash }),
    lsofExecutable: LSOF_REFERENCE_OBSERVER_EXECUTABLE_V1,
    lsofArgvContract: "setfarm.lsof-no-reference-argv.-nP.-F0.+D-candidate.v1",
    exitStatus: 1,
    stdoutHash: EMPTY_SHA256_V1,
    stderrHash: EMPTY_SHA256_V1,
    launchAgentConfigs,
  };
  return body;
  // OA18_PRIVATE_FIXTURE_ZERO_REFERENCE_END
}

function observeZeroReferenceProofV1(input) {
  const body = observeZeroReferenceProofBodyV1(input);
  return Object.freeze({ ...body, proofHash: hashCanonicalJsonV1(body) });
}

function operationPairV1(operation) {
  return Object.freeze({ operationRef: operation.operationRef, operationHash: operation.operationHash });
}

function operationRefV1(operationHash) {
  return `setfarm://internal-production/build-generation-retention-operation/sha256/${operationHash}`;
}

function assertPathCommitmentV1(commitment, expected = {}) {
  const environment = commitment?.source === "environment";
  const keys = [
    "source", "sourceName", "fieldOrdinal", "rawValueHash", "classification", "tokenization", "tokenCommitments",
    "exposure", "rawValue", "rawValueRedacted", ...(environment ? ["valueGrammar", "scanPolicy"] : []),
  ];
  if (!commitment || !hasExactKeys(commitment, keys)) fail("path commitment shape is invalid");
  if (!['effective_program', 'argument', 'working_directory', 'environment'].includes(commitment.source) || !Number.isSafeInteger(commitment.fieldOrdinal) || commitment.fieldOrdinal < 0 || !SHA256.test(commitment.rawValueHash)) fail("path commitment identity is invalid");
  if (expected.source !== undefined && commitment.source !== expected.source) fail("path commitment source coverage is invalid");
  if (expected.sourceName !== undefined && commitment.sourceName !== expected.sourceName) fail("path commitment name coverage is invalid");
  if (expected.fieldOrdinal !== undefined && commitment.fieldOrdinal !== expected.fieldOrdinal) fail("path commitment ordinal coverage is invalid");
  if (environment) {
    const contract = fieldContractV1(commitment.sourceName);
    if (commitment.exposure !== "redacted_secret" || commitment.rawValue !== null || commitment.rawValueRedacted !== true || canonicalJsonV1({
      valueGrammar: commitment.valueGrammar,
      classification: commitment.classification,
      tokenization: commitment.tokenization,
      scanPolicy: commitment.scanPolicy,
    }) !== canonicalJsonV1(contract)) fail("environment commitment contract/redaction is invalid");
  } else if (
    commitment.exposure !== "nonsecret" || typeof commitment.rawValue !== "string" || commitment.rawValueRedacted !== false
    || commitment.rawValueHash !== sha256(Buffer.from(commitment.rawValue, "utf8"))
  ) fail("nonsecret commitment exposure/hash is invalid");
  if (!environment && expected.rawValue !== undefined) {
    const pathBearing = expected.rawValue.startsWith("/") || expected.rawValue.startsWith("./") || expected.rawValue.startsWith("../");
    if (
      commitment.rawValue !== expected.rawValue
      || commitment.classification !== (pathBearing ? "single_path" : "not_path_bearing")
      || commitment.tokenization !== (pathBearing ? "single-v1" : "none-v1")
    ) fail("nonsecret commitment is crossed from its projected raw field");
  }
  if (!Array.isArray(commitment.tokenCommitments)) fail("path commitment tokens are invalid");
  const requiredTokens = commitment.tokenization === "none-v1" ? 0
    : commitment.tokenization === "url-components-v1" ? 8
      : commitment.tokenization === "database-url-components-and-conservative-scan-v1" ? 9
        : 1;
  const exactTokenCount = commitment.tokenization === "none-v1" || commitment.tokenization === "single-v1";
  if (
    commitment.tokenCommitments.length < requiredTokens
    || (exactTokenCount && commitment.tokenCommitments.length !== requiredTokens)
  ) fail("path commitment token cardinality is invalid");
  for (let ordinal = 0; ordinal < commitment.tokenCommitments.length; ordinal += 1) {
    const token = commitment.tokenCommitments[ordinal];
    if (!token || !hasExactKeys(token, [
      "tokenOrdinal", "tokenHash", "tokenKind", "emptyPathListSegment", "resolutionKind", "symlinkHops", "finalRealpathHash", "outsideCandidateAndQuarantine",
    ]) || token.tokenOrdinal !== ordinal || !SHA256.test(token.tokenHash) || !['path', 'url', 'nonpath'].includes(token.tokenKind)
      || typeof token.emptyPathListSegment !== "boolean" || !['absolute', 'effective_working_directory_relative', 'not_applicable'].includes(token.resolutionKind)
      || !Array.isArray(token.symlinkHops) || (token.finalRealpathHash !== null && !SHA256.test(token.finalRealpathHash)) || token.outsideCandidateAndQuarantine !== true
    ) fail("path token commitment is invalid");
    if (!environment && expected.rawValue !== undefined && commitment.tokenization === "single-v1" && (
      token.tokenHash !== sha256(Buffer.from(expected.rawValue, "utf8"))
      || token.tokenKind !== "path" || token.emptyPathListSegment !== false
      || token.resolutionKind !== (path.isAbsolute(expected.rawValue) ? "absolute" : "effective_working_directory_relative")
      || token.finalRealpathHash === null
    )) fail("nonsecret path token is crossed from its projected raw field");
    for (const hop of token.symlinkHops) {
      if (!hop || !hasExactKeys(hop, ["devDecimal", "inoDecimal", "mode", "linkCount", "lexicalLocatorHash", "resolvedLocatorHash"])) fail("path token hop shape is invalid");
      assertCanonicalUnsignedDecimalV1(hop.devDecimal, "path hop device");
      assertCanonicalUnsignedDecimalV1(hop.inoDecimal, "path hop inode");
      assertModeV1(hop.mode, "path hop");
      if (!Number.isSafeInteger(hop.linkCount) || hop.linkCount < 1 || !SHA256.test(hop.lexicalLocatorHash) || !SHA256.test(hop.resolvedLocatorHash)) fail("path token hop identity is invalid");
    }
  }
}

function assertEnvironmentTupleV1(environment, config) {
  if (!Array.isArray(environment) || environment.length !== config.environmentNames.length) fail(`${config.label} environment tuple length is invalid`);
  for (let ordinal = 0; ordinal < environment.length; ordinal += 1) {
    const entry = environment[ordinal];
    const name = config.environmentNames[ordinal];
    if (!entry || !hasExactKeys(entry, ["name", "valueHash", "classificationCommitment", "noCandidateReference"]) || entry.name !== name || !SHA256.test(entry.valueHash) || entry.noCandidateReference !== true) fail(`${config.label} environment tuple is invalid`);
    assertPathCommitmentV1(entry.classificationCommitment, { source: "environment", sourceName: name, fieldOrdinal: ordinal });
    if (entry.valueHash !== entry.classificationCommitment.rawValueHash) fail(`${config.label} environment hash relation is invalid`);
  }
}

function assertCommitmentCoverageV1(commitments, projection, config) {
  if (!Array.isArray(commitments)) fail(`${config.label} path commitment coverage is invalid`);
  const expected = [
    { source: "effective_program", sourceName: null, fieldOrdinal: 0, rawValue: projection.effectiveProgram ?? projection.program.effective },
    ...projection.programArguments.map((rawValue, ordinal) => ({ source: "argument", sourceName: null, fieldOrdinal: ordinal, rawValue })),
    ...(projection.workingDirectory === null || projection.workingDirectory?.reported === null ? [] : [{
      source: "working_directory",
      sourceName: null,
      fieldOrdinal: 0,
      rawValue: typeof projection.workingDirectory === "string" ? projection.workingDirectory : projection.workingDirectory.reported,
    }]),
    ...config.environmentNames.map((name, fieldOrdinal) => ({ source: "environment", sourceName: name, fieldOrdinal })),
  ];
  if (commitments.length !== expected.length) fail(`${config.label} path commitment coverage length is invalid`);
  for (let ordinal = 0; ordinal < commitments.length; ordinal += 1) assertPathCommitmentV1(commitments[ordinal], expected[ordinal]);
}

function assertLaunchAgentConfigProofV1(value, config, expectedRuntimeSource) {
  if (!value || !hasExactKeys(value, [
    "locator", "label", "launchctlExecutable", "launchctlDomain", "expectedRuntimeSource", "plistProjection", "loadedJobProjection",
    "plistBytesHash", "launchctlBytesHash", "noCandidateReference", "projectionHash",
  ]) || value.locator !== config.locator || value.label !== config.label || value.launchctlExecutable !== LAUNCHCTL_EXECUTABLE_V1
    || !/^gui\/[0-9]+$/.test(value.launchctlDomain) || canonicalJsonV1(value.expectedRuntimeSource) !== canonicalJsonV1(expectedRuntimeSource)
    || !SHA256.test(value.plistBytesHash) || !SHA256.test(value.launchctlBytesHash) || value.noCandidateReference !== true
  ) fail(`${config.label} proof shape is invalid`);
  const plist = value.plistProjection;
  if (!plist || !hasExactKeys(plist, ["program", "effectiveProgram", "workingDirectory", "programArguments", "environment", "pathResolutionCommitments"])
    || plist.program !== null || typeof plist.effectiveProgram !== "string" || !Array.isArray(plist.programArguments) || plist.programArguments.length < 1
    || plist.effectiveProgram !== plist.programArguments[0] || plist.workingDirectory !== config.workingDirectory
  ) fail(`${config.label} plist proof is invalid`);
  assertEnvironmentTupleV1(plist.environment, config);
  assertCommitmentCoverageV1(plist.pathResolutionCommitments, plist, config);
  const loaded = value.loadedJobProjection;
  if (!loaded || !hasExactKeys(loaded, ["program", "workingDirectory", "programArguments", "environment", "pathResolutionCommitments", "loadedProcess"])
    || !loaded.program || !['explicit', 'derived_program_arguments_0'].includes(loaded.program.kind)
    || !Array.isArray(loaded.programArguments) || loaded.programArguments.length < 1 || loaded.program.effective !== loaded.programArguments[0]
    || canonicalJsonV1(loaded.programArguments) !== canonicalJsonV1(plist.programArguments)
  ) fail(`${config.label} loaded job proof is invalid`);
  if (config.workingDirectory === null) {
    if (!['absent_launchd_default', 'reported_launchd_default'].includes(loaded.workingDirectory?.kind) || loaded.workingDirectory.effective !== "/") fail(`${config.label} loaded default working directory is invalid`);
  } else if (canonicalJsonV1(loaded.workingDirectory) !== canonicalJsonV1({ kind: "explicit", reported: config.workingDirectory, effective: config.workingDirectory })) fail(`${config.label} loaded working directory is invalid`);
  assertEnvironmentTupleV1(loaded.environment, config);
  assertCommitmentCoverageV1(loaded.pathResolutionCommitments, loaded, config);
  if (canonicalJsonV1(loaded.environment) !== canonicalJsonV1(plist.environment) || canonicalJsonV1(loaded.pathResolutionCommitments) !== canonicalJsonV1(plist.pathResolutionCommitments)) fail(`${config.label} loaded/plist commitments are crossed`);
  const processBody = loaded.loadedProcess;
  if (!processBody || !hasExactKeys(processBody, [
    "pid", "processLstart", "processGroupId", "processIdentityHash", "executableRealpathHash", "entrypointRealpathHash", "commHash", "commandHash", "lsofHash",
    "sourceSha", "sourceTreeHash", "controllerBuildHash", "missionControlLoadedBuildProof", "serviceGenerationHash", "actualGenerationAuthenticated", "expectedObservedFieldEqualityHash",
  ]) || !Number.isSafeInteger(processBody.pid) || processBody.pid < 1 || typeof processBody.processLstart !== "string"
    || !Number.isSafeInteger(processBody.processGroupId) || processBody.processGroupId < 1
    || ![
      processBody.processIdentityHash, processBody.executableRealpathHash, processBody.entrypointRealpathHash,
      processBody.commHash, processBody.commandHash, processBody.lsofHash, processBody.controllerBuildHash,
      processBody.serviceGenerationHash, processBody.expectedObservedFieldEqualityHash,
    ].every((digest) => SHA256.test(digest))
    || !GIT_HASH.test(processBody.sourceSha) || !GIT_HASH.test(processBody.sourceTreeHash) || processBody.actualGenerationAuthenticated !== true
    || processBody.processIdentityHash !== hashCanonicalJsonV1({ pid: processBody.pid, processLstart: processBody.processLstart, processGroupId: processBody.processGroupId })
  ) fail(`${config.label} loaded process proof is invalid`);
  const expectedLoadedSource = config.label === "com.setrox.mission-control"
    ? expectedRuntimeSource.sourceBody?.response?.evidence?.currentSource
    : {
      sha: expectedRuntimeSource.sourcePair?.sourceSha,
      treeHash: expectedRuntimeSource.sourcePair?.sourceTreeHash,
      buildHash: expectedRuntimeSource.sourcePair?.controllerBuildHash,
    };
  if (
    processBody.sourceSha !== expectedLoadedSource?.sha
    || processBody.sourceTreeHash !== expectedLoadedSource?.treeHash
    || processBody.controllerBuildHash !== expectedLoadedSource?.buildHash
  ) fail(`${config.label} loaded process source is crossed from expected runtime authority`);
  const missionProof = processBody.missionControlLoadedBuildProof;
  if (config.label === "com.setrox.mission-control") {
    const response = missionProof?.response;
    const startup = response?.startupInstance;
    const loadedBuild = response?.loadedBuild;
    const identity = loadedBuild?.buildIdentity;
    const processFence = missionProof?.processFence;
    const listenerFence = missionProof?.listenerFence;
    if (!missionProof || !hasExactKeys(missionProof, ["schema", "endpoint", "processFence", "listenerFence", "response"])
      || missionProof.schema !== "setfarm.platform-build-generation-mission-control-loaded-build-proof.v1" || missionProof.endpoint !== MISSION_CONTROL_LOADED_BUILD_URL_V1
      || !response || !hasExactKeys(response, ["schema", "loadedBuildRef", "loadedBuildHash", "startupInstance", "loadedBuild"])
      || response.schema !== "mission-control.product-build-authority-v2-loaded-build-response.v1"
      || !startup || !hasExactKeys(startup, ["schema", "pid", "instanceId"])
      || startup.schema !== "mission-control.product-build-authority-v2-startup-instance.v1" || startup.pid !== processBody.pid || !UUID_V4.test(startup.instanceId)
      || !loadedBuild || !hasExactKeys(loadedBuild, ["schema", "entryModulePath", "entryModuleHash", "buildIdentity", "buildIdentityHash"])
      || loadedBuild.schema !== "mission-control.product-build-authority-v2-loaded-build.v1"
      || loadedBuild.entryModulePath !== "dist-server/services/product-build-authority-v2-delivery-evidence-v1.js" || !SHA256.test(loadedBuild.entryModuleHash)
      || !identity || !hasExactKeys(identity, ["schema", "sourceSha", "treeHash", "buildHash"])
      || identity.schema !== "mission-control.internal-production-build-identity.v1" || !GIT_HASH.test(identity.sourceSha) || !GIT_HASH.test(identity.treeHash) || !SHA256.test(identity.buildHash)
      || loadedBuild.buildIdentityHash !== missionControlBuildIdentityBytesHashV1(identity) || response.loadedBuildHash !== hashCanonicalJsonV1(loadedBuild)
      || response.loadedBuildRef !== `mission-control://internal-production/product-build-authority-v2-loaded-build/sha256/${response.loadedBuildHash}`
      || identity.sourceSha !== processBody.sourceSha || identity.treeHash !== processBody.sourceTreeHash || identity.buildHash !== processBody.controllerBuildHash
      || !processFence || !hasExactKeys(processFence, ["schema", "launchctlPid", "processLstart", "processGroupId", "initialLaunchctlBytesHash", "initialPsBytesHash", "finalLaunchctlBytesHash", "finalPsBytesHash"])
      || processFence.schema !== "setfarm.platform-build-generation-mission-control-process-fence.v1" || processFence.launchctlPid !== processBody.pid
      || processFence.processLstart !== processBody.processLstart || processFence.processGroupId !== processBody.processGroupId
      || !SHA256.test(processFence.initialLaunchctlBytesHash) || processFence.finalLaunchctlBytesHash !== processFence.initialLaunchctlBytesHash
      || !SHA256.test(processFence.initialPsBytesHash) || processFence.finalPsBytesHash !== processFence.initialPsBytesHash
      || !listenerFence || !hasExactKeys(listenerFence, ["schema", "port", "protocol", "state", "listenerPid", "command", "fileDescriptor", "endpoint", "initialLsofBytesHash", "finalLsofBytesHash"])
      || listenerFence.schema !== "setfarm.platform-build-generation-mission-control-listener-fence.v1" || listenerFence.port !== 3080
      || listenerFence.protocol !== "TCP" || listenerFence.state !== "LISTEN" || listenerFence.listenerPid !== processBody.pid
      || typeof listenerFence.command !== "string" || listenerFence.command === "" || /[\0\n]/.test(listenerFence.command)
      || !Number.isSafeInteger(listenerFence.fileDescriptor) || listenerFence.fileDescriptor < 0
      || !["127.0.0.1:3080", "[::1]:3080", "*:3080"].includes(listenerFence.endpoint)
      || !SHA256.test(listenerFence.initialLsofBytesHash) || listenerFence.finalLsofBytesHash !== listenerFence.initialLsofBytesHash
    ) fail("Mission Control loaded-build proof is invalid");
  } else if (missionProof !== null) fail(`${config.label} has unexpected Mission Control loaded-build proof`);
  const serviceGenerationBody = missionProof ? {
    schema: "setfarm.platform-build-generation-loaded-service-generation.v1",
    label: config.label,
    startupInstance: missionProof.response.startupInstance,
    loadedBuild: missionProof.response.loadedBuild,
    processFence: missionProof.processFence,
    listenerFence: missionProof.listenerFence,
  } : {
    schema: "setfarm.platform-build-generation-loaded-service-generation.v1",
    label: config.label,
    pid: processBody.pid,
    processLstart: processBody.processLstart,
    processGroupId: processBody.processGroupId,
    executableRealpathHash: processBody.executableRealpathHash,
    loadedArgumentsHash: hashCanonicalJsonV1(loaded.programArguments),
    entrypointRealpathHash: processBody.entrypointRealpathHash,
    commHash: processBody.commHash,
    commandHash: processBody.commandHash,
    lsofHash: processBody.lsofHash,
    sourceSha: processBody.sourceSha,
    sourceTreeHash: processBody.sourceTreeHash,
    controllerBuildHash: processBody.controllerBuildHash,
  };
  if (processBody.serviceGenerationHash !== hashCanonicalJsonV1(serviceGenerationBody)) fail(`${config.label} loaded service generation hash is invalid`);
  const equalityBody = { ...processBody };
  delete equalityBody.expectedObservedFieldEqualityHash;
  if (processBody.expectedObservedFieldEqualityHash !== hashCanonicalJsonV1({
    schema: "setfarm.platform-build-generation-expected-observed-field-equality.v1",
    label: config.label,
    expectedRuntimeSource,
    loadedProcessObservation: equalityBody,
  })) fail(`${config.label} expected/observed equality hash is invalid`);
  const projection = { ...value };
  delete projection.projectionHash;
  if (value.projectionHash !== hashCanonicalJsonV1(projection)) fail(`${config.label} projection hash is invalid`);
}

function assertZeroReferenceProofV1(proof, phase, operation, candidateCompletion, expectedRuntimeSources = null) {
  if (!proof || !hasExactKeys(proof, [
    "schema", "phase", "operation", "candidateCompletion", "observedUid", "candidate", "lsofExecutable", "lsofArgvContract",
    "exitStatus", "stdoutHash", "stderrHash", "launchAgentConfigs", "proofHash",
  ]) || proof.schema !== "setfarm.platform-build-generation-zero-reference-proof.v1" || proof.phase !== phase) fail("zero-reference proof phase/shape is invalid");
  const projection = { ...proof };
  delete projection.proofHash;
  if (
    proof.proofHash !== hashCanonicalJsonV1(projection)
    || canonicalJsonV1(proof.operation) !== canonicalJsonV1(operation)
    || canonicalJsonV1(proof.candidateCompletion) !== canonicalJsonV1(candidateCompletion)
  ) fail("zero-reference proof hash/context is invalid");
  if (!Number.isSafeInteger(proof.observedUid) || proof.observedUid < 0 || !proof.candidate || !hasExactKeys(proof.candidate, ["locator", "rootPhysicalIdentity", "physicalInventoryHash"])
    || typeof proof.candidate.locator !== "string" || !path.isAbsolute(proof.candidate.locator) || !SHA256.test(proof.candidate.physicalInventoryHash)
    || proof.lsofExecutable !== LSOF_REFERENCE_OBSERVER_EXECUTABLE_V1 || proof.lsofArgvContract !== "setfarm.lsof-no-reference-argv.-nP.-F0.+D-candidate.v1"
    || proof.exitStatus !== 1 || proof.stdoutHash !== EMPTY_SHA256_V1 || proof.stderrHash !== EMPTY_SHA256_V1
  ) fail("zero-reference proof fixed fields are invalid");
  assertDirectoryIdentityBodyV1(proof.candidate.rootPhysicalIdentity, "zero-reference candidate root", false);
  if (!Array.isArray(proof.launchAgentConfigs) || proof.launchAgentConfigs.length !== 3) fail("zero-reference config tuple is invalid");
  const expected = expectedRuntimeSources ?? proof.launchAgentConfigs.map((config) => config.expectedRuntimeSource);
  for (let ordinal = 0; ordinal < LAUNCH_AGENT_CONFIGS_V1.length; ordinal += 1) {
    assertLaunchAgentConfigProofV1(proof.launchAgentConfigs[ordinal], LAUNCH_AGENT_CONFIGS_V1[ordinal], expected[ordinal]);
  }
}

function assertSourceBuildBodyV1(value, label = "Setfarm source/build") {
  if (
    !value || !hasExactKeys(value, ["branch", "clean", "sha", "treeHash", "buildHash", "originMainSha"])
    || value.branch !== "main" || value.clean !== true || !GIT_HASH.test(value.sha) || !GIT_HASH.test(value.treeHash)
    || !SHA256.test(value.buildHash) || value.originMainSha !== value.sha
  ) fail(`${label} is invalid`);
}

function assertPbaPathBlobTupleV1(value, paths, label) {
  if (!Array.isArray(value) || value.length !== paths.length) fail(`${label} tuple is invalid`);
  for (let ordinal = 0; ordinal < paths.length; ordinal += 1) {
    const entry = value[ordinal];
    if (!entry || !hasExactKeys(entry, ["path", "blobHash"]) || entry.path !== paths[ordinal] || !SHA256.test(entry.blobHash)) fail(`${label} entry is invalid`);
  }
}

function assertProductBuildAuthorityV2ObservationV1(value) {
  if (!value || !hasExactKeys(value, ["schema", "observationTransport", "response"])
    || value.schema !== "setfarm.product-build-authority-v2-delivery-evidence-observation.v1" || value.observationTransport !== "source-cli") fail("PBA observation shape is invalid");
  const response = value.response;
  if (!response || !hasExactKeys(response, ["schema", "currentStatus", "deliveryEvidenceRef", "deliveryEvidenceHash", "evidence"])
    || response.schema !== "mission-control.product-build-authority-v2-delivery-evidence-response.v1" || response.currentStatus !== "current" || !SHA256.test(response.deliveryEvidenceHash)
    || response.deliveryEvidenceRef !== `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${response.deliveryEvidenceHash}`) fail("PBA response is invalid");
  const evidence = response.evidence;
  if (!evidence || !hasExactKeys(evidence, [
    "schema", "currentStatus", "deliveryPrNumber", "deliveryMergeSha", "deliveryMergeAncestorOfCurrentSource", "currentSource",
    "deliveredPathBlobs", "focusedTests", "vendorLock", "deliveryEvidenceRef", "deliveryEvidenceHash",
  ]) || evidence.schema !== "mission-control.product-build-authority-v2-delivery-evidence.v1" || evidence.currentStatus !== "current"
    || evidence.deliveryPrNumber !== 19 || evidence.deliveryMergeSha !== "240e779d78804843a1202cbf0440fe423b806b1a"
    || evidence.deliveryMergeAncestorOfCurrentSource !== true || evidence.deliveryEvidenceRef !== response.deliveryEvidenceRef
    || evidence.deliveryEvidenceHash !== response.deliveryEvidenceHash) fail("PBA evidence shape is invalid");
  assertSourceBuildBodyV1(evidence.currentSource, "PBA current source");
  const deliveredPaths = [
    "server/routes/setfarm-operational.test.ts",
    "server/routes/setfarm-operational.ts",
    "server/services/setfarm-product-build-authority.ts",
    "server/services/setfarm-product-build-authority.test.ts",
    "src/lib/product-build-authority.ts",
    "src/components/run-detail/ProductBuildAuthority.tsx",
    "tests/product-build-authority-render.test.tsx",
    "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json",
  ];
  assertPbaPathBlobTupleV1(evidence.deliveredPathBlobs, deliveredPaths, "PBA delivered paths");
  const focused = evidence.focusedTests;
  const focusedArgv = [
    "node", "--import", "tsx", "--test", "server/routes/setfarm-operational.test.ts",
    "server/services/setfarm-product-build-authority.test.ts", "tests/product-build-authority-render.test.tsx",
  ];
  if (!focused || !hasExactKeys(focused, ["schema", "argv", "commandContractHash", "testPathBlobs", "exitCode", "passed", "focusedTestReceiptRef", "focusedTestReceiptHash"])
    || focused.schema !== "mission-control.product-build-authority-v2-focused-test-receipt.v1" || canonicalJsonV1(focused.argv) !== canonicalJsonV1(focusedArgv)
    || focused.commandContractHash !== hashCanonicalJsonV1({ argv: focusedArgv }) || focused.exitCode !== 0 || focused.passed !== true || !SHA256.test(focused.focusedTestReceiptHash)) fail("PBA focused receipt is invalid");
  assertPbaPathBlobTupleV1(focused.testPathBlobs, [deliveredPaths[0], deliveredPaths[3], deliveredPaths[6]], "PBA focused paths");
  for (const [focusedOrdinal, deliveredOrdinal] of [0, 3, 6].entries()) {
    if (focused.testPathBlobs[focusedOrdinal].blobHash !== evidence.deliveredPathBlobs[deliveredOrdinal].blobHash) fail("PBA focused/delivered path relation is invalid");
  }
  const focusedCore = { ...focused };
  delete focusedCore.focusedTestReceiptRef;
  delete focusedCore.focusedTestReceiptHash;
  if (focused.focusedTestReceiptHash !== hashCanonicalJsonV1(focusedCore)
    || focused.focusedTestReceiptRef !== `mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/${focused.focusedTestReceiptHash}`) fail("PBA focused receipt pair is invalid");
  const vendorArtifacts = [
    ["contracts/generated/mission-control/run-operational-snapshot.v1.compatibility.json", "contracts/vendor/setfarm/run-operational-snapshot.v1.compatibility.json"],
    ["contracts/generated/mission-control/run-operational-snapshot.v1.schema.json", "contracts/vendor/setfarm/run-operational-snapshot.v1.schema.json"],
    ["contracts/generated/mission-control/run-operational-snapshot.v2.compatibility.json", "contracts/vendor/setfarm/run-operational-snapshot.v2.compatibility.json"],
    ["contracts/generated/mission-control/run-operational-snapshot.v2.schema.json", "contracts/vendor/setfarm/run-operational-snapshot.v2.schema.json"],
    ["contracts/generated/mission-control/run-operational-snapshot.v3.compatibility.json", "contracts/vendor/setfarm/run-operational-snapshot.v3.compatibility.json"],
    ["contracts/generated/mission-control/run-operational-snapshot.v3.schema.json", "contracts/vendor/setfarm/run-operational-snapshot.v3.schema.json"],
    ["contracts/generated/mission-control/deployment-observation.v1.compatibility.json", "contracts/vendor/setfarm/deployment-observation.v1.compatibility.json"],
    ["contracts/generated/mission-control/deployment-observation.v1.schema.json", "contracts/vendor/setfarm/deployment-observation.v1.schema.json"],
    ["contracts/generated/mission-control/project-transfer-ack.v1.compatibility.json", "contracts/vendor/setfarm/project-transfer-ack.v1.compatibility.json"],
    ["contracts/generated/mission-control/project-transfer-ack.v1.schema.json", "contracts/vendor/setfarm/project-transfer-ack.v1.schema.json"],
    ["contracts/generated/mission-control/operational-active-run-status.v1.compatibility.json", "contracts/vendor/setfarm/operational-active-run-status.v1.compatibility.json"],
    ["contracts/generated/mission-control/operational-active-run-status.v1.schema.json", "contracts/vendor/setfarm/operational-active-run-status.v1.schema.json"],
  ];
  const vendor = evidence.vendorLock;
  if (!vendor || !hasExactKeys(vendor, ["schema", "lockPath", "producerRepository", "producerCommit", "lockContentHash", "artifacts", "compatibilitySetHash", "vendorLockProjectionHash"])
    || vendor.schema !== "mission-control.product-build-authority-v2-vendor-lock-projection.v1" || vendor.lockPath !== "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json"
    || vendor.producerRepository !== "https://github.com/hikmetgulsesli/setfarm.git" || !GIT_HASH.test(vendor.producerCommit) || !SHA256.test(vendor.lockContentHash)
    || !Array.isArray(vendor.artifacts) || vendor.artifacts.length !== vendorArtifacts.length) fail("PBA vendor lock is invalid");
  for (let ordinal = 0; ordinal < vendorArtifacts.length; ordinal += 1) {
    const artifact = vendor.artifacts[ordinal];
    if (!artifact || !hasExactKeys(artifact, ["producerPath", "vendoredPath", "sha256"]) || artifact.producerPath !== vendorArtifacts[ordinal][0]
      || artifact.vendoredPath !== vendorArtifacts[ordinal][1] || !SHA256.test(artifact.sha256)) fail("PBA vendor artifact is invalid");
  }
  if (vendor.lockContentHash !== evidence.deliveredPathBlobs[7].blobHash
    || vendor.compatibilitySetHash !== hashCanonicalJsonV1({ schema: "mission-control.setfarm-contract-compatibility-set.v1", artifacts: vendor.artifacts })) fail("PBA vendor compatibility relation is invalid");
  const vendorCore = { ...vendor };
  delete vendorCore.vendorLockProjectionHash;
  if (vendor.vendorLockProjectionHash !== hashCanonicalJsonV1(vendorCore)) fail("PBA vendor projection hash is invalid");
  const evidenceCore = { ...evidence };
  delete evidenceCore.deliveryEvidenceRef;
  delete evidenceCore.deliveryEvidenceHash;
  if (evidence.deliveryEvidenceHash !== hashCanonicalJsonV1(evidenceCore)) fail("PBA evidence hash is invalid");
  return value;
}

function assertExpectedRuntimeSourcesV1(value, sourceBuild, pbaPair, pbaBody) {
  if (!Array.isArray(value) || value.length !== 3) fail("expected runtime source tuple is invalid");
  const labels = ["com.setrox.setfarm-spawner", "com.setrox.setfarm-dashboard", "com.setrox.mission-control"];
  for (let ordinal = 0; ordinal < value.length; ordinal += 1) {
    const entry = value[ordinal];
    if (!entry || !hasExactKeys(entry, ["label", "provenance", "sourcePair", "sourceBody"]) || entry.label !== labels[ordinal]) fail("expected runtime source entry is invalid");
    if (ordinal < 2) {
      if (entry.provenance !== "operation_current_oa17_setfarm_source_build" || canonicalJsonV1(entry.sourceBody) !== canonicalJsonV1(sourceBuild)) fail("expected Setfarm runtime source body is crossed");
      if (!entry.sourcePair || !hasExactKeys(entry.sourcePair, ["sourceSha", "sourceTreeHash", "controllerBuildHash"])) fail("expected Setfarm runtime source pair shape is invalid");
      if (
        entry.sourcePair.sourceSha !== sourceBuild.sha || entry.sourcePair.sourceTreeHash !== sourceBuild.treeHash
        || entry.sourcePair.controllerBuildHash !== sourceBuild.buildHash
      ) fail("expected Setfarm runtime source pair is crossed");
    } else {
      if (entry.provenance !== "operation_embedded_current_pba_v2_delivery_evidence" || canonicalJsonV1(entry.sourceBody) !== canonicalJsonV1(pbaBody) || canonicalJsonV1(entry.sourcePair) !== canonicalJsonV1(pbaPair)) {
        fail("expected Mission Control runtime source is crossed");
      }
    }
  }
}

function assertExpectedRuntimeSourcesV2(value, retainedCurrentBuild, pbaPair, pbaBody) {
  assertRetainedCurrentBuildV1(retainedCurrentBuild);
  if (!Array.isArray(value) || value.length !== 3) fail("expected runtime source v2 tuple is invalid");
  const labels = ["com.setrox.setfarm-spawner", "com.setrox.setfarm-dashboard", "com.setrox.mission-control"];
  for (let ordinal = 0; ordinal < value.length; ordinal += 1) {
    const entry = value[ordinal];
    if (!entry || !hasExactKeys(entry, ["label", "provenance", "sourcePair", "sourceBody"]) || entry.label !== labels[ordinal]) {
      fail("expected runtime source v2 entry is invalid");
    }
    if (ordinal < 2) {
      if (
        entry.provenance !== "operation_retained_current_setfarm_build"
        || canonicalJsonV1(entry.sourceBody) !== canonicalJsonV1(retainedCurrentBuild)
        || !entry.sourcePair || !hasExactKeys(entry.sourcePair, ["sourceSha", "sourceTreeHash", "controllerBuildHash"])
        || entry.sourcePair.sourceSha !== retainedCurrentBuild.sourceSha
        || entry.sourcePair.sourceTreeHash !== retainedCurrentBuild.sourceTreeHash
        || entry.sourcePair.controllerBuildHash !== retainedCurrentBuild.buildHash
      ) fail("expected retained Setfarm runtime source is crossed");
    } else if (
      entry.provenance !== "operation_embedded_current_pba_v2_delivery_evidence"
      || canonicalJsonV1(entry.sourceBody) !== canonicalJsonV1(pbaBody)
      || canonicalJsonV1(entry.sourcePair) !== canonicalJsonV1(pbaPair)
    ) fail("expected Mission Control runtime source v2 is crossed");
  }
}

function assertExecutingClosureV1(value) {
  const projectionKeys = [
    "schema", "moduleRootKind", "moduleRootRepositoryLocator", "entryLocator", "maxModuleCount", "maxImportEdgeCount",
    "maxLocatorUtf8Octets", "maxModuleBytes", "maxTotalModuleBytes", "entries", "importEdges", "nodeBuiltinSpecifiers",
  ];
  if (!value || !hasExactKeys(value, [...projectionKeys, "closureHash"])) fail("retention executing closure shape is invalid");
  if (
    value.schema !== "setfarm.platform-build-generation-retention-executing-closure.v1"
    || value.moduleRootKind !== "code_derived_import_meta" || value.moduleRootRepositoryLocator !== "."
    || value.entryLocator !== "scripts/build-generation-retention.mjs" || value.maxModuleCount !== 256
    || value.maxImportEdgeCount !== 2_048 || value.maxLocatorUtf8Octets !== 1_024
    || value.maxModuleBytes !== 1_048_576 || value.maxTotalModuleBytes !== 16_777_216
    || !Array.isArray(value.entries) || !Array.isArray(value.importEdges) || !Array.isArray(value.nodeBuiltinSpecifiers)
    || value.entries.length < 1 || value.entries.length > value.maxModuleCount || value.importEdges.length > value.maxImportEdgeCount
  ) fail("retention executing closure constants are invalid");
  let totalBytes = 0;
  let prior = null;
  const locators = new Set();
  for (const entry of value.entries) {
    if (!entry || !hasExactKeys(entry, ["locator", "gitMode", "gitBlobHash", "byteLength", "sha256"])) fail("retention closure entry shape is invalid");
    canonicalRelativeLocator(entry.locator);
    if (Buffer.byteLength(entry.locator, "utf8") > value.maxLocatorUtf8Octets || (prior !== null && compareBytes(prior, entry.locator) >= 0)) fail("retention closure entry order is invalid");
    prior = entry.locator;
    locators.add(entry.locator);
    if (!['100644', '100755'].includes(entry.gitMode) || !GIT_HASH.test(entry.gitBlobHash) || !Number.isSafeInteger(entry.byteLength) || entry.byteLength < 1 || entry.byteLength > value.maxModuleBytes || !SHA256.test(entry.sha256)) fail("retention closure entry identity is invalid");
    totalBytes += entry.byteLength;
  }
  if (totalBytes > value.maxTotalModuleBytes || !locators.has(value.entryLocator)) fail("retention closure byte/root authority is invalid");
  let priorEdge = null;
  for (const edge of value.importEdges) {
    if (!edge || !hasExactKeys(edge, ["importerLocator", "literalSpecifier", "importedLocator"]) || !locators.has(edge.importerLocator) || !locators.has(edge.importedLocator) || !/^\.\.?\//.test(edge.literalSpecifier)) fail("retention closure import edge is invalid");
    const key = `${edge.importerLocator}\0${edge.literalSpecifier}\0${edge.importedLocator}`;
    if (priorEdge !== null && compareBytes(priorEdge, key) >= 0) fail("retention closure import edges are not unique ordered");
    priorEdge = key;
  }
  let priorBuiltin = null;
  for (const specifier of value.nodeBuiltinSpecifiers) {
    if (typeof specifier !== "string" || !specifier.startsWith("node:") || (priorBuiltin !== null && compareBytes(priorBuiltin, specifier) >= 0)) fail("retention closure builtins are invalid");
    priorBuiltin = specifier;
  }
  const projection = {};
  for (const key of projectionKeys) projection[key] = value[key];
  if (value.closureHash !== hashCanonicalJsonV1(projection)) fail("retention closure hash is invalid");
}

function parseRetentionOperationV1(value) {
  if (!value || !hasExactKeys(value, ["operationCore", "expectedQuarantineLocator", "operationRef", "operationHash"])) fail("retention operation shape is invalid");
  const digest = hashCanonicalJsonV1(value.operationCore);
  if (
    value.operationHash !== digest || value.operationRef !== operationRefV1(digest)
    || value.expectedQuarantineLocator !== `${QUARANTINE_DIRECTORY_V1}/${digest}.dist`
    || value.operationCore?.schema !== "setfarm.platform-build-generation-retention-operation.v1"
    || value.operationCore?.purpose !== "permanently-dispose-lowest-completed-build-generation-v1"
    || !Number.isSafeInteger(value.operationCore?.candidateOrdinal) || value.operationCore.candidateOrdinal < 1
    || value.operationCore?.prepareZeroReferenceProofHash !== value.operationCore?.prepareZeroReferenceProof?.proofHash
    || value.operationCore?.prepareZeroReferenceProof?.phase !== "prepare"
    || value.operationCore?.prepareZeroReferenceProof?.operation !== null
  ) fail("retention operation pair/body is invalid");
  const core = value.operationCore;
  if (!hasExactKeys(core, [
    "schema", "purpose", "candidateCompletion", "candidateOrdinal", "sourceBuild",
    "productBuildAuthorityV2DeliveryEvidence", "productBuildAuthorityV2Observation", "expectedRuntimeSources",
    "executingImplementationClosure", "candidateArchiveLocator", "candidateArchiveIdentity", "candidateInventory",
    "prepareZeroReferenceProof", "prepareZeroReferenceProofHash",
  ])) fail("retention operation core shape is invalid");
  assertRecordPairV1(core.candidateCompletion, "completion");
  assertSourceBuildBodyV1(core.sourceBuild);
  assertRecordPairV1(core.productBuildAuthorityV2DeliveryEvidence, "deliveryEvidence");
  const pba = core.productBuildAuthorityV2Observation;
  assertProductBuildAuthorityV2ObservationV1(pba);
  if (
    !pba || !hasExactKeys(pba, ["schema", "observationTransport", "response"])
    || pba.schema !== "setfarm.product-build-authority-v2-delivery-evidence-observation.v1" || pba.observationTransport !== "source-cli"
    || pba.response?.schema !== "mission-control.product-build-authority-v2-delivery-evidence-response.v1"
    || pba.response.currentStatus !== "current"
    || pba.response.deliveryEvidenceRef !== core.productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceRef
    || pba.response.deliveryEvidenceHash !== core.productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceHash
    || pba.response.evidence?.deliveryEvidenceRef !== pba.response.deliveryEvidenceRef
    || pba.response.evidence?.deliveryEvidenceHash !== pba.response.deliveryEvidenceHash
  ) fail("retention operation PBA authority is invalid");
  assertExpectedRuntimeSourcesV1(core.expectedRuntimeSources, core.sourceBuild, core.productBuildAuthorityV2DeliveryEvidence, pba);
  assertExecutingClosureV1(core.executingImplementationClosure);
  if (!/^\.setfarm\/build-generations-v1\/[0-9a-f-]{36}\.dist$/.test(core.candidateArchiveLocator)) fail("retention candidate archive locator is invalid");
  assertDirectoryIdentityBodyV1(core.candidateArchiveIdentity, "retention candidate archive");
  assertInventoryBodyV1(core.candidateInventory, "retention candidate inventory");
  if (
    core.candidateArchiveIdentity.devDecimal !== core.candidateInventory.rootPhysicalIdentity.devDecimal
    || core.candidateArchiveIdentity.inoDecimal !== core.candidateInventory.rootPhysicalIdentity.inoDecimal
    || core.candidateArchiveIdentity.mode !== core.candidateInventory.rootPhysicalIdentity.mode
  ) fail("retention archive identity/inventory is crossed");
  assertZeroReferenceProofV1(value.operationCore.prepareZeroReferenceProof, "prepare", null, value.operationCore.candidateCompletion, value.operationCore.expectedRuntimeSources);
  return value;
}

function parseRetentionOperationV2(value) {
  if (!value || !hasExactKeys(value, ["operationCore", "expectedQuarantineLocator", "operationRef", "operationHash"])) fail("retention operation v2 shape is invalid");
  const digest = hashCanonicalJsonV1(value.operationCore);
  if (
    value.operationHash !== digest || value.operationRef !== operationRefV1(digest)
    || value.expectedQuarantineLocator !== `${QUARANTINE_DIRECTORY_V1}/${digest}.dist`
    || value.operationCore?.schema !== "setfarm.platform-build-generation-retention-operation.v2"
    || value.operationCore?.purpose !== "permanently-dispose-lowest-completed-build-generation-v1"
    || !Number.isSafeInteger(value.operationCore?.candidateOrdinal) || value.operationCore.candidateOrdinal < 1
    || value.operationCore?.prepareZeroReferenceProofHash !== value.operationCore?.prepareZeroReferenceProof?.proofHash
    || value.operationCore?.prepareZeroReferenceProof?.phase !== "prepare"
    || value.operationCore?.prepareZeroReferenceProof?.operation !== null
  ) fail("retention operation v2 pair/body is invalid");
  const core = value.operationCore;
  if (!hasExactKeys(core, [
    "schema", "purpose", "candidateCompletion", "candidateOrdinal", "controllerSource", "retainedCurrentBuild",
    "productBuildAuthorityV2DeliveryEvidence", "productBuildAuthorityV2Observation", "expectedRuntimeSources",
    "executingImplementationClosure", "candidateArchiveLocator", "candidateArchiveIdentity", "candidateInventory",
    "prepareZeroReferenceProof", "prepareZeroReferenceProofHash",
  ])) fail("retention operation v2 core shape is invalid");
  assertRecordPairV1(core.candidateCompletion, "completion");
  assertRetentionControllerSourceV2(core.controllerSource);
  assertRetainedCurrentBuildV1(core.retainedCurrentBuild);
  if (core.controllerSource.sourceSha === core.retainedCurrentBuild.sourceSha) fail("retention operation v2 sources are not distinct");
  assertRecordPairV1(core.productBuildAuthorityV2DeliveryEvidence, "deliveryEvidence");
  const pba = core.productBuildAuthorityV2Observation;
  assertProductBuildAuthorityV2ObservationV1(pba);
  if (
    !pba || !hasExactKeys(pba, ["schema", "observationTransport", "response"])
    || pba.schema !== "setfarm.product-build-authority-v2-delivery-evidence-observation.v1" || pba.observationTransport !== "source-cli"
    || pba.response?.schema !== "mission-control.product-build-authority-v2-delivery-evidence-response.v1"
    || pba.response.currentStatus !== "current"
    || pba.response.deliveryEvidenceRef !== core.productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceRef
    || pba.response.deliveryEvidenceHash !== core.productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceHash
    || pba.response.evidence?.deliveryEvidenceRef !== pba.response.deliveryEvidenceRef
    || pba.response.evidence?.deliveryEvidenceHash !== pba.response.deliveryEvidenceHash
  ) fail("retention operation v2 PBA authority is invalid");
  assertExpectedRuntimeSourcesV2(core.expectedRuntimeSources, core.retainedCurrentBuild, core.productBuildAuthorityV2DeliveryEvidence, pba);
  assertExecutingClosureV1(core.executingImplementationClosure);
  if (!/^\.setfarm\/build-generations-v1\/[0-9a-f-]{36}\.dist$/.test(core.candidateArchiveLocator)) fail("retention v2 candidate archive locator is invalid");
  assertDirectoryIdentityBodyV1(core.candidateArchiveIdentity, "retention v2 candidate archive");
  assertInventoryBodyV1(core.candidateInventory, "retention v2 candidate inventory");
  if (
    core.candidateArchiveIdentity.devDecimal !== core.candidateInventory.rootPhysicalIdentity.devDecimal
    || core.candidateArchiveIdentity.inoDecimal !== core.candidateInventory.rootPhysicalIdentity.inoDecimal
    || core.candidateArchiveIdentity.mode !== core.candidateInventory.rootPhysicalIdentity.mode
  ) fail("retention v2 archive identity/inventory is crossed");
  assertZeroReferenceProofV1(core.prepareZeroReferenceProof, "prepare", null, core.candidateCompletion, core.expectedRuntimeSources);
  return value;
}

function parseRetentionOperationV1OrV2(value) {
  if (value?.operationCore?.schema === "setfarm.platform-build-generation-retention-operation.v1") return parseRetentionOperationV1(value);
  if (value?.operationCore?.schema === "setfarm.platform-build-generation-retention-operation.v2") return parseRetentionOperationV2(value);
  fail("retention operation schema is invalid");
}

function readRetentionOperationPairV1(stores, pair) {
  if (
    !pair || !hasExactKeys(pair, ["operationRef", "operationHash"])
    || !SHA256.test(pair.operationHash) || pair.operationRef !== operationRefV1(pair.operationHash)
  ) fail("retention operation pair is invalid");
  const file = path.join(stores.operations, `${pair.operationHash}.json`);
  const operation = parseRetentionOperationV1OrV2(parseCanonicalRecord(file, 0o600, [1, 2]).value);
  if (operation.operationRef !== pair.operationRef || operation.operationHash !== pair.operationHash) fail("retention operation lookup mismatch");
  return operation;
}

function candidateIndexNameV1(candidateCompletion) {
  return `${hashCanonicalJsonV1(candidateCompletion)}.json`;
}

function parseCandidateIndexV1(file, candidateCompletion) {
  const value = parseCanonicalRecord(file, 0o600, [1, 2]).value;
  assertCandidateIndexBodyV1(value, path.basename(file));
  if (
    !value || !hasExactKeys(value, ["schema", "candidateCompletion", "operation"])
    || value.schema !== "setfarm.platform-build-generation-retention-candidate-index.v1"
    || canonicalJsonV1(value.candidateCompletion) !== canonicalJsonV1(candidateCompletion)
    || !value.operation || !hasExactKeys(value.operation, ["operationRef", "operationHash"])
  ) fail("retention candidate index is invalid");
  return value;
}

function assertCandidateIndexBodyV1(value, filename) {
  if (
    !value || !hasExactKeys(value, ["schema", "candidateCompletion", "operation"])
    || value.schema !== "setfarm.platform-build-generation-retention-candidate-index.v1"
  ) fail("retention candidate index body is invalid");
  assertRecordPairV1(value.candidateCompletion, "completion");
  assertRecordPairV1(value.operation, "operation");
  if (filename !== candidateIndexNameV1(value.candidateCompletion)) fail("retention candidate index filename is invalid");
  return value;
}

function assertEraseStoreBodyV1(value, filename) {
  if (value?.recordKind === "quarantine_authorization") {
    const projection = { ...value };
    delete projection.quarantineAuthorizationRef;
    delete projection.quarantineAuthorizationHash;
    const digest = hashCanonicalJsonV1(projection);
    if (
      !hasExactKeys(value, [
        "schema", "recordKind", "operation", "candidateCompletion", "candidateArchiveLocator", "expectedQuarantineLocator",
        "candidateArchiveIdentity", "physicalInventoryHash", "contentInventoryHash", "preDispositionZeroReferenceProof",
        "preDispositionZeroReferenceProofHash", "quarantineAuthorizationRef", "quarantineAuthorizationHash",
      ]) || value.schema !== "setfarm.platform-build-generation-retention-quarantine-authorization.v1"
      || value.quarantineAuthorizationHash !== digest || value.quarantineAuthorizationRef !== quarantineAuthorizationRefV1(digest) || filename !== `${digest}.json`
    ) fail("quarantine authorization publisher body is invalid");
    assertRecordPairV1(value.operation, "operation");
    assertRecordPairV1(value.candidateCompletion, "completion");
    assertDirectoryIdentityBodyV1(value.candidateArchiveIdentity, "quarantine authorization archive");
    if (typeof value.candidateArchiveLocator !== "string" || typeof value.expectedQuarantineLocator !== "string" || !SHA256.test(value.physicalInventoryHash) || !SHA256.test(value.contentInventoryHash) || value.preDispositionZeroReferenceProofHash !== value.preDispositionZeroReferenceProof?.proofHash) fail("quarantine authorization fields are invalid");
    return;
  }
  const kind = value?.recordKind;
  if (!['intent', 'completion'].includes(kind)) fail("erase publisher body kind is invalid");
  const label = `${kind[0].toUpperCase()}${kind.slice(1)}`;
  const refKey = `eraseStep${label}Ref`;
  const hashKey = `eraseStep${label}Hash`;
  const projection = { ...value };
  delete projection[refKey];
  delete projection[hashKey];
  const digest = hashCanonicalJsonV1(projection);
  const commonKeys = [
    "schema", "recordKind", "operation", "ordinal", "predecessorCompletion", "locator", "kind", "identity", "action",
    "remainingBeforeHash", "remainingAfterHash", refKey, hashKey,
  ];
  const expectedKeys = kind === "intent"
    ? [...commonKeys, "byteLength", "sha256", "preDispositionZeroReferenceProof", "postQuarantineZeroReferenceProof"]
    : [...commonKeys, "intent", "targetAbsent"];
  if (
    !hasExactKeys(value, expectedKeys)
    || value.schema !== `setfarm.platform-build-generation-retention-erase-step-${kind}.v1`
    || value[hashKey] !== digest || value[refKey] !== eraseRecordRefV1(kind, digest) || filename !== `${digest}.json`
  ) fail("erase publisher body is invalid");
  assertRecordPairV1(value.operation, "operation");
  assertRecordPairV1(value.predecessorCompletion, "eraseStepCompletion", true);
  if (!Number.isSafeInteger(value.ordinal) || value.ordinal < 0 || value.ordinal > MAX_TREE_ENTRIES_V1 || (value.locator !== "." && (typeof value.locator !== "string" || canonicalRelativeLocator(value.locator) !== value.locator))) fail("erase ordinal/locator is invalid");
  if (!['regular_file', 'directory', 'root'].includes(value.kind) || value.action !== (value.kind === "regular_file" ? "unlink" : "rmdir")) fail("erase kind/action is invalid");
  if (!value.identity || !hasExactKeys(value.identity, ["devDecimal", "inoDecimal", "mode", "linkCount"])) fail("erase identity shape is invalid");
  assertCanonicalUnsignedDecimalV1(value.identity.devDecimal, "erase device");
  assertCanonicalUnsignedDecimalV1(value.identity.inoDecimal, "erase inode");
  assertModeV1(value.identity.mode, "erase identity");
  if (!Number.isSafeInteger(value.identity.linkCount) || value.identity.linkCount < 1 || (value.kind === "regular_file" && value.identity.linkCount !== 1) || !SHA256.test(value.remainingBeforeHash) || !SHA256.test(value.remainingAfterHash)) fail("erase identity/subset hashes are invalid");
  if (kind === "intent") {
    if (value.kind === "regular_file" ? (!Number.isSafeInteger(value.byteLength) || value.byteLength < 0 || !SHA256.test(value.sha256)) : (value.byteLength !== null || value.sha256 !== null)) fail("erase intent byte identity is invalid");
    if (value.ordinal === 0 ? (!value.preDispositionZeroReferenceProof || !value.postQuarantineZeroReferenceProof) : (value.preDispositionZeroReferenceProof !== null || value.postQuarantineZeroReferenceProof !== null)) fail("erase intent proof placement is invalid");
  } else {
    assertRecordPairV1(value.intent, "eraseStepIntent");
    if (value.targetAbsent !== true) fail("erase completion target absence is invalid");
  }
}

function assertReceiptPublisherBodyV1(value, filename) {
  const projection = { ...value };
  delete projection.receiptRef;
  delete projection.receiptHash;
  const digest = hashCanonicalJsonV1(projection);
  if (
    !value || !hasExactKeys(value, [
      "schema", "operationRef", "operationHash", "preDispositionZeroReferenceProof", "preDispositionZeroReferenceProofHash",
      "sourceAbsent", "quarantineLocator", "quarantineIdentity", "quarantineInventory", "postQuarantineZeroReferenceProof",
      "postQuarantineZeroReferenceProofHash", "permanentDisposition", "erasedEntryCount", "erasedRegularFileByteCount",
      "finalEraseStepRef", "finalEraseStepHash", "quarantineAbsent", "receiptRef", "receiptHash",
    ]) || value.schema !== "setfarm.platform-build-generation-retention-receipt.v1"
    || value.receiptHash !== digest || value.receiptRef !== receiptRefV1(digest) || filename !== `${digest}.json`
  ) fail("receipt publisher body is invalid");
  assertRecordPairV1({ operationRef: value.operationRef, operationHash: value.operationHash }, "operation");
  assertRecordPairV1({ eraseStepCompletionRef: value.finalEraseStepRef, eraseStepCompletionHash: value.finalEraseStepHash }, "eraseStepCompletion");
  assertDirectoryIdentityBodyV1(value.quarantineIdentity, "receipt quarantine");
  assertInventoryBodyV1(value.quarantineInventory, "receipt inventory");
  if (
    value.preDispositionZeroReferenceProofHash !== value.preDispositionZeroReferenceProof?.proofHash
    || value.postQuarantineZeroReferenceProofHash !== value.postQuarantineZeroReferenceProof?.proofHash
    || value.sourceAbsent !== true || value.permanentDisposition !== true || value.quarantineAbsent !== true
    || !Number.isSafeInteger(value.erasedEntryCount) || value.erasedEntryCount < 0
    || !Number.isSafeInteger(value.erasedRegularFileByteCount) || value.erasedRegularFileByteCount < 0
  ) fail("receipt terminal fields are invalid");
}

export function classifyBuildGenerationRetentionPublisherRecordV1(input) {
  if (!input || !hasExactKeys(input, ["store", "basename", "bytes"])
    || !["operations", "operation-candidates", "erase-steps", "receipts"].includes(input.store)
    || typeof input.basename !== "string" || !/^[0-9a-f]{64}\.json$/.test(input.basename)
    || !Buffer.isBuffer(input.bytes) || input.bytes.length === 0 || input.bytes.length > MAX_AUTHORITY_BYTES_V1) {
    return Object.freeze({ state: "invalid" });
  }
  try {
    const value = parseCanonicalRecordBytesV1(input.bytes, input.basename);
    if (input.store === "operations") {
      const operation = parseRetentionOperationV1OrV2(value);
      if (input.basename !== `${operation.operationHash}.json`) fail("retention operation filename/hash mismatch");
    } else if (input.store === "operation-candidates") {
      assertCandidateIndexBodyV1(value, input.basename);
    } else if (input.store === "erase-steps") {
      assertEraseStoreBodyV1(value, input.basename);
    } else {
      assertReceiptPublisherBodyV1(value, input.basename);
    }
    return Object.freeze({ state: "valid" });
  } catch {
    return Object.freeze({ state: "invalid" });
  }
}

function normalizeRetentionPublisherStoresV1(stores) {
  inspectImmutablePublisherDirectoryV1(stores.operations, (name) => /^[0-9a-f]{64}\.json$/.test(name), (name, value) => {
    const operation = parseRetentionOperationV1OrV2(value);
    if (name !== `${operation.operationHash}.json`) fail("retention operation filename/hash mismatch");
  }, true);
  inspectImmutablePublisherDirectoryV1(stores.operationCandidates, (name) => /^[0-9a-f]{64}\.json$/.test(name), (name, value) => assertCandidateIndexBodyV1(value, name), true);
  inspectImmutablePublisherDirectoryV1(stores.eraseSteps, (name) => /^[0-9a-f]{64}\.json$/.test(name), (name, value) => assertEraseStoreBodyV1(value, name), true);
  inspectImmutablePublisherDirectoryV1(stores.receipts, (name) => /^[0-9a-f]{64}\.json$/.test(name), (name, value) => assertReceiptPublisherBodyV1(value, name), true);
}

function withRetentionMaintenanceLockV1(roots, kind, candidateKeyHash, action) {
  const lock = acquireMaintenanceLock(roots.setfarm, kind, candidateKeyHash);
  let completed = false;
  try {
    const value = action();
    completed = true;
    releaseMaintenanceLock(roots.setfarm, lock);
    return value;
  } catch (error) {
    if (!completed && optionalLstat(lock.file)) releaseMaintenanceLock(roots.setfarm, lock);
    throw error;
  }
}

function currentActiveCandidateV1(inspection) {
  if (inspection.danglingIntent) fail("retention cannot cross a dangling rotation intent");
  const active = inspection.generations.filter((generation) => generation.disposition === null);
  if (active.length < 3) fail("retention requires at least three active completed generations", "BUILD_GENERATION_RETENTION_NOT_REQUIRED");
  const candidate = active[0];
  if (candidate.ordinal >= active[active.length - 2].ordinal) fail("retention cannot select either newest completed generation");
  return candidate;
}

function findUnindexedOperationForCandidateV1(stores, candidateCompletion) {
  const names = readdirSync(stores.operations).sort(compareBytes);
  if (names.length > MAX_LEDGER_ORDINALS_V1) fail("retention operation capacity exceeded");
  const matches = [];
  for (const name of names) {
    const match = /^([0-9a-f]{64})\.json$/.exec(name);
    if (!match) fail("retention operation store has an invalid dirent");
    const operation = parseRetentionOperationV1OrV2(parseCanonicalRecord(path.join(stores.operations, name)).value);
    if (operation.operationHash !== match[1]) fail("retention operation filename/hash mismatch");
    if (canonicalJsonV1(operation.operationCore.candidateCompletion) === canonicalJsonV1(candidateCompletion)) matches.push(operation);
  }
  if (matches.length > 1) fail("retention candidate operation fork");
  return matches[0] ?? null;
}

function finalizedBuildSourceShaForClassifierV2(root) {
  const dist = path.join(root, "dist");
  const distIdentity = directoryIdentity(dist);
  if (distIdentity.mode !== 0o755) fail("retention classifier dist mode is invalid");
  const observed = readStableRegular(path.join(dist, "BUILD_INFO.json"), {
    device: BigInt(distIdentity.devDecimal), linkCounts: [1], maxBytes: MAX_AUTHORITY_BYTES_V1,
  });
  if (observed.mode !== 0o444) fail("retention classifier BUILD_INFO mode is invalid");
  const value = parseFinalizedJsonV1(observed, [
    "sha", "shortSha", "branch", "dirty", "packageVersion", "displayVersion", "builtAt",
  ], "retention classifier BUILD_INFO", true);
  if (!GIT_HASH.test(value.sha)) fail("retention classifier source SHA is invalid");
  return value.sha;
}

function firstAuthorityDifferencePathV2(left, right, locator = "$") {
  if (left === right) return null;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return locator;
  if (Array.isArray(left) !== Array.isArray(right)) return locator;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (canonicalJsonV1([...leftKeys].sort(compareBytes)) !== canonicalJsonV1([...rightKeys].sort(compareBytes))) return `${locator}.[keys]`;
  for (const key of leftKeys) {
    const difference = firstAuthorityDifferencePathV2(left[key], right[key], `${locator}.${key}`);
    if (difference) return difference;
  }
  return null;
}

function retentionOperationV1ImmutablePrepareProjection(core) {
  return Object.freeze({
    sourceBuild: core.sourceBuild,
    productBuildAuthorityV2Observation: core.productBuildAuthorityV2Observation,
    expectedRuntimeSources: core.expectedRuntimeSources,
    executingImplementationClosure: core.executingImplementationClosure,
    candidateInventory: core.candidateInventory,
  });
}

function prepareBuildGenerationRetentionV1() {
  const root = repositoryRootV1();
  const roots = readAuthorityRootsV1(root);
  const inspectionBefore = scanRotationLedgerFromRoots(roots, { deferDisposedClosure: true });
  const candidate = currentActiveCandidateV1(inspectionBefore);
  const candidateCompletion = pairOf(candidate.completion, "completion");
  const activeBefore = inspectionBefore.generations.filter((generation) => generation.disposition === null);
  if (activeBefore.length > 8) fail("retention active generation bound is invalid");
  let operationVersion = 1;
  let authorities;
  if (activeBefore.length === 8) {
    const controllerSource = observeCurrentRetentionControllerSourceV2(root);
    const finalizedSourceSha = finalizedBuildSourceShaForClassifierV2(root);
    if (finalizedSourceSha === controllerSource.sourceSha) {
      authorities = observeOperationAuthoritiesV1(root);
    } else {
      operationVersion = 2;
      authorities = observeOperationAuthoritiesV2(root, inspectionBefore);
    }
  } else {
    authorities = observeOperationAuthoritiesV1(root);
  }
  const closureSource = operationVersion === 2
    ? Object.freeze({ sha: authorities.controllerSource.sourceSha })
    : authorities.sourceBuild;
  const closure = executingImplementationClosureV1(root, closureSource);
  const archive = path.join(root, candidate.completion.archiveLocator);
  const inventory = inventoryBuildGenerationV1(archive);
  if (
    inventory.physicalInventoryHash !== candidate.completion.inventory.physicalInventoryHash
    || inventory.contentInventoryHash !== candidate.completion.inventory.contentInventoryHash
  ) fail("retention candidate archive changed before prepare");
  const prepareProof = observeZeroReferenceProofV1({
    phase: "prepare",
    operation: null,
    candidateCompletion,
    candidate: { locator: archive, inventory },
    expectedRuntimeSources: authorities.expectedRuntimeSources,
  });
  const operationCore = operationVersion === 2 ? Object.freeze({
    schema: "setfarm.platform-build-generation-retention-operation.v2",
    purpose: "permanently-dispose-lowest-completed-build-generation-v1",
    candidateCompletion,
    candidateOrdinal: candidate.ordinal,
    controllerSource: authorities.controllerSource,
    retainedCurrentBuild: authorities.retainedCurrentBuild,
    productBuildAuthorityV2DeliveryEvidence: authorities.productBuildAuthorityV2DeliveryEvidence,
    productBuildAuthorityV2Observation: authorities.productBuildAuthorityV2Observation,
    expectedRuntimeSources: authorities.expectedRuntimeSources,
    executingImplementationClosure: closure,
    candidateArchiveLocator: candidate.completion.archiveLocator,
    candidateArchiveIdentity: candidate.completion.archiveIdentity,
    candidateInventory: inventory,
    prepareZeroReferenceProof: prepareProof,
    prepareZeroReferenceProofHash: prepareProof.proofHash,
  }) : Object.freeze({
    schema: "setfarm.platform-build-generation-retention-operation.v1",
    purpose: "permanently-dispose-lowest-completed-build-generation-v1",
    candidateCompletion,
    candidateOrdinal: candidate.ordinal,
    sourceBuild: authorities.sourceBuild,
    productBuildAuthorityV2DeliveryEvidence: authorities.productBuildAuthorityV2DeliveryEvidence,
    productBuildAuthorityV2Observation: authorities.productBuildAuthorityV2Observation,
    expectedRuntimeSources: authorities.expectedRuntimeSources,
    executingImplementationClosure: closure,
    candidateArchiveLocator: candidate.completion.archiveLocator,
    candidateArchiveIdentity: candidate.completion.archiveIdentity,
    candidateInventory: inventory,
    prepareZeroReferenceProof: prepareProof,
    prepareZeroReferenceProofHash: prepareProof.proofHash,
  });
  const operationHash = hashCanonicalJsonV1(operationCore);
  const proposed = Object.freeze({
    operationCore,
    expectedQuarantineLocator: `${QUARANTINE_DIRECTORY_V1}/${operationHash}.dist`,
    operationRef: operationRefV1(operationHash),
    operationHash,
  });
  const candidateKeyHash = hashCanonicalJsonV1(candidateCompletion);
  return withRetentionMaintenanceLockV1(roots, "retention_prepare", candidateKeyHash, () => {
    const stores = ensureRetentionStoreV1();
    normalizeRetentionPublisherStoresV1(stores);
    const inspection = scanRotationLedgerFromRoots(roots, { recoverPublisherTemps: true });
    const lockedCandidate = currentActiveCandidateV1(inspection);
    if (canonicalJsonV1(pairOf(lockedCandidate.completion, "completion")) !== canonicalJsonV1(candidateCompletion)) fail("retention candidate changed before publication");
    let publicationOperationCore = operationCore;
    let publicationProposed = proposed;
    if (operationVersion === 2) {
      const lockedAuthorities = observeOperationAuthoritiesV2(root, inspection);
      const lockedClosure = executingImplementationClosureV1(root, Object.freeze({ sha: lockedAuthorities.controllerSource.sourceSha }));
      const lockedInventory = inventoryBuildGenerationV1(path.join(root, lockedCandidate.completion.archiveLocator));
      const lockedProof = observeZeroReferenceProofV1({
        phase: "prepare",
        operation: null,
        candidateCompletion,
        candidate: { locator: path.join(root, lockedCandidate.completion.archiveLocator), inventory: lockedInventory },
        expectedRuntimeSources: lockedAuthorities.expectedRuntimeSources,
      });
      for (const [label, before, after] of [
        ["controller source", authorities.controllerSource, lockedAuthorities.controllerSource],
        ["retained build", authorities.retainedCurrentBuild, lockedAuthorities.retainedCurrentBuild],
        ["PBA", authorities.productBuildAuthorityV2Observation, lockedAuthorities.productBuildAuthorityV2Observation],
        ["expected runtime", authorities.expectedRuntimeSources, lockedAuthorities.expectedRuntimeSources],
        ["executing closure", closure, lockedClosure],
        ["candidate inventory", inventory, lockedInventory],
      ]) {
        if (canonicalJsonV1(before) !== canonicalJsonV1(after)) {
          fail(`retention v2 ${label} changed before publication at ${firstAuthorityDifferencePathV2(before, after)}`);
        }
      }
      publicationOperationCore = Object.freeze({
        ...operationCore,
        prepareZeroReferenceProof: lockedProof,
        prepareZeroReferenceProofHash: lockedProof.proofHash,
      });
      const lockedOperationHash = hashCanonicalJsonV1(publicationOperationCore);
      publicationProposed = Object.freeze({
        operationCore: publicationOperationCore,
        expectedQuarantineLocator: `${QUARANTINE_DIRECTORY_V1}/${lockedOperationHash}.dist`,
        operationRef: operationRefV1(lockedOperationHash),
        operationHash: lockedOperationHash,
      });
    }
    const indexFile = path.join(stores.operationCandidates, candidateIndexNameV1(candidateCompletion));
    if (optionalLstat(indexFile)) {
      const index = parseCandidateIndexV1(indexFile, candidateCompletion);
      const indexed = readRetentionOperationPairV1(stores, index.operation);
      if (indexed.operationCore.schema !== publicationOperationCore.schema) {
        fail("indexed retention operation schema differs from the current classifier");
      }
      if (indexed.operationCore.schema === "setfarm.platform-build-generation-retention-operation.v2"
        && canonicalJsonV1(indexed.operationCore) !== canonicalJsonV1(publicationOperationCore)) {
        fail(`indexed retention operation differs from current immutable authorities at ${firstAuthorityDifferencePathV2(indexed.operationCore, publicationOperationCore)}`);
      }
      return index.operation;
    }
    const recovered = findUnindexedOperationForCandidateV1(stores, candidateCompletion);
    const operation = recovered ?? publicationProposed;
    if (recovered && recovered.operationCore.schema !== publicationOperationCore.schema) {
      fail("unindexed retention operation schema differs from the current classifier");
    }
    if (recovered) {
      const recoveredProjection = recovered.operationCore.schema === "setfarm.platform-build-generation-retention-operation.v2"
        ? recovered.operationCore
        : retentionOperationV1ImmutablePrepareProjection(recovered.operationCore);
      const publicationProjection = publicationOperationCore.schema === "setfarm.platform-build-generation-retention-operation.v2"
        ? publicationOperationCore
        : retentionOperationV1ImmutablePrepareProjection(publicationOperationCore);
      if (canonicalJsonV1(recoveredProjection) !== canonicalJsonV1(publicationProjection)) {
        fail(`unindexed retention operation differs from current immutable authorities at ${firstAuthorityDifferencePathV2(recoveredProjection, publicationProjection)}`);
      }
    }
    publishNoReplaceFileV1(stores.operations, `${operation.operationHash}.json`, canonicalRecordBytes(operation), 0o600);
    const pair = operationPairV1(operation);
    const index = Object.freeze({ schema: "setfarm.platform-build-generation-retention-candidate-index.v1", candidateCompletion, operation: pair });
    publishNoReplaceFileV1(stores.operationCandidates, candidateIndexNameV1(candidateCompletion), canonicalRecordBytes(index), 0o600);
    parseCandidateIndexV1(indexFile, candidateCompletion);
    readRetentionOperationPairV1(stores, pair);
    return pair;
  });
}

function eraseRecordPairV1(record, kind) {
  const label = `${kind[0].toUpperCase()}${kind.slice(1)}`;
  return Object.freeze({ [`eraseStep${label}Ref`]: record[`eraseStep${label}Ref`], [`eraseStep${label}Hash`]: record[`eraseStep${label}Hash`] });
}

function eraseRecordRefV1(kind, digest) {
  return `setfarm://internal-production/build-generation-retention-erase-step-${kind}/sha256/${digest}`;
}

function quarantineAuthorizationRefV1(digest) {
  return `setfarm://internal-production/build-generation-retention-quarantine-authorization/sha256/${digest}`;
}

function publishQuarantineAuthorizationV1(stores, projection) {
  const digest = hashCanonicalJsonV1(projection);
  const record = Object.freeze({
    ...projection,
    quarantineAuthorizationRef: quarantineAuthorizationRefV1(digest),
    quarantineAuthorizationHash: digest,
  });
  publishNoReplaceFileV1(stores.eraseSteps, `${digest}.json`, canonicalRecordBytes(record), 0o600);
  return record;
}

function parseQuarantineAuthorizationV1(file) {
  const value = parseCanonicalRecord(file).value;
  const projection = { ...value };
  delete projection.quarantineAuthorizationRef;
  delete projection.quarantineAuthorizationHash;
  const digest = hashCanonicalJsonV1(projection);
  if (
    value?.schema !== "setfarm.platform-build-generation-retention-quarantine-authorization.v1"
    || value.recordKind !== "quarantine_authorization"
    || value.quarantineAuthorizationHash !== digest
    || value.quarantineAuthorizationRef !== quarantineAuthorizationRefV1(digest)
    || path.basename(file) !== `${digest}.json`
  ) fail("quarantine authorization body is invalid");
  assertEraseStoreBodyV1(value, path.basename(file));
  return value;
}

function readOnlyQuarantineAuthorizationV1(stores, operationPair) {
  const matches = [];
  for (const name of readdirSync(stores.eraseSteps).sort(compareBytes)) {
    if (!/^[0-9a-f]{64}\.json$/.test(name)) continue;
    const file = path.join(stores.eraseSteps, name);
    const value = parseCanonicalRecord(file).value;
    if (value?.recordKind !== "quarantine_authorization") continue;
    const record = parseQuarantineAuthorizationV1(file);
    if (canonicalJsonV1(record.operation) === canonicalJsonV1(operationPair)) matches.push(record);
  }
  if (matches.length > 1) fail("quarantine authorization fork");
  return matches[0] ?? null;
}

function publishEraseRecordV1(stores, kind, projection) {
  const digest = hashCanonicalJsonV1(projection);
  const label = `${kind[0].toUpperCase()}${kind.slice(1)}`;
  const refKey = `eraseStep${label}Ref`;
  const hashKey = `eraseStep${label}Hash`;
  const record = Object.freeze({ ...projection, [refKey]: eraseRecordRefV1(kind, digest), [hashKey]: digest });
  publishNoReplaceFileV1(stores.eraseSteps, `${digest}.json`, canonicalRecordBytes(record), 0o600);
  return record;
}

function parseEraseRecordV1(file) {
  const value = parseCanonicalRecord(file).value;
  const kind = value?.recordKind;
  if (!['intent', 'completion'].includes(kind)) fail("erase-step kind is invalid");
  const label = `${kind[0].toUpperCase()}${kind.slice(1)}`;
  const refKey = `eraseStep${label}Ref`;
  const hashKey = `eraseStep${label}Hash`;
  const projection = { ...value };
  delete projection[refKey];
  delete projection[hashKey];
  const digest = hashCanonicalJsonV1(projection);
  if (value[hashKey] !== digest || value[refKey] !== eraseRecordRefV1(kind, digest) || path.basename(file) !== `${digest}.json`) {
    fail("erase-step ref/hash/file mismatch");
  }
  assertEraseStoreBodyV1(value, path.basename(file));
  return value;
}

function scanEraseChainV1(stores, operationPair) {
  const intents = new Map();
  const completions = new Map();
  const names = readdirSync(stores.eraseSteps).sort(compareBytes);
  if (names.length > (MAX_TREE_ENTRIES_V1 + 1) * 2 * MAX_LEDGER_ORDINALS_V1) fail("erase-step store capacity exceeded");
  for (const name of names) {
    if (!/^[0-9a-f]{64}\.json$/.test(name)) fail("erase-step store has an invalid dirent");
    const file = path.join(stores.eraseSteps, name);
    const generic = parseCanonicalRecord(file).value;
    if (generic?.recordKind === "quarantine_authorization") {
      parseQuarantineAuthorizationV1(file);
      continue;
    }
    const record = parseEraseRecordV1(file);
    if (canonicalJsonV1(record.operation) !== canonicalJsonV1(operationPair)) continue;
    if (!Number.isSafeInteger(record.ordinal) || record.ordinal < 0 || record.ordinal > MAX_TREE_ENTRIES_V1) fail("erase-step ordinal is invalid");
    const target = record.recordKind === "intent" ? intents : completions;
    if (target.has(record.ordinal)) fail("erase-step fork");
    target.set(record.ordinal, record);
  }
  let predecessor = null;
  let unmatchedIntent = null;
  let ordinal = 0;
  while (intents.has(ordinal)) {
    const intent = intents.get(ordinal);
    if (canonicalJsonV1(intent.predecessorCompletion) !== canonicalJsonV1(predecessor)) fail("erase-step predecessor mismatch");
    const completion = completions.get(ordinal);
    if (!completion) {
      unmatchedIntent = intent;
      ordinal += 1;
      break;
    }
    if (
      canonicalJsonV1(completion.operation) !== canonicalJsonV1(operationPair)
      || canonicalJsonV1(completion.predecessorCompletion) !== canonicalJsonV1(predecessor)
      || canonicalJsonV1(completion.intent) !== canonicalJsonV1(eraseRecordPairV1(intent, "intent"))
      || completion.ordinal !== ordinal || completion.locator !== intent.locator
      || completion.kind !== intent.kind || completion.action !== intent.action
      || canonicalJsonV1(completion.identity) !== canonicalJsonV1(intent.identity)
      || completion.remainingBeforeHash !== intent.remainingBeforeHash
      || completion.remainingAfterHash !== intent.remainingAfterHash
      || completion.targetAbsent !== true
    ) fail("erase-step completion mismatch");
    predecessor = eraseRecordPairV1(completion, "completion");
    ordinal += 1;
  }
  if (unmatchedIntent && intents.has(ordinal)) fail("erase-step exists after an unmatched intent");
  for (const key of [...intents.keys(), ...completions.keys()]) {
    if (key >= ordinal || (!intents.has(key) && completions.has(key))) fail("erase-step chain has a gap or suffix fork");
  }
  return Object.freeze({ nextOrdinal: unmatchedIntent ? ordinal - 1 : ordinal, predecessorCompletion: predecessor, unmatchedIntent, finalCompletion: predecessor });
}

function deletionOrderV1(inventory) {
  const files = inventory.entries.filter((entry) => entry.kind === "regular_file").sort((left, right) => compareBytes(right.locator, left.locator));
  const directories = inventory.entries.filter((entry) => entry.kind === "directory").sort((left, right) => {
    const depth = right.locator.split("/").length - left.locator.split("/").length;
    return depth || compareBytes(right.locator, left.locator);
  });
  return Object.freeze([...files, ...directories, Object.freeze({
    locator: ".",
    kind: "root",
    devDecimal: inventory.rootPhysicalIdentity.devDecimal,
    inoDecimal: inventory.rootPhysicalIdentity.inoDecimal,
    mode: inventory.rootPhysicalIdentity.mode,
    linkCount: inventory.rootPhysicalIdentity.linkCount,
    byteLength: null,
    sha256: null,
  })]);
}

function remainingLocatorProjectionV1(root) {
  if (!optionalLstat(root)) return Object.freeze([]);
  const locators = [];
  function visit(directory, relative, depth) {
    if (depth > MAX_TREE_DEPTH_V1) fail("remaining generation depth cap exceeded");
    for (const name of readdirSync(directory).sort(compareBytes)) {
      const locator = relative ? `${relative}/${name}` : name;
      canonicalRelativeLocator(locator);
      const target = path.join(directory, name);
      const stats = lstatSync(target, { bigint: true });
      if (stats.isSymbolicLink() || (!stats.isDirectory() && !stats.isFile())) fail("remaining generation contains an unknown entry");
      locators.push(locator);
      if (stats.isDirectory()) visit(target, locator, depth + 1);
      if (locators.length > MAX_TREE_ENTRIES_V1) fail("remaining generation entry cap exceeded");
    }
  }
  visit(root, "", 0);
  locators.sort(compareBytes);
  return Object.freeze(locators);
}

function remainingSubsetHashV1(locators) {
  return hashCanonicalJsonV1({ schema: "setfarm.platform-build-generation-remaining-subset.v1", locators });
}

function assertRemainingInventoryIdentityV1(root, expectedLocators, inventory) {
  const observedLocators = remainingLocatorProjectionV1(root);
  if (canonicalJsonV1(observedLocators) !== canonicalJsonV1(expectedLocators)) fail("remaining generation locator subset changed");
  if (!optionalLstat(root)) {
    if (expectedLocators.length !== 0) fail("remaining generation root disappeared before its members");
    return;
  }
  const rootStats = lstatSync(root, { bigint: true });
  const rootLinks = Number(rootStats.nlink);
  if (
    !rootStats.isDirectory() || rootStats.isSymbolicLink()
    || rootStats.dev.toString(10) !== inventory.rootPhysicalIdentity.devDecimal
    || rootStats.ino.toString(10) !== inventory.rootPhysicalIdentity.inoDecimal
    || modeOf(rootStats) !== inventory.rootPhysicalIdentity.mode
    || !Number.isSafeInteger(rootLinks) || rootLinks < 1
  ) fail("remaining generation root identity changed");
  const entries = new Map(inventory.entries.map((entry) => [entry.locator, entry]));
  for (const locator of expectedLocators) {
    const expected = entries.get(locator);
    if (!expected) fail(`remaining generation has an unbound locator ${locator}`);
    const target = path.join(root, locator);
    const stats = lstatSync(target, { bigint: true });
    if (
      stats.dev.toString(10) !== expected.devDecimal || stats.ino.toString(10) !== expected.inoDecimal
      || modeOf(stats) !== expected.mode || stats.isSymbolicLink()
    ) fail(`remaining generation identity changed at ${locator}`);
    if (expected.kind === "regular_file") {
      if (!stats.isFile() || stats.nlink !== 1n || Number(stats.size) !== expected.byteLength) fail(`remaining file metadata changed at ${locator}`);
      const observed = readStableRegular(target, { device: stats.dev, mode: expected.mode, linkCounts: [1], maxBytes: MAX_FILE_BYTES_V1 });
      if (sha256(observed.bytes) !== expected.sha256) fail(`remaining file bytes changed at ${locator}`);
    } else {
      const links = Number(stats.nlink);
      if (!stats.isDirectory() || !Number.isSafeInteger(links) || links < 1) fail(`remaining directory metadata changed at ${locator}`);
    }
  }
}

function assertStepTargetV1(root, step) {
  const target = step.locator === "." ? root : path.join(root, step.locator);
  const stats = lstatSync(target, { bigint: true });
  if (
    stats.dev.toString(10) !== step.devDecimal || stats.ino.toString(10) !== step.inoDecimal
    || modeOf(stats) !== step.mode
  ) fail(`erase target identity changed at ${step.locator}`);
  if (step.kind === "regular_file") {
    if (!stats.isFile() || stats.nlink !== 1n || Number(stats.size) !== step.byteLength) fail(`erase file metadata changed at ${step.locator}`);
    const observed = readStableRegular(target, { device: stats.dev, mode: step.mode, linkCounts: [1], maxBytes: MAX_FILE_BYTES_V1 });
    if (sha256(observed.bytes) !== step.sha256) fail(`erase file bytes changed at ${step.locator}`);
  } else {
    if (!stats.isDirectory() || stats.isSymbolicLink()) fail(`erase directory type changed at ${step.locator}`);
    const linkCount = Number(stats.nlink);
    if (!Number.isSafeInteger(linkCount) || linkCount < 1) fail(`erase directory link snapshot is invalid at ${step.locator}`);
  }
  return Object.freeze({
    target,
    identity: Object.freeze({ devDecimal: stats.dev.toString(10), inoDecimal: stats.ino.toString(10), mode: modeOf(stats), linkCount: Number(stats.nlink) }),
  });
}

function executeEraseStepV1(quarantine, step, intent) {
  const target = step.locator === "." ? quarantine : path.join(quarantine, step.locator);
  const parent = path.dirname(target);
  if (intent.action === "unlink") unlinkSync(target);
  else rmdirSync(target);
  fsyncDirectory(parent);
  if (optionalLstat(target)) fail(`erase target remained at ${step.locator}`);
}

function receiptRefV1(digest) {
  return `setfarm://internal-production/build-generation-retention-receipt/sha256/${digest}`;
}

function publishReceiptV1(stores, projection) {
  const digest = hashCanonicalJsonV1(projection);
  const receipt = Object.freeze({ ...projection, receiptRef: receiptRefV1(digest), receiptHash: digest });
  publishNoReplaceFileV1(stores.receipts, `${digest}.json`, canonicalRecordBytes(receipt), 0o600);
  return receipt;
}

function parseReceiptFileV1(file) {
  const value = parseCanonicalRecord(file, 0o600, [1, 2]).value;
  const projection = { ...value };
  delete projection.receiptRef;
  delete projection.receiptHash;
  if (value.receiptHash !== hashCanonicalJsonV1(projection) || value.receiptRef !== receiptRefV1(value.receiptHash) || path.basename(file) !== `${value.receiptHash}.json`) {
    fail("retention receipt body is invalid");
  }
  assertReceiptPublisherBodyV1(value, path.basename(file));
  return value;
}

function readReceiptPairV1(stores, pair) {
  if (!pair || !SHA256.test(pair.receiptHash) || pair.receiptRef !== receiptRefV1(pair.receiptHash)) fail("retention receipt pair is invalid");
  const value = parseReceiptFileV1(path.join(stores.receipts, `${pair.receiptHash}.json`));
  return value;
}

function publishOrAdoptOnlyReceiptV1(stores, projection) {
  const matchingOperation = readdirSync(stores.receipts).sort(compareBytes).map((name) => {
    if (!/^[0-9a-f]{64}\.json$/.test(name)) fail("retention receipt store has an invalid dirent");
    return parseReceiptFileV1(path.join(stores.receipts, name));
  }).filter((receipt) => receipt.operationRef === projection.operationRef && receipt.operationHash === projection.operationHash);
  if (matchingOperation.length > 1) fail("retention receipt fork");
  const expectedHash = hashCanonicalJsonV1(projection);
  if (matchingOperation.length === 1) {
    const existing = matchingOperation[0];
    if (existing.receiptHash !== expectedHash) fail("retention receipt differs from the authenticated terminal prefix");
    const existingProjection = { ...existing };
    delete existingProjection.receiptRef;
    delete existingProjection.receiptHash;
    if (canonicalJsonV1(existingProjection) !== canonicalJsonV1(projection)) fail("retention receipt differs from the authenticated terminal prefix");
    return existing;
  }
  return publishReceiptV1(stores, projection);
}

function validateHistoricalClosureV1(root, operation) {
  const current = executingImplementationClosureV1(root, operation.operationCore.sourceBuild);
  if (canonicalJsonV1(current) !== canonicalJsonV1(operation.operationCore.executingImplementationClosure)) fail("historical retention executing closure changed");
}

function validateHistoricalClosureV2(root, operation) {
  const current = executingImplementationClosureV1(root, Object.freeze({ sha: operation.operationCore.controllerSource.sourceSha }));
  if (canonicalJsonV1(current) !== canonicalJsonV1(operation.operationCore.executingImplementationClosure)) fail("historical retention executing closure changed");
}

function validateHistoricalRetainedBuildV2(root, operation) {
  if (operation.operationCore.schema !== "setfarm.platform-build-generation-retention-operation.v2") return;
  const current = observeRetainedCurrentBuildV1(root, operation.operationCore.controllerSource);
  if (canonicalJsonV1(current) !== canonicalJsonV1(operation.operationCore.retainedCurrentBuild)) {
    fail(`historical retained build changed at ${firstAuthorityDifferencePathV2(operation.operationCore.retainedCurrentBuild, current)}`);
  }
}

function validateHistoricalOperationClosureV1(root, operation) {
  if (operation.operationCore.schema === "setfarm.platform-build-generation-retention-operation.v1") return validateHistoricalClosureV1(root, operation);
  if (operation.operationCore.schema === "setfarm.platform-build-generation-retention-operation.v2") return validateHistoricalClosureV2(root, operation);
  fail("historical retention operation schema is invalid");
}

function resolveCandidateGenerationV1(inspection, operation) {
  const generation = inspection.generations.find((entry) => entry.ordinal === operation.operationCore.candidateOrdinal);
  if (!generation || canonicalJsonV1(pairOf(generation.completion, "completion")) !== canonicalJsonV1(operation.operationCore.candidateCompletion)) {
    fail("retention operation candidate completion is unavailable");
  }
  return generation;
}

function resolveDisposedGenerationClosureV1(roots, generation) {
  const disposition = generation.disposition;
  if (!disposition) fail("disposed generation closure lacks disposition");
  const stores = existingRetentionStoreDirectoriesV1();
  if (!stores) fail("disposed generation lacks the retention authority store");
  const operation = readRetentionOperationPairV1(stores, disposition.retentionOperation);
  const operationPair = operationPairV1(operation);
  const completionPair = pairOf(generation.completion, "completion");
  if (
    operation.operationCore.candidateOrdinal !== generation.ordinal
    || canonicalJsonV1(operation.operationCore.candidateCompletion) !== canonicalJsonV1(completionPair)
    || operation.operationCore.candidateArchiveLocator !== generation.completion.archiveLocator
    || canonicalJsonV1(operation.operationCore.candidateArchiveIdentity) !== canonicalJsonV1(generation.completion.archiveIdentity)
    || canonicalJsonV1(operation.operationCore.candidateInventory) !== canonicalJsonV1(generation.completion.inventory)
  ) fail("disposed generation operation is crossed");
  const index = parseCandidateIndexV1(
    path.join(stores.operationCandidates, candidateIndexNameV1(completionPair)),
    completionPair,
  );
  if (canonicalJsonV1(index.operation) !== canonicalJsonV1(operationPair)) fail("disposed generation candidate index is crossed");
  const indexedOperation = findUnindexedOperationForCandidateV1(stores, completionPair);
  if (!indexedOperation || canonicalJsonV1(operationPairV1(indexedOperation)) !== canonicalJsonV1(operationPair)) {
    fail("disposed generation candidate operation is missing or forked");
  }
  const receipt = readReceiptPairV1(stores, disposition.retentionReceipt);
  if (
    receipt.operationRef !== operation.operationRef || receipt.operationHash !== operation.operationHash
    || receipt.sourceAbsent !== true || receipt.permanentDisposition !== true || receipt.quarantineAbsent !== true
    || receipt.quarantineLocator !== operation.expectedQuarantineLocator
    || canonicalJsonV1(receipt.quarantineInventory) !== canonicalJsonV1(operation.operationCore.candidateInventory)
    || receipt.erasedEntryCount !== operation.operationCore.candidateInventory.entryCount
    || receipt.erasedRegularFileByteCount !== operation.operationCore.candidateInventory.regularFileByteCount
    || receipt.preDispositionZeroReferenceProofHash !== receipt.preDispositionZeroReferenceProof?.proofHash
    || receipt.postQuarantineZeroReferenceProofHash !== receipt.postQuarantineZeroReferenceProof?.proofHash
  ) fail("disposed generation receipt is crossed");
  assertRecordPairV1({ eraseStepCompletionRef: receipt.finalEraseStepRef, eraseStepCompletionHash: receipt.finalEraseStepHash }, "eraseStepCompletion");
  const matchingReceipts = readdirSync(stores.receipts).sort(compareBytes).map((name) => {
    if (!/^[0-9a-f]{64}\.json$/.test(name)) fail("retention receipt store has an invalid dirent");
    return parseReceiptFileV1(path.join(stores.receipts, name));
  }).filter((candidate) => candidate.operationRef === operation.operationRef && candidate.operationHash === operation.operationHash);
  if (matchingReceipts.length !== 1 || matchingReceipts[0].receiptHash !== receipt.receiptHash) fail("disposed generation receipt is missing or forked");
  const eraseChain = scanEraseChainV1(stores, operationPair);
  const eraseOrder = deletionOrderV1(operation.operationCore.candidateInventory);
  const expectedFinalPair = { eraseStepCompletionRef: receipt.finalEraseStepRef, eraseStepCompletionHash: receipt.finalEraseStepHash };
  if (
    eraseChain.unmatchedIntent !== null || eraseChain.nextOrdinal !== eraseOrder.length
    || canonicalJsonV1(eraseChain.finalCompletion) !== canonicalJsonV1(expectedFinalPair)
  ) fail("disposed generation erase chain is not terminal at the receipt root completion");
  const finalCompletion = parseEraseRecordV1(path.join(stores.eraseSteps, `${receipt.finalEraseStepHash}.json`));
  const emptySubsetHash = remainingSubsetHashV1([]);
  if (
    finalCompletion.recordKind !== "completion" || finalCompletion.ordinal !== eraseOrder.length - 1
    || finalCompletion.locator !== "." || finalCompletion.kind !== "root" || finalCompletion.action !== "rmdir"
    || finalCompletion.targetAbsent !== true || finalCompletion.remainingBeforeHash !== emptySubsetHash
    || finalCompletion.remainingAfterHash !== emptySubsetHash
    || finalCompletion.identity.devDecimal !== operation.operationCore.candidateInventory.rootPhysicalIdentity.devDecimal
    || finalCompletion.identity.inoDecimal !== operation.operationCore.candidateInventory.rootPhysicalIdentity.inoDecimal
    || finalCompletion.identity.mode !== operation.operationCore.candidateInventory.rootPhysicalIdentity.mode
  ) fail("disposed generation final erase completion is not the exact root terminal");
  assertZeroReferenceProofV1(receipt.preDispositionZeroReferenceProof, "pre_disposition", operationPair, completionPair, operation.operationCore.expectedRuntimeSources);
  assertZeroReferenceProofV1(receipt.postQuarantineZeroReferenceProof, "post_quarantine", operationPair, completionPair, operation.operationCore.expectedRuntimeSources);
  const expectedQuarantineIdentity = { realpath: path.join(roots.root, operation.expectedQuarantineLocator), ...operation.operationCore.candidateInventory.rootPhysicalIdentity };
  if (canonicalJsonV1(receipt.quarantineIdentity) !== canonicalJsonV1(expectedQuarantineIdentity)) fail("disposed generation quarantine identity is crossed");
  if (
    disposition.quarantineLocator !== operation.expectedQuarantineLocator
    || canonicalJsonV1(disposition.retentionOperation) !== canonicalJsonV1(operationPair)
    || canonicalJsonV1(disposition.retentionReceipt) !== canonicalJsonV1({ receiptRef: receipt.receiptRef, receiptHash: receipt.receiptHash })
    || canonicalJsonV1(disposition.completion) !== canonicalJsonV1(completionPair)
    || optionalLstat(path.join(roots.root, generation.completion.archiveLocator))
    || optionalLstat(path.join(roots.root, operation.expectedQuarantineLocator))
  ) fail("disposed generation terminal filesystem/pairs are invalid");
}

function resumeBuildGenerationRetentionV1(pair) {
  const root = repositoryRootV1();
  const roots = readAuthorityRootsV1(root);
  const stores = existingRetentionStoreDirectoriesV1();
  if (!stores) fail("retention operation store is absent");
  const operation = readRetentionOperationPairV1(stores, pair);
  const operationPair = operationPairV1(operation);
  const index = parseCandidateIndexV1(path.join(stores.operationCandidates, candidateIndexNameV1(operation.operationCore.candidateCompletion)), operation.operationCore.candidateCompletion);
  if (canonicalJsonV1(index.operation) !== canonicalJsonV1(operationPair)) fail("retention candidate index/operation mismatch");
  validateHistoricalOperationClosureV1(root, operation);
  const lockKey = hashCanonicalJsonV1({ candidateCompletion: operation.operationCore.candidateCompletion, operation: operationPair });
  return withRetentionMaintenanceLockV1(roots, "retention_resume", lockKey, () => {
    normalizeRetentionPublisherStoresV1(stores);
    const inspection = scanRotationLedgerFromRoots(roots, {
      allowAbsentCompletionPair: operation.operationCore.candidateCompletion,
      recoverPublisherTemps: true,
    });
    const generation = resolveCandidateGenerationV1(inspection, operation);
    if (generation.disposition) {
      if (canonicalJsonV1(generation.disposition.retentionOperation) !== canonicalJsonV1(operationPair)) fail("terminal disposition operation mismatch");
      const receipt = readReceiptPairV1(stores, generation.disposition.retentionReceipt);
      if (
        receipt.operationRef !== operation.operationRef || receipt.operationHash !== operation.operationHash
        || receipt.permanentDisposition !== true || receipt.quarantineAbsent !== true
        || generation.disposition.quarantineAbsent !== true || generation.disposition.permanentDisposition !== true
      ) fail("terminal retention receipt/disposition is invalid");
      return Object.freeze({ receiptRef: receipt.receiptRef, receiptHash: receipt.receiptHash });
    }
    validateHistoricalOperationClosureV1(root, operation);
    validateHistoricalRetainedBuildV2(root, operation);
    const archive = path.join(root, operation.operationCore.candidateArchiveLocator);
    const quarantineRoot = path.join(root, QUARANTINE_DIRECTORY_V1);
    if (!optionalLstat(quarantineRoot)) ensureDirectory(quarantineRoot, 0o700, roots.setfarm, roots.device);
    else if (directoryIdentity(quarantineRoot, roots.device).mode !== 0o700) fail("quarantine root must have mode 0o700");
    const quarantine = path.join(root, operation.expectedQuarantineLocator);
    const children = readdirSync(quarantineRoot).sort(compareBytes);
    if (children.length > MAX_QUARANTINED_GENERATIONS_V1 || children.some((name) => name !== `${operation.operationHash}.dist`)) fail("quarantine contains an unrelated generation");
    let chain = scanEraseChainV1(stores, operationPair);
    const priorEraseRecords = readdirSync(stores.eraseSteps).flatMap((name) => {
      const file = path.join(stores.eraseSteps, name);
      const generic = parseCanonicalRecord(file).value;
      return generic?.recordKind === "quarantine_authorization" ? [] : [parseEraseRecordV1(file)];
    }).filter((record) => canonicalJsonV1(record.operation) === canonicalJsonV1(operationPair));
    const order = deletionOrderV1(operation.operationCore.candidateInventory);
    if (chain.nextOrdinal > order.length || (chain.nextOrdinal === order.length && chain.unmatchedIntent)) fail("erase-step chain exceeds the bound inventory");
    for (const intent of priorEraseRecords.filter((record) => record.recordKind === "intent")) {
      const step = order[intent.ordinal];
      if (!step) fail("erase-step intent exceeds the fixed deletion order");
      const beforeLocators = order.slice(intent.ordinal).filter((entry) => entry.locator !== ".").map((entry) => entry.locator).sort(compareBytes);
      const afterLocators = order.slice(intent.ordinal + 1).filter((entry) => entry.locator !== ".").map((entry) => entry.locator).sort(compareBytes);
      if (
        intent.locator !== step.locator || intent.kind !== step.kind
        || intent.action !== (step.kind === "regular_file" ? "unlink" : "rmdir")
        || intent.identity?.devDecimal !== step.devDecimal || intent.identity?.inoDecimal !== step.inoDecimal
        || intent.identity?.mode !== step.mode
        || (step.kind === "regular_file" && intent.identity?.linkCount !== 1)
        || intent.byteLength !== step.byteLength || intent.sha256 !== step.sha256
        || intent.remainingBeforeHash !== remainingSubsetHashV1(beforeLocators)
        || intent.remainingAfterHash !== remainingSubsetHashV1(afterLocators)
      ) fail("erase-step intent differs from the operation-bound deletion order");
    }
    const persistedInitialIntent = priorEraseRecords.find((record) => record.recordKind === "intent" && record.ordinal === 0) ?? null;
    const archivePresent = Boolean(optionalLstat(archive));
    const quarantinePresent = Boolean(optionalLstat(quarantine));
    let quarantineAuthorization = readOnlyQuarantineAuthorizationV1(stores, operationPair);
    const authenticatedEmptyRootResponseLoss = !archivePresent && !quarantinePresent
      && order.length === 1 && chain.nextOrdinal === 0 && chain.unmatchedIntent?.ordinal === 0
      && chain.unmatchedIntent.locator === "." && chain.unmatchedIntent.kind === "root"
      && chain.unmatchedIntent.action === "rmdir" && quarantineAuthorization !== null;
    if (chain.nextOrdinal === 0 && !chain.unmatchedIntent) {
      if (archivePresent && !quarantinePresent) {
        const before = inventoryBuildGenerationV1(archive);
        if (before.physicalInventoryHash !== operation.operationCore.candidateInventory.physicalInventoryHash || before.contentInventoryHash !== operation.operationCore.candidateInventory.contentInventoryHash) fail("candidate archive changed before quarantine");
        const preDispositionProof = observeZeroReferenceProofV1({ phase: "pre_disposition", operation: operationPair, candidateCompletion: operation.operationCore.candidateCompletion, candidate: { locator: archive, inventory: before }, expectedRuntimeSources: operation.operationCore.expectedRuntimeSources });
        const authorizationProjection = {
          schema: "setfarm.platform-build-generation-retention-quarantine-authorization.v1",
          recordKind: "quarantine_authorization",
          operation: operationPair,
          candidateCompletion: operation.operationCore.candidateCompletion,
          candidateArchiveLocator: operation.operationCore.candidateArchiveLocator,
          expectedQuarantineLocator: operation.expectedQuarantineLocator,
          candidateArchiveIdentity: operation.operationCore.candidateArchiveIdentity,
          physicalInventoryHash: operation.operationCore.candidateInventory.physicalInventoryHash,
          contentInventoryHash: operation.operationCore.candidateInventory.contentInventoryHash,
          preDispositionZeroReferenceProof: preDispositionProof,
          preDispositionZeroReferenceProofHash: preDispositionProof.proofHash,
        };
        const proposedHash = hashCanonicalJsonV1(authorizationProjection);
        if (quarantineAuthorization) {
          if (quarantineAuthorization.quarantineAuthorizationHash !== proposedHash) fail("quarantine authorization differs from the current archive proof");
        } else quarantineAuthorization = publishQuarantineAuthorizationV1(stores, authorizationProjection);
        renameSync(archive, quarantine);
        fsyncDirectory(roots.archive);
        fsyncDirectory(quarantineRoot);
      } else if (!archivePresent && quarantinePresent) {
        if (!quarantineAuthorization) fail("quarantine rename response loss lacks its durable archive-side proof");
        const adopted = inventoryBuildGenerationV1(quarantine);
        if (adopted.physicalInventoryHash !== operation.operationCore.candidateInventory.physicalInventoryHash || adopted.contentInventoryHash !== operation.operationCore.candidateInventory.contentInventoryHash) fail("quarantine rename destination differs from the operation inventory");
      } else fail("retention archive/quarantine rename state is ambiguous");
    } else if (archivePresent || (!quarantinePresent && chain.nextOrdinal === 0 && !authenticatedEmptyRootResponseLoss)) fail("erase prefix conflicts with archive/quarantine state");
    if (!quarantineAuthorization) fail("retention erase state lacks its quarantine authorization");
    if (
      canonicalJsonV1(quarantineAuthorization.operation) !== canonicalJsonV1(operationPair)
      || canonicalJsonV1(quarantineAuthorization.candidateCompletion) !== canonicalJsonV1(operation.operationCore.candidateCompletion)
      || quarantineAuthorization.candidateArchiveLocator !== operation.operationCore.candidateArchiveLocator
      || quarantineAuthorization.expectedQuarantineLocator !== operation.expectedQuarantineLocator
      || canonicalJsonV1(quarantineAuthorization.candidateArchiveIdentity) !== canonicalJsonV1(operation.operationCore.candidateArchiveIdentity)
      || quarantineAuthorization.physicalInventoryHash !== operation.operationCore.candidateInventory.physicalInventoryHash
      || quarantineAuthorization.contentInventoryHash !== operation.operationCore.candidateInventory.contentInventoryHash
      || quarantineAuthorization.preDispositionZeroReferenceProofHash !== quarantineAuthorization.preDispositionZeroReferenceProof?.proofHash
    ) fail("quarantine authorization is crossed or incomplete");
    assertZeroReferenceProofV1(quarantineAuthorization.preDispositionZeroReferenceProof, "pre_disposition", operationPair, operation.operationCore.candidateCompletion, operation.operationCore.expectedRuntimeSources);
    const quarantineInventory = operation.operationCore.candidateInventory;
    const quarantineIdentity = Object.freeze({
      realpath: quarantine,
      ...operation.operationCore.candidateInventory.rootPhysicalIdentity,
    });
    if (optionalLstat(quarantine)) {
      const liveQuarantine = directoryIdentity(quarantine, roots.device);
      if (!sameDirectoryObject(liveQuarantine, quarantineIdentity)) fail("quarantine root identity changed");
    }
    const postQuarantineProof = persistedInitialIntent?.postQuarantineZeroReferenceProof ?? observeZeroReferenceProofV1({ phase: "post_quarantine", operation: operationPair, candidateCompletion: operation.operationCore.candidateCompletion, candidate: { locator: quarantine, inventory: quarantineInventory }, expectedRuntimeSources: operation.operationCore.expectedRuntimeSources });
    while (chain.nextOrdinal < order.length) {
      const step = order[chain.nextOrdinal];
      const currentLocators = remainingLocatorProjectionV1(quarantine);
      const beforeLocators = order.slice(chain.nextOrdinal).filter((entry) => entry.locator !== ".").map((entry) => entry.locator).sort(compareBytes);
      const afterLocators = order.slice(chain.nextOrdinal + 1).filter((entry) => entry.locator !== ".").map((entry) => entry.locator).sort(compareBytes);
      const beforeHash = remainingSubsetHashV1(beforeLocators);
      const afterHash = remainingSubsetHashV1(afterLocators);
      let intent = chain.unmatchedIntent;
      if (intent) {
        if (intent.ordinal !== chain.nextOrdinal || intent.locator !== step.locator || intent.remainingBeforeHash !== beforeHash || intent.remainingAfterHash !== afterHash) fail("unmatched erase intent differs from fixed order");
      } else {
        if (canonicalJsonV1(currentLocators) !== canonicalJsonV1(beforeLocators)) fail("remaining generation subset differs before erase intent");
        const observed = assertStepTargetV1(quarantine, step);
        intent = publishEraseRecordV1(stores, "intent", {
          schema: "setfarm.platform-build-generation-retention-erase-step-intent.v1",
          recordKind: "intent",
          operation: operationPair,
          ordinal: chain.nextOrdinal,
          predecessorCompletion: chain.predecessorCompletion,
          locator: step.locator,
          kind: step.kind,
          identity: observed.identity,
          byteLength: step.byteLength,
          sha256: step.sha256,
          action: step.kind === "regular_file" ? "unlink" : "rmdir",
          remainingBeforeHash: beforeHash,
          remainingAfterHash: afterHash,
          preDispositionZeroReferenceProof: chain.nextOrdinal === 0 ? quarantineAuthorization.preDispositionZeroReferenceProof : null,
          postQuarantineZeroReferenceProof: chain.nextOrdinal === 0 ? postQuarantineProof : null,
        });
      }
      const target = step.locator === "." ? quarantine : path.join(quarantine, step.locator);
      const targetPresent = Boolean(optionalLstat(target));
      const observedLocators = remainingLocatorProjectionV1(quarantine);
      if (targetPresent && canonicalJsonV1(observedLocators) === canonicalJsonV1(beforeLocators)) {
        assertRemainingInventoryIdentityV1(quarantine, beforeLocators, operation.operationCore.candidateInventory);
        assertStepTargetV1(quarantine, step);
        executeEraseStepV1(quarantine, step, intent);
      } else if (!targetPresent && canonicalJsonV1(observedLocators) === canonicalJsonV1(afterLocators)) {
        assertRemainingInventoryIdentityV1(quarantine, afterLocators, operation.operationCore.candidateInventory);
        // Authenticated response-loss adoption.
      } else fail("erase intent target/subset state is ambiguous");
      assertRemainingInventoryIdentityV1(quarantine, afterLocators, operation.operationCore.candidateInventory);
      const completion = publishEraseRecordV1(stores, "completion", {
        schema: "setfarm.platform-build-generation-retention-erase-step-completion.v1",
        recordKind: "completion",
        operation: operationPair,
        ordinal: intent.ordinal,
        predecessorCompletion: intent.predecessorCompletion,
        intent: eraseRecordPairV1(intent, "intent"),
        locator: intent.locator,
        kind: intent.kind,
        identity: intent.identity,
        action: intent.action,
        remainingBeforeHash: intent.remainingBeforeHash,
        remainingAfterHash: intent.remainingAfterHash,
        targetAbsent: true,
      });
      chain = Object.freeze({ nextOrdinal: chain.nextOrdinal + 1, predecessorCompletion: eraseRecordPairV1(completion, "completion"), unmatchedIntent: null, finalCompletion: eraseRecordPairV1(completion, "completion") });
    }
    if (optionalLstat(archive) || optionalLstat(quarantine)) fail("terminal erase endpoints are not absent");
    const firstIntent = scanEraseChainV1(stores, operationPair);
    const allRecords = readdirSync(stores.eraseSteps).flatMap((name) => {
      const file = path.join(stores.eraseSteps, name);
      const generic = parseCanonicalRecord(file).value;
      return generic?.recordKind === "quarantine_authorization" ? [] : [parseEraseRecordV1(file)];
    }).filter((record) => canonicalJsonV1(record.operation) === canonicalJsonV1(operationPair));
    const initialIntent = allRecords.find((record) => record.recordKind === "intent" && record.ordinal === 0);
    if (!initialIntent?.preDispositionZeroReferenceProof || !initialIntent?.postQuarantineZeroReferenceProof || !firstIntent.finalCompletion) fail("terminal erase proof prefix is incomplete");
    assertZeroReferenceProofV1(initialIntent.preDispositionZeroReferenceProof, "pre_disposition", operationPair, operation.operationCore.candidateCompletion, operation.operationCore.expectedRuntimeSources);
    assertZeroReferenceProofV1(initialIntent.postQuarantineZeroReferenceProof, "post_quarantine", operationPair, operation.operationCore.candidateCompletion, operation.operationCore.expectedRuntimeSources);
    const receiptProjection = {
      schema: "setfarm.platform-build-generation-retention-receipt.v1",
      operationRef: operation.operationRef,
      operationHash: operation.operationHash,
      preDispositionZeroReferenceProof: initialIntent.preDispositionZeroReferenceProof,
      preDispositionZeroReferenceProofHash: initialIntent.preDispositionZeroReferenceProof.proofHash,
      sourceAbsent: true,
      quarantineLocator: operation.expectedQuarantineLocator,
      quarantineIdentity,
      quarantineInventory,
      postQuarantineZeroReferenceProof: initialIntent.postQuarantineZeroReferenceProof,
      postQuarantineZeroReferenceProofHash: initialIntent.postQuarantineZeroReferenceProof.proofHash,
      permanentDisposition: true,
      erasedEntryCount: operation.operationCore.candidateInventory.entryCount,
      erasedRegularFileByteCount: operation.operationCore.candidateInventory.regularFileByteCount,
      finalEraseStepRef: firstIntent.finalCompletion.eraseStepCompletionRef,
      finalEraseStepHash: firstIntent.finalCompletion.eraseStepCompletionHash,
      quarantineAbsent: true,
    };
    const receipt = publishOrAdoptOnlyReceiptV1(stores, receiptProjection);
    const disposition = publishRotationRecord(roots.dispositions, "disposition", {
      schema: "setfarm.platform-build-generation-rotation-disposition.v1",
      ordinal: generation.ordinal,
      buildId: generation.completion.buildId,
      completion: operation.operationCore.candidateCompletion,
      retentionOperation: operationPair,
      retentionReceipt: Object.freeze({ receiptRef: receipt.receiptRef, receiptHash: receipt.receiptHash }),
      sourceAbsent: true,
      quarantineLocator: operation.expectedQuarantineLocator,
      disposedRootPhysicalIdentity: operation.operationCore.candidateInventory.rootPhysicalIdentity,
      physicalInventoryHash: operation.operationCore.candidateInventory.physicalInventoryHash,
      contentInventoryHash: operation.operationCore.candidateInventory.contentInventoryHash,
      permanentDisposition: true,
      quarantineAbsent: true,
    });
    if (canonicalJsonV1(disposition.retentionReceipt) !== canonicalJsonV1({ receiptRef: receipt.receiptRef, receiptHash: receipt.receiptHash })) fail("retention disposition receipt mismatch");
    scanRotationLedgerFromRoots(roots, { recoverPublisherTemps: true });
    return Object.freeze({ receiptRef: receipt.receiptRef, receiptHash: receipt.receiptHash });
  });
}

function assertRotationControllerSource(value) {
  if (
    !value || value.branch !== "main" || value.clean !== true
    || !GIT_HASH.test(value.sourceSha) || !GIT_HASH.test(value.sourceTreeHash)
    || value.sourceSha !== value.originMainSha || !SHA256.test(value.buildInputSetHash)
    || !hasExactKeys(value, [
      "branch", "clean", "sourceSha", "sourceTreeHash", "originMainSha", "buildInputSetHash",
    ])
  ) fail("rotation controller source is invalid");
}

function selectedCommand() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ["inspect", "prepare"].includes(args[0])) return Object.freeze({ command: args[0] });
  if (args.length === 6 && args[0] === "resume" && args[1] === "--operation-ref" && args[3] === "--operation-hash" && args[5] === "--json") {
    return Object.freeze({ command: "resume", operationRef: args[2], operationHash: args[4] });
  }
  fail("expected inspect, prepare, or resume --operation-ref <ref> --operation-hash <hash> --json", "BUILD_GENERATION_RETENTION_USAGE");
}

function main() {
  const selected = selectedCommand();
  if (selected.command === "inspect") {
    process.stdout.write(`${JSON.stringify(inspectBuildGenerationRetentionV1())}\n`);
    return;
  }
  if (selected.command === "prepare") {
    process.stdout.write(`${JSON.stringify(prepareBuildGenerationRetentionV1())}\n`);
    return;
  }
  if (selected.command === "resume") {
    process.stdout.write(`${JSON.stringify(resumeBuildGenerationRetentionV1({ operationRef: selected.operationRef, operationHash: selected.operationHash }))}\n`);
    return;
  }
  fail("build-generation retention mutation is not implemented");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[build-generation-retention] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
