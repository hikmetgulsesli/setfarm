#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
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
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const MAX_BUILD_TREE_DEPTH_V1 = 64;
const MAX_BUILD_INPUT_ENTRIES_V1 = 10_000;
const MAX_BUILD_OUTPUT_ENTRIES_V1 = 10_000;
const MAX_BUILD_LOCATOR_UTF8_OCTETS_V1 = 1_024;
const MAX_BUILD_FILE_BYTES_V1 = 33_554_432;
const MAX_BUILD_TOTAL_BYTES_V1 = 536_870_912;
const MAX_BUILD_ARCHIVE_GENERATIONS_V1 = 8;
const MAX_ROTATION_LEDGER_ORDINALS_V1 = 4_096;
const MAX_NO_REPLACE_PUBLISHER_TEMP_CANDIDATES_V1 = 8;
const MAX_STITCH_CONVERTER_BYTES_V1 = 16_777_216;
const MAX_AUTHORITY_BYTES_V1 = 33_554_432;

const BUILD_INFO_FILE = "BUILD_INFO.json";
const PREPARE_FILE = "PLATFORM_BUILD_PREPARE.json";
const OUTPUT_TREE_FILE = "PLATFORM_BUILD_OUTPUT_TREE.json";
const RELEASE_MANIFEST_FILE = "PLATFORM_RELEASE_MANIFEST.json";
const PREVIOUS_BUILD_PUBLISHER_BASENAMES_V1 = Object.freeze([
  BUILD_INFO_FILE,
  OUTPUT_TREE_FILE,
  RELEASE_MANIFEST_FILE,
]);
const FULL_HASH = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const SHA256 = /^[a-f0-9]{64}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ARCHIVE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.dist$/;
const ROTATION_RECORD_NAME_V1 = /^(\d{20})-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.json$/;
const RFC3339_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ROTATION_LEDGER_DIRECTORY_V1 = ".setfarm/build-generation-rotation-ledger-v1";
const ARCHIVE_DIRECTORY_V1 = ".setfarm/build-generations-v1";
const MAINTENANCE_LOCK_FILE_V1 = "build-generation-maintenance-lock-v1.json";
const CANONICAL_ORIGIN = "https://github.com/hikmetgulsesli/setfarm.git\n";
const COPY_STEP_ASSETS_SOURCE_SHA256_V1 = "ebc1329d163f2e3670372ba203ed98dd1d2e79c0fcaa946e364aa8db334a1a8c";
const COPY_STEP_ASSETS_SOURCE_BYTES_V1 = 1_117;

const EXACT_SCRIPTS = Object.freeze({
  prebuild: "node scripts/write-build-info.mjs --prepare && node scripts/check-version-contract.mjs && node scripts/check-english-contract.mjs && node scripts/check-path-contract.mjs && npm run check:migration-digests && npm run check:mission-control-contracts",
  build: "umask 077 && tsc -p tsconfig.json && cp src/server/index.html dist/server/index.html && cp src/installer/compat-rules.json dist/installer/compat-rules.json && mkdir -p dist/installer/prompts && cp src/installer/prompts/*.md dist/installer/prompts/ && node scripts/copy-step-assets.mjs && chmod +x dist/cli/cli.js && node scripts/inject-version.js",
  postbuild: "node scripts/write-build-info.mjs --finalize",
  "check:migration-digests": "node --import tsx scripts/check-contract-spine-migration-digests.ts --check",
  "check:mission-control-contracts": "node --import tsx scripts/mission-control-contract-artifacts.ts --check",
  "build-generation-retention:inspect": "node scripts/build-generation-retention.mjs inspect",
  "build-generation-retention:prepare": "node scripts/build-generation-retention.mjs prepare",
  "build-generation-retention:resume": "node scripts/build-generation-retention.mjs resume",
});
const EXACT_TSCONFIG = Object.freeze({
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    outDir: "dist",
    rootDir: "src",
    strict: true,
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    skipLibCheck: true,
    types: ["node"],
  },
  include: ["src/**/*.ts"],
});
const GIT_ENV = Object.freeze({
  PATH: "/usr/bin:/bin",
  LANG: "C",
  LC_ALL: "C",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_NO_REPLACE_OBJECTS: "1",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_TERMINAL_PROMPT: "0",
});
const GIT_PREFIX = Object.freeze([
  "-c", "core.hooksPath=/dev/null",
  "-c", "core.fsmonitor=false",
]);
const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("canonical JSON contains a non-finite number");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    fail("canonical JSON contains an unsupported value");
  }
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function hashCanonicalJson(value) {
  return sha256(Buffer.from(canonicalJson(value), "utf8"));
}

function optionalWriterLstat(target) {
  try {
    return lstatSync(target, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

function writerDirectoryIdentity(directoryPath, expectedDevice) {
  const identity = directoryIdentity(directoryPath, directoryPath, expectedDevice);
  const stats = lstatSync(directoryPath, { bigint: true });
  const linkCount = Number(stats.nlink);
  if (!Number.isSafeInteger(linkCount) || linkCount < 1) fail(`${directoryPath} has an invalid link count`);
  return Object.freeze({ ...identity, linkCount });
}

function writerSameDirectoryObject(left, right) {
  return left.realpath === right.realpath
    && left.devDecimal === right.devDecimal
    && left.inoDecimal === right.inoDecimal
    && left.mode === right.mode;
}

function writerUnlinkStable(filePath, observed, parentPath) {
  const reopened = readStableRegular(filePath, MAX_AUTHORITY_BYTES_V1, {
    device: observed.stats.dev,
    nlink: Number(observed.stats.nlink),
  });
  if (reopened.stats.ino !== observed.stats.ino || reopened.mode !== observed.mode || !reopened.bytes.equals(observed.bytes)) {
    fail(`${filePath} changed before unlink`);
  }
  unlinkSync(filePath);
  fsyncDirectory(parentPath);
  if (optionalWriterLstat(filePath)) fail(`${filePath} remained after unlink`);
}

function writerCanonicalRecordBytes(value) {
  return Buffer.from(`${canonicalJson(value)}\n`, "utf8");
}

function parseWriterCanonicalRecord(filePath, expectedLinks = [1]) {
  let observed;
  for (const nlink of expectedLinks) {
    try {
      observed = readStableRegular(filePath, MAX_AUTHORITY_BYTES_V1, { nlink });
      break;
    } catch (error) {
      if (nlink === expectedLinks.at(-1)) throw error;
    }
  }
  let value;
  try {
    value = JSON.parse(observed.bytes.toString("utf8"));
  } catch {
    fail(`${filePath} contains invalid JSON`);
  }
  if (!observed.bytes.equals(writerCanonicalRecordBytes(value))) fail(`${filePath} is not canonical JSON plus LF`);
  return Object.freeze({ value, observed });
}

function publishWriterNoReplace(directory, basename, bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_AUTHORITY_BYTES_V1) fail("writer publication bytes are invalid");
  const device = BigInt(writerDirectoryIdentity(directory).devDecimal);
  const pattern = publisherTempPattern(basename);
  const family = readdirSync(directory).filter((name) => name === basename || name.startsWith(`.${basename}.`)).sort(compareBytes);
  const temps = family.filter((name) => name !== basename);
  if (temps.length > MAX_NO_REPLACE_PUBLISHER_TEMP_CANDIDATES_V1 || temps.some((name) => !pattern.test(name))) {
    fail(`${basename} publisher temporary state is invalid`);
  }
  const fixedPath = path.join(directory, basename);
  if (family.includes(basename)) {
    const fixed = readStableRegular(fixedPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: optionalWriterLstat(fixedPath).nlink === 2n ? 2 : 1 });
    if (fixed.mode !== 0o600 || !fixed.bytes.equals(bytes)) fail(`${basename} conflicts with immutable authority`);
    for (const name of temps) {
      const tempPath = path.join(directory, name);
      const tempStats = optionalWriterLstat(tempPath);
      const temp = readStableRegular(tempPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: Number(tempStats.nlink) });
      if (temp.mode !== 0o600 || !temp.bytes.equals(bytes)) fail(`${basename} has competing temporary bytes`);
      writerUnlinkStable(tempPath, temp, directory);
    }
    const reopened = readStableRegular(fixedPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 1 });
    if (reopened.mode !== 0o600 || !reopened.bytes.equals(bytes)) fail(`${basename} changed after recovery`);
    return;
  }
  let tempPath;
  for (const name of temps) {
    const candidate = path.join(directory, name);
    const observed = readStableRegular(candidate, MAX_AUTHORITY_BYTES_V1, { device, nlink: 1 });
    if (observed.mode !== 0o600 || !observed.bytes.equals(bytes)) fail(`${basename} has competing unpublished temporaries`);
    if (!tempPath) tempPath = candidate;
  }
  if (!tempPath) {
    tempPath = path.join(directory, `.${basename}.${randomUUID()}.tmp`);
    let descriptor;
    try {
      descriptor = openSync(tempPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      writeFileSync(descriptor, bytes);
      fsyncSync(descriptor);
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  }
  const created = readStableRegular(tempPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 1 });
  if (created.mode !== 0o600 || !created.bytes.equals(bytes)) fail(`${basename} temporary is not exact`);
  try {
    linkSync(tempPath, fixedPath);
    fsyncDirectory(directory);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const winnerStats = optionalWriterLstat(fixedPath);
    const winner = readStableRegular(fixedPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: Number(winnerStats.nlink) });
    if (winner.mode !== 0o600 || !winner.bytes.equals(bytes)) fail(`${basename} concurrent winner conflicts`);
  }
  for (const name of readdirSync(directory).filter((name) => name.startsWith(`.${basename}.`))) {
    const candidate = path.join(directory, name);
    const stats = optionalWriterLstat(candidate);
    if (!stats) continue;
    const observed = readStableRegular(candidate, MAX_AUTHORITY_BYTES_V1, { device, nlink: Number(stats.nlink) });
    if (observed.mode !== 0o600 || !observed.bytes.equals(bytes)) fail(`${basename} duplicate changed during recovery`);
    writerUnlinkStable(candidate, observed, directory);
  }
  const reopened = readStableRegular(fixedPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 1 });
  if (reopened.mode !== 0o600 || !reopened.bytes.equals(bytes)) fail(`${basename} final authority changed`);
}

function writerInventory(rootPath) {
  const rootIdentity = writerDirectoryIdentity(rootPath);
  const device = BigInt(rootIdentity.devDecimal);
  const entries = [];
  let count = 0;
  let total = 0;
  function visit(directory, relative, depth) {
    if (depth > MAX_BUILD_TREE_DEPTH_V1) fail("generation exceeds the depth cap");
    for (const name of readdirSync(directory).sort(compareBytes)) {
      count += 1;
      if (count > MAX_BUILD_OUTPUT_ENTRIES_V1) fail("generation exceeds the entry cap");
      const locator = canonicalLocator(relative ? `${relative}/${name}` : name);
      const target = path.join(directory, name);
      const stats = lstatSync(target, { bigint: true });
      if (stats.dev !== device || stats.isSymbolicLink()) fail(`invalid generation member ${locator}`);
      const linkCount = Number(stats.nlink);
      if (!Number.isSafeInteger(linkCount) || linkCount < 1) fail(`invalid generation link count ${locator}`);
      if (stats.isDirectory()) {
        entries.push(Object.freeze({ locator, kind: "directory", devDecimal: stats.dev.toString(10), inoDecimal: stats.ino.toString(10), mode: modeOf(stats), linkCount, byteLength: null, sha256: null }));
        visit(target, locator, depth + 1);
      } else if (stats.isFile()) {
        if (stats.nlink !== 1n || stats.size > BigInt(MAX_BUILD_FILE_BYTES_V1)) fail(`invalid generation regular file ${locator}`);
        const observed = readStableRegular(target, MAX_BUILD_FILE_BYTES_V1, { device, nlink: 1 });
        total += observed.bytes.length;
        if (total > MAX_BUILD_TOTAL_BYTES_V1) fail("generation exceeds the byte cap");
        entries.push(Object.freeze({ locator, kind: "regular_file", devDecimal: stats.dev.toString(10), inoDecimal: stats.ino.toString(10), mode: observed.mode, linkCount: 1, byteLength: observed.bytes.length, sha256: sha256(observed.bytes) }));
      } else fail(`special generation member ${locator}`);
    }
  }
  visit(rootPath, "", 0);
  entries.sort((left, right) => compareBytes(left.locator, right.locator));
  const rootPhysicalIdentity = Object.freeze({ devDecimal: rootIdentity.devDecimal, inoDecimal: rootIdentity.inoDecimal, mode: rootIdentity.mode, linkCount: rootIdentity.linkCount });
  const common = { schema: "setfarm.platform-build-generation-inventory.v1", entryCount: entries.length, regularFileByteCount: total };
  const physicalEntries = entries.map(({ sha256: ignored, ...entry }) => entry);
  const contentEntries = entries.map(({ locator, kind, mode, byteLength, sha256: digest }) => ({ locator, kind, mode, byteLength, sha256: digest }));
  return Object.freeze({ ...common, rootPhysicalIdentity, entries: Object.freeze(entries), physicalInventoryHash: hashCanonicalJson({ ...common, rootPhysicalIdentity, entries: physicalEntries }), contentInventoryHash: hashCanonicalJson({ ...common, entries: contentEntries }) });
}

function assertWriterRotationSource(value) {
  if (!value || !hasExactKeys(value, ["branch", "clean", "sourceSha", "sourceTreeHash", "originMainSha", "buildInputSetHash"])
    || value.branch !== "main" || value.clean !== true || !FULL_HASH.test(value.sourceSha) || !FULL_HASH.test(value.sourceTreeHash)
    || value.sourceSha !== value.originMainSha || !SHA256.test(value.buildInputSetHash)) fail("rotation controller source is invalid");
}

function writerPair(record, kind) {
  return Object.freeze({ [`${kind}Ref`]: record[`${kind}Ref`], [`${kind}Hash`]: record[`${kind}Hash`] });
}

function assertWriterInventory(value) {
  if (!value || !hasExactKeys(value, ["schema", "rootPhysicalIdentity", "entryCount", "regularFileByteCount", "entries", "physicalInventoryHash", "contentInventoryHash"])
    || value.schema !== "setfarm.platform-build-generation-inventory.v1" || !Array.isArray(value.entries) || value.entries.length !== value.entryCount) fail("rotation inventory is invalid");
  const root = value.rootPhysicalIdentity;
  if (!root || !hasExactKeys(root, ["devDecimal", "inoDecimal", "mode", "linkCount"])) fail("rotation inventory root is invalid");
  let prior = null;
  let bytes = 0;
  const physicalEntries = [];
  const contentEntries = [];
  for (const entry of value.entries) {
    if (!entry || !hasExactKeys(entry, ["locator", "kind", "devDecimal", "inoDecimal", "mode", "linkCount", "byteLength", "sha256"])) fail("rotation inventory entry is invalid");
    canonicalLocator(entry.locator);
    if (prior !== null && compareBytes(prior, entry.locator) >= 0) fail("rotation inventory order is invalid");
    prior = entry.locator;
    if (entry.kind === "regular_file") {
      if (entry.linkCount !== 1 || !Number.isSafeInteger(entry.byteLength) || entry.byteLength < 0 || !SHA256.test(entry.sha256)) fail("rotation file inventory is invalid");
      bytes += entry.byteLength;
    } else if (entry.kind !== "directory" || entry.byteLength !== null || entry.sha256 !== null) fail("rotation directory inventory is invalid");
    const { sha256: ignored, ...physical } = entry;
    physicalEntries.push(physical);
    contentEntries.push({ locator: entry.locator, kind: entry.kind, mode: entry.mode, byteLength: entry.byteLength, sha256: entry.sha256 });
  }
  const common = { schema: value.schema, entryCount: value.entryCount, regularFileByteCount: value.regularFileByteCount };
  if (bytes !== value.regularFileByteCount
    || value.physicalInventoryHash !== hashCanonicalJson({ ...common, rootPhysicalIdentity: root, entries: physicalEntries })
    || value.contentInventoryHash !== hashCanonicalJson({ ...common, entries: contentEntries })) fail("rotation inventory hashes are invalid");
}

function writerRotationRef(kind, ordinal, buildId, digest) {
  return `setfarm://internal-production/build-generation-rotation-${kind}/${String(ordinal).padStart(20, "0")}/${buildId}/sha256/${digest}`;
}

function assertWriterRotationRecord(value, kind, filename) {
  const match = ROTATION_RECORD_NAME_V1.exec(filename);
  if (!match) fail(`invalid ${kind} record filename`);
  const ordinal = Number(match[1]);
  const buildId = match[2];
  const refKey = `${kind}Ref`;
  const hashKey = `${kind}Hash`;
  const projection = { ...value };
  delete projection[refKey];
  delete projection[hashKey];
  const digest = hashCanonicalJson(projection);
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > MAX_ROTATION_LEDGER_ORDINALS_V1 || value.ordinal !== ordinal || value.buildId !== buildId
    || value[hashKey] !== digest || value[refKey] !== writerRotationRef(kind, ordinal, buildId, digest)) fail(`${kind} record pair/body/filename mismatch`);
  if (kind === "intent") {
    if (!hasExactKeys(value, ["schema", "ordinal", "buildId", "predecessorCompletion", "sourceParentIdentity", "destinationParentIdentity", "sourceLocator", "destinationLocator", "inventory", "rotationControllerSource", "intentRef", "intentHash"])
      || value.schema !== "setfarm.platform-build-generation-rotation-intent.v1" || value.sourceLocator !== "dist" || value.destinationLocator !== `${ARCHIVE_DIRECTORY_V1}/${buildId}.dist`) fail("rotation intent shape is invalid");
    assertWriterInventory(value.inventory);
    assertWriterRotationSource(value.rotationControllerSource);
  } else if (kind === "completion") {
    if (!hasExactKeys(value, ["schema", "ordinal", "buildId", "predecessorCompletion", "intent", "sourceParentIdentity", "destinationParentIdentity", "archiveLocator", "archiveIdentity", "inventory", "rotationControllerSource", "completionRef", "completionHash"])
      || value.schema !== "setfarm.platform-build-generation-rotation-completion.v1" || value.archiveLocator !== `${ARCHIVE_DIRECTORY_V1}/${buildId}.dist`) fail("rotation completion shape is invalid");
    assertWriterInventory(value.inventory);
    assertWriterRotationSource(value.rotationControllerSource);
  } else if (kind === "disposition") {
    if (!hasExactKeys(value, ["schema", "ordinal", "buildId", "completion", "retentionOperation", "retentionReceipt", "sourceAbsent", "quarantineLocator", "disposedRootPhysicalIdentity", "physicalInventoryHash", "contentInventoryHash", "permanentDisposition", "quarantineAbsent", "dispositionRef", "dispositionHash"])
      || value.schema !== "setfarm.platform-build-generation-rotation-disposition.v1" || value.sourceAbsent !== true || value.permanentDisposition !== true || value.quarantineAbsent !== true) fail("rotation disposition shape is invalid");
  } else fail("rotation record kind is invalid");
  return value;
}

function normalizeWriterRecordDirectory(directory, kind) {
  const families = new Map();
  const tempPattern = /^\.(.+)\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.tmp$/;
  for (const name of readdirSync(directory).sort(compareBytes)) {
    const temp = tempPattern.exec(name);
    const basename = temp?.[1] ?? name;
    if (!ROTATION_RECORD_NAME_V1.test(basename) || (temp && !publisherTempPattern(basename).test(name))) fail(`unknown ${kind} ledger dirent ${name}`);
    const family = families.get(basename) ?? { fixed: null, temps: [] };
    if (temp) family.temps.push(name); else family.fixed = name;
    families.set(basename, family);
  }
  const values = [];
  for (const [basename, family] of [...families.entries()].sort(([left], [right]) => compareBytes(left, right))) {
    if (family.temps.length > MAX_NO_REPLACE_PUBLISHER_TEMP_CANDIDATES_V1) fail("rotation publisher capacity exceeded");
    const fixed = family.fixed ? parseWriterCanonicalRecord(path.join(directory, family.fixed), [1, 2]) : null;
    if (fixed) assertWriterRotationRecord(fixed.value, kind, basename);
    const temps = family.temps.map((name) => {
      try {
        const parsed = parseWriterCanonicalRecord(path.join(directory, name), [1, 2]);
        assertWriterRotationRecord(parsed.value, kind, basename);
        return { name, parsed };
      } catch {
        return { name, parsed: null };
      }
    });
    if (!fixed && temps.length === 1 && !temps[0].parsed) {
      const filePath = path.join(directory, temps[0].name);
      const stats = optionalWriterLstat(filePath);
      const observed = readStableRegular(filePath, MAX_AUTHORITY_BYTES_V1, { nlink: Number(stats.nlink) });
      writerUnlinkStable(filePath, observed, directory);
      continue;
    }
    if (temps.some((entry) => !entry.parsed)) fail(`${basename} has invalid competing publisher state`);
    const bytes = fixed?.observed.bytes ?? temps[0]?.parsed.observed.bytes;
    if (!bytes || temps.some((entry) => !entry.parsed.observed.bytes.equals(bytes))) fail(`${basename} has competing publisher bodies`);
    publishWriterNoReplace(directory, basename, bytes);
    const value = parseWriterCanonicalRecord(path.join(directory, basename)).value;
    values.push(assertWriterRotationRecord(value, kind, basename));
  }
  return values;
}

function normalizeWriterRetentionStores(repositoryRoot, pure) {
  if (typeof pure?.classifyBuildGenerationRetentionPublisherRecordV1 !== "function") fail("strict retention publisher classifier is unavailable");
  const retentionRoot = path.join(path.dirname(repositoryRoot), "data", "internal-production-baseline", "build-generation-retention-v1");
  if (!optionalWriterLstat(retentionRoot)) return;
  if (writerDirectoryIdentity(retentionRoot).mode !== 0o700) fail("retention store must have mode 0o700");
  const tempPattern = /^\.(.+)\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.tmp$/;
  for (const locator of ["operations", "operation-candidates", "erase-steps", "receipts"]) {
    const outer = path.join(retentionRoot, locator);
    const directory = path.join(outer, "sha256");
    if (!optionalWriterLstat(outer) || !optionalWriterLstat(directory)
      || writerDirectoryIdentity(outer).mode !== 0o700 || writerDirectoryIdentity(directory).mode !== 0o700) fail(`retention store ${locator}/sha256 is missing or invalid`);
    const storeDevice = BigInt(writerDirectoryIdentity(directory).devDecimal);
    const families = new Map();
    for (const name of readdirSync(directory).sort(compareBytes)) {
      const temp = tempPattern.exec(name);
      const basename = temp?.[1] ?? name;
      if (!/^[0-9a-f]{64}\.json$/.test(basename) || (temp && !publisherTempPattern(basename).test(name))) fail(`retention store ${locator} has an invalid dirent`);
      const family = families.get(basename) ?? { fixed: null, temps: [] };
      if (temp) family.temps.push(name); else family.fixed = name;
      families.set(basename, family);
    }
    for (const [basename, family] of families) {
      if (family.temps.length > MAX_NO_REPLACE_PUBLISHER_TEMP_CANDIDATES_V1) fail("retention publisher capacity exceeded");
      const readMember = (name) => {
        const filePath = path.join(directory, name);
        const stats = optionalWriterLstat(filePath);
        const linkCount = Number(stats.nlink);
        if (stats.dev !== storeDevice || modeOf(stats) !== 0o600 || ![1, 2].includes(linkCount)) {
          fail(`${name} retention publisher physical state is invalid`);
        }
        const observed = readStableRegular(filePath, MAX_AUTHORITY_BYTES_V1, { device: storeDevice, nlink: linkCount });
        if (observed.mode !== 0o600) fail(`${name} retention publisher mode changed during stable read`);
        return observed;
      };
      const fixed = family.fixed ? readMember(family.fixed) : null;
      if (fixed && pure.classifyBuildGenerationRetentionPublisherRecordV1({ store: locator, basename, bytes: fixed.bytes }).state !== "valid") {
        fail(`${basename} fixed retention authority is semantically invalid`);
      }
      const temps = family.temps.map((name) => {
        const observed = readMember(name);
        const classification = pure.classifyBuildGenerationRetentionPublisherRecordV1({ store: locator, basename, bytes: observed.bytes });
        return { name, observed, valid: classification.state === "valid" };
      });
      if (!fixed && temps.length === 1 && !temps[0].valid) {
        if (temps[0].observed.stats.nlink !== 1n) fail(`${basename} invalid sole temporary has an unsafe link count`);
        const filePath = path.join(directory, temps[0].name);
        writerUnlinkStable(filePath, temps[0].observed, directory);
        continue;
      }
      if (temps.some((entry) => !entry.valid)) fail(`${basename} has invalid competing retention publisher state`);
      const bytes = fixed?.bytes ?? temps[0]?.observed.bytes;
      if (!bytes || temps.some((entry) => !entry.observed.bytes.equals(bytes))) fail(`${basename} has competing retention publisher bodies`);
      const recovery = pure.planNoReplacePublisherRecoveryV1({
        basename,
        candidateBytes: bytes,
        entries: [
          ...(fixed ? [{ name: basename, observed: fixed }] : []),
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
      if (recovery.state === "block") fail(`${basename} retention publisher physical automaton is invalid: ${recovery.reason}`);
      publishWriterNoReplace(directory, basename, bytes);
    }
  }
}

function scanWriterRotationLedger(roots) {
  const intents = normalizeWriterRecordDirectory(roots.intents, "intent");
  const completions = normalizeWriterRecordDirectory(roots.completions, "completion");
  const dispositions = normalizeWriterRecordDirectory(roots.dispositions, "disposition");
  const intentByOrdinal = new Map(intents.map((value) => [value.ordinal, value]));
  const completionByOrdinal = new Map(completions.map((value) => [value.ordinal, value]));
  const dispositionByOrdinal = new Map(dispositions.map((value) => [value.ordinal, value]));
  if (intentByOrdinal.size !== intents.length) fail("rotation intent fork");
  if (completionByOrdinal.size !== completions.length) fail("rotation completion fork");
  if (dispositionByOrdinal.size !== dispositions.length) fail("rotation disposition fork");
  const maxOrdinal = Math.max(0, ...intentByOrdinal.keys(), ...completionByOrdinal.keys());
  let predecessor = null;
  let danglingIntent = null;
  const generations = [];
  for (let ordinal = 1; ordinal <= maxOrdinal; ordinal += 1) {
    const intent = intentByOrdinal.get(ordinal);
    const completion = completionByOrdinal.get(ordinal);
    if (!intent || canonicalJson(intent.predecessorCompletion) !== canonicalJson(predecessor)) fail(`rotation predecessor mismatch at ordinal ${ordinal}`);
    if (!completion) {
      if (ordinal !== maxOrdinal) fail("nonterminal dangling rotation intent");
      danglingIntent = intent;
      break;
    }
    if (canonicalJson(completion.predecessorCompletion) !== canonicalJson(predecessor)
      || canonicalJson(completion.intent) !== canonicalJson(writerPair(intent, "intent"))
      || completion.archiveLocator !== intent.destinationLocator || completion.ordinal !== intent.ordinal || completion.buildId !== intent.buildId
      || canonicalJson(completion.sourceParentIdentity) !== canonicalJson(intent.sourceParentIdentity)
      || canonicalJson(completion.destinationParentIdentity) !== canonicalJson(intent.destinationParentIdentity)
      || canonicalJson(completion.inventory) !== canonicalJson(intent.inventory)
      || canonicalJson(completion.rotationControllerSource) !== canonicalJson(intent.rotationControllerSource)
      || canonicalJson(completion.archiveIdentity) !== canonicalJson({ realpath: path.join(roots.root, completion.archiveLocator), ...completion.inventory.rootPhysicalIdentity })) fail(`rotation completion mismatch at ordinal ${ordinal}`);
    predecessor = writerPair(completion, "completion");
    const disposition = dispositionByOrdinal.get(ordinal) ?? null;
    if (disposition && (canonicalJson(disposition.completion) !== canonicalJson(predecessor)
      || canonicalJson(disposition.disposedRootPhysicalIdentity) !== canonicalJson(completion.inventory.rootPhysicalIdentity)
      || disposition.physicalInventoryHash !== completion.inventory.physicalInventoryHash || disposition.contentInventoryHash !== completion.inventory.contentInventoryHash)) fail(`rotation disposition mismatch at ordinal ${ordinal}`);
    generations.push(Object.freeze({ ordinal, intent, completion, disposition }));
  }
  for (const ordinal of dispositionByOrdinal.keys()) if (!completionByOrdinal.has(ordinal)) fail("disposition lacks completion");
  for (const name of readdirSync(roots.archive).sort(compareBytes)) {
    const match = ARCHIVE_NAME.exec(name);
    if (!match) fail(`invalid archive ${name}`);
    const generation = generations.find((entry) => entry.completion.buildId === match[1]);
    if ((!generation && danglingIntent?.destinationLocator !== `${ARCHIVE_DIRECTORY_V1}/${name}`) || generation?.disposition) fail(`unindexed or disposed archive ${name}`);
  }
  for (const generation of generations) {
    const archivePath = path.join(roots.root, generation.completion.archiveLocator);
    const present = optionalWriterLstat(archivePath);
    if ((present && generation.disposition) || (!present && !generation.disposition)) fail(`archive/disposition mismatch at ordinal ${generation.ordinal}`);
    if (present) {
      if (!writerSameDirectoryObject(writerDirectoryIdentity(archivePath, roots.device), generation.completion.archiveIdentity)
        || canonicalJson(writerInventory(archivePath)) !== canonicalJson(generation.completion.inventory)) fail(`active archive mismatch at ordinal ${generation.ordinal}`);
    }
  }
  return Object.freeze({ completionTip: predecessor, danglingIntent, generations: Object.freeze(generations) });
}

function ensureWriterAuthorityRoots(root) {
  const repository = writerDirectoryIdentity(root);
  const device = BigInt(repository.devDecimal);
  const setfarm = path.join(root, ".setfarm");
  if (!optionalWriterLstat(setfarm)) ensureDirectory(setfarm, 0o700, root, device);
  else if (writerDirectoryIdentity(setfarm, device).mode !== 0o700) fail(".setfarm must have mode 0o700");
  const archive = path.join(root, ARCHIVE_DIRECTORY_V1);
  if (!optionalWriterLstat(archive)) ensureDirectory(archive, 0o700, setfarm, device);
  else if (writerDirectoryIdentity(archive, device).mode !== 0o700) fail("archive root must have mode 0o700");
  const ledger = path.join(root, ROTATION_LEDGER_DIRECTORY_V1);
  if (!optionalWriterLstat(ledger)) ensureDirectory(ledger, 0o700, setfarm, device);
  else if (writerDirectoryIdentity(ledger, device).mode !== 0o700) fail("rotation ledger must have mode 0o700");
  const result = { root, device, setfarm, archive, ledger };
  for (const kind of ["intents", "completions", "dispositions"]) {
    const target = path.join(ledger, kind);
    if (!optionalWriterLstat(target)) ensureDirectory(target, 0o700, ledger, device);
    else if (writerDirectoryIdentity(target, device).mode !== 0o700) fail(`${kind} ledger must have mode 0o700`);
    result[kind] = target;
  }
  return Object.freeze(result);
}

function publishWriterRotationRecord(directory, kind, projection) {
  const digest = hashCanonicalJson(projection);
  const value = Object.freeze({ ...projection, [`${kind}Ref`]: writerRotationRef(kind, projection.ordinal, projection.buildId, digest), [`${kind}Hash`]: digest });
  publishWriterNoReplace(directory, `${String(projection.ordinal).padStart(20, "0")}-${projection.buildId}.json`, writerCanonicalRecordBytes(value));
  return value;
}

function hasExactKeys(value, expected) {
  return value && typeof value === "object" && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort(compareBytes)) === canonicalJson([...expected].sort(compareBytes));
}

function compareBytes(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function modeOf(stats) {
  return Number(stats.mode & 0o777n);
}

function directoryIdentity(directoryPath, label, expectedDevice) {
  const real = realpathSync(directoryPath);
  const stats = lstatSync(directoryPath, { bigint: true });
  if (!stats.isDirectory() || stats.isSymbolicLink() || real !== directoryPath) {
    fail(`${label} must be one real directory`);
  }
  if (expectedDevice !== undefined && stats.dev !== expectedDevice) {
    fail(`${label} must remain on the repository device`);
  }
  return Object.freeze({
    realpath: real,
    devDecimal: stats.dev.toString(10),
    inoDecimal: stats.ino.toString(10),
    mode: modeOf(stats),
  });
}

function sameIdentity(left, right) {
  return left.realpath === right.realpath
    && left.devDecimal === right.devDecimal
    && left.inoDecimal === right.inoDecimal
    && left.mode === right.mode;
}

function assertDirectoryIdentity(directoryPath, expected, label) {
  const observed = directoryIdentity(directoryPath, label, BigInt(expected.devDecimal));
  if (!sameIdentity(observed, expected)) fail(`${label} identity changed`);
  return observed;
}

function fsyncDirectory(directoryPath) {
  const descriptor = openSync(directoryPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function canonicalLocator(locator) {
  const segments = locator.split("/");
  if (segments.length - 1 > MAX_BUILD_TREE_DEPTH_V1) fail(`build locator exceeds the depth cap: ${JSON.stringify(locator)}`);
  if (
    !locator
    || locator !== locator.normalize("NFC")
    || Buffer.byteLength(locator, "utf8") > MAX_BUILD_LOCATOR_UTF8_OCTETS_V1
    || locator.startsWith("/")
    || locator.includes("\\")
    || /[\0-\x1f\x7f-\x9f]/.test(locator)
    || segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    fail(`noncanonical build locator: ${JSON.stringify(locator)}`);
  }
  return locator;
}

function strictUtf8(bytes, label) {
  const text = UTF8.decode(bytes);
  if (!Buffer.from(text, "utf8").equals(bytes)) fail(`${label} is not strict UTF-8`);
  return text;
}

function runGit(root, args, acceptedStatuses = [0], input) {
  const result = spawnSync("/usr/bin/git", [...GIT_PREFIX, ...args], {
    cwd: root,
    env: GIT_ENV,
    shell: false,
    input,
    timeout: 60_000,
    maxBuffer: MAX_BUILD_TOTAL_BYTES_V1 + 8 * 1024 * 1024,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? "");
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.from(result.stderr ?? "");
  if (
    result.error
    || result.status === null
    || !acceptedStatuses.includes(result.status)
    || result.signal
    || stderr.length !== 0
  ) {
    fail(`Git command failed (${args.join(" ")}): ${result.error?.message ?? stderr.toString("utf8") ?? result.status}`);
  }
  return Object.freeze({ status: result.status, stdout });
}

function gitLine(root, args, label) {
  const text = strictUtf8(runGit(root, args).stdout, label);
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n") || text.slice(0, -1).includes("\r")) {
    fail(`${label} must return exactly one line`);
  }
  return text.slice(0, -1);
}

function readPinnedBlobs(root, entries) {
  const input = Buffer.from(`${entries.map((entry) => entry.gitBlobHash).join("\n")}\n`, "ascii");
  const output = runGit(root, ["cat-file", "--batch"], [0], input).stdout;
  const blobs = new Map();
  let offset = 0;
  for (const entry of entries) {
    const newline = output.indexOf(0x0a, offset);
    if (newline < 0) fail("Git batch blob header is truncated");
    const header = output.subarray(offset, newline).toString("ascii");
    const match = /^([a-f0-9]{40}|[a-f0-9]{64}) blob ([0-9]+)$/.exec(header);
    if (!match || match[1] !== entry.gitBlobHash) fail("Git batch returned the wrong blob object");
    const size = Number(match[2]);
    if (!Number.isSafeInteger(size) || size > MAX_BUILD_FILE_BYTES_V1) fail("Pinned Git blob exceeds the per-file cap");
    const start = newline + 1;
    const end = start + size;
    if (end >= output.length || output[end] !== 0x0a) fail("Git batch blob body is truncated");
    blobs.set(entry.gitBlobHash, Buffer.from(output.subarray(start, end)));
    offset = end + 1;
  }
  if (offset !== output.length) fail("Git batch emitted trailing bytes");
  return blobs;
}

function readStableRegular(filePath, maxBytes, options = {}) {
  const parentPath = path.dirname(filePath);
  const parentBefore = directoryIdentity(parentPath, `parent of ${filePath}`, options.device);
  let descriptor;
  try {
    descriptor = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink()) fail(`${filePath} is not a regular file`);
    if (options.device !== undefined && before.dev !== options.device) fail(`${filePath} is on the wrong device`);
    if (options.nlink !== undefined && before.nlink !== BigInt(options.nlink)) fail(`${filePath} has the wrong link count`);
    if (before.size > BigInt(maxBytes)) fail(`${filePath} exceeds ${maxBytes} bytes`);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (
      before.dev !== after.dev
      || before.ino !== after.ino
      || before.mode !== after.mode
      || before.nlink !== after.nlink
      || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs
      || before.ctimeNs !== after.ctimeNs
      || BigInt(bytes.length) !== after.size
    ) fail(`${filePath} changed while being read`);
    const reopened = lstatSync(filePath, { bigint: true });
    if (reopened.isSymbolicLink() || !reopened.isFile() || reopened.dev !== after.dev || reopened.ino !== after.ino) {
      fail(`${filePath} changed before reopen`);
    }
    assertDirectoryIdentity(parentPath, parentBefore, `parent of ${filePath}`);
    const secondDescriptor = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const secondBefore = fstatSync(secondDescriptor, { bigint: true });
      const sameMetadata = (left, right) => left.dev === right.dev
        && left.ino === right.ino
        && left.mode === right.mode
        && left.nlink === right.nlink
        && left.size === right.size
        && left.mtimeNs === right.mtimeNs
        && left.ctimeNs === right.ctimeNs;
      if (!secondBefore.isFile() || !sameMetadata(after, secondBefore)) fail(`${filePath} changed before second open`);
      const secondBytes = readFileSync(secondDescriptor);
      const secondAfter = fstatSync(secondDescriptor, { bigint: true });
      if (
        !sameMetadata(secondBefore, secondAfter)
        || BigInt(secondBytes.length) !== secondAfter.size
        || !secondBytes.equals(bytes)
      ) fail(`${filePath} changed during second read`);
      const secondReopen = lstatSync(filePath, { bigint: true });
      if (secondReopen.isSymbolicLink() || !secondReopen.isFile() || !sameMetadata(secondAfter, secondReopen)) {
        fail(`${filePath} changed after second read`);
      }
      assertDirectoryIdentity(parentPath, parentBefore, `parent of ${filePath}`);
      return Object.freeze({ bytes: secondBytes, stats: secondAfter, mode: modeOf(secondAfter) });
    } finally {
      closeSync(secondDescriptor);
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function sameRegularMetadata(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function withRevalidatedRegular(filePath, expected, label, operation) {
  const parentPath = path.dirname(filePath);
  const parent = directoryIdentity(parentPath, `${label} parent`, expected.stats.dev);
  let descriptor;
  try {
    descriptor = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || !sameRegularMetadata(before, expected.stats)) fail(`${label} changed before mutation open`);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    const named = lstatSync(filePath, { bigint: true });
    if (
      !sameRegularMetadata(before, after)
      || !sameRegularMetadata(after, named)
      || !bytes.equals(expected.bytes)
      || BigInt(bytes.length) !== after.size
    ) fail(`${label} changed immediately before mutation`);
    assertDirectoryIdentity(parentPath, parent, `${label} parent`);
    return operation(Object.freeze({ descriptor, stats: after, parent, parentPath }));
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function unlinkRevalidated(filePath, expected, retainedPath, retainedExpected, label) {
  withRevalidatedRegular(filePath, expected, label, ({ descriptor, stats, parent, parentPath }) => {
    if (retainedPath) {
      const retained = readStableRegular(retainedPath, MAX_AUTHORITY_BYTES_V1, { device: stats.dev, nlink: 2 });
      if (
        retained.stats.dev !== retainedExpected.stats.dev
        || retained.stats.ino !== retainedExpected.stats.ino
        || retained.mode !== retainedExpected.mode
        || !retained.bytes.equals(retainedExpected.bytes)
        || retained.stats.ino !== stats.ino
      ) fail(`${label} retained authority changed before unlink`);
    }
    const immediatelyBefore = lstatSync(filePath, { bigint: true });
    if (!sameRegularMetadata(immediatelyBefore, stats)) fail(`${label} changed at unlink boundary`);
    unlinkSync(filePath);
    fsyncDirectory(parentPath);
    try {
      lstatSync(filePath);
      fail(`${label} still exists after unlink`);
    } catch (error) {
      if (!error || error.code !== "ENOENT") throw error;
    }
    const unlinked = fstatSync(descriptor, { bigint: true });
    if (
      unlinked.dev !== stats.dev
      || unlinked.ino !== stats.ino
      || unlinked.mode !== stats.mode
      || unlinked.size !== stats.size
      || unlinked.nlink !== stats.nlink - 1n
    ) fail(`${label} descriptor state changed across unlink`);
    assertDirectoryIdentity(parentPath, parent, `${label} parent`);
  });
  if (retainedPath) {
    const retained = readStableRegular(retainedPath, MAX_AUTHORITY_BYTES_V1, { device: expected.stats.dev, nlink: 1 });
    if (
      retained.stats.dev !== retainedExpected.stats.dev
      || retained.stats.ino !== retainedExpected.stats.ino
      || retained.mode !== retainedExpected.mode
      || !retained.bytes.equals(retainedExpected.bytes)
    ) fail(`${label} retained authority is not exact after unlink`);
  }
}

function chmodRevalidated(filePath, expected, expectedMode, label) {
  withRevalidatedRegular(filePath, expected, label, ({ descriptor, stats, parent, parentPath }) => {
    fchmodSync(descriptor, expectedMode);
    fsyncSync(descriptor);
    const changed = fstatSync(descriptor, { bigint: true });
    if (
      changed.dev !== stats.dev
      || changed.ino !== stats.ino
      || changed.nlink !== stats.nlink
      || changed.size !== stats.size
      || modeOf(changed) !== expectedMode
    ) fail(`${label} identity changed across chmod`);
    assertDirectoryIdentity(parentPath, parent, `${label} parent`);
  });
  const reopened = readStableRegular(filePath, MAX_BUILD_FILE_BYTES_V1, {
    device: expected.stats.dev,
    nlink: Number(expected.stats.nlink),
  });
  if (
    reopened.stats.ino !== expected.stats.ino
    || reopened.mode !== expectedMode
    || !reopened.bytes.equals(expected.bytes)
  ) fail(`${label} changed after chmod reopen`);
  return reopened;
}

function normalizeDirectoryRevalidated(directoryPath, expected, expectedMode, label) {
  assertDirectoryIdentity(directoryPath, expected, label);
  let descriptor;
  try {
    descriptor = openSync(directoryPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = fstatSync(descriptor, { bigint: true });
    if (
      !before.isDirectory()
      || before.dev.toString(10) !== expected.devDecimal
      || before.ino.toString(10) !== expected.inoDecimal
      || modeOf(before) !== expected.mode
    ) fail(`${label} changed before descriptor normalization`);
    fchmodSync(descriptor, expectedMode);
    fsyncSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (
      !after.isDirectory()
      || after.dev !== before.dev
      || after.ino !== before.ino
      || modeOf(after) !== expectedMode
    ) fail(`${label} changed during descriptor normalization`);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  const normalized = directoryIdentity(directoryPath, label, BigInt(expected.devDecimal));
  if (normalized.devDecimal !== expected.devDecimal || normalized.inoDecimal !== expected.inoDecimal || normalized.mode !== expectedMode) {
    fail(`${label} changed after descriptor normalization`);
  }
  return normalized;
}

function derivePinnedInputSet(root) {
  const include = runGit(root, ["config", "--local", "--no-includes", "--name-only", "--get-regexp", "^include"], [0, 1]);
  if (include.status !== 1 || include.stdout.length !== 0) fail("local Git include/includeIf configuration is forbidden");
  const origin = runGit(root, ["config", "--local", "--no-includes", "--get-all", "remote.origin.url"]);
  if (!origin.stdout.equals(Buffer.from(CANONICAL_ORIGIN, "utf8"))) {
    fail("canonical origin must have exactly one byte-identical value");
  }
  const sourceSha = gitLine(root, ["rev-parse", "--verify", "HEAD^{commit}"], "HEAD commit");
  const sourceTreeHash = gitLine(root, ["rev-parse", "--verify", "HEAD^{tree}"], "HEAD tree");
  if (!FULL_HASH.test(sourceSha) || !FULL_HASH.test(sourceTreeHash) || sourceSha.length !== sourceTreeHash.length) {
    fail("HEAD commit/tree object IDs are invalid");
  }
  const originMainSha = gitLine(root, ["rev-parse", "--verify", "refs/remotes/origin/main^{commit}"], "origin/main commit");
  if (originMainSha !== sourceSha) fail("HEAD does not equal origin/main");
  const branch = gitLine(root, ["branch", "--show-current"], "current branch");
  if (branch !== "main") fail(`REFUSING to build: branch='${branch}' (expected 'main')`);
  const porcelain = runGit(root, ["status", "--porcelain=v2", "--untracked-files=all"]).stdout;
  if (porcelain.length !== 0) fail("REFUSING to build: working tree is dirty");

  const treeBytes = runGit(root, ["ls-tree", "-r", "-z", "--full-tree", sourceSha]).stdout;
  const treeText = strictUtf8(treeBytes, "Git tree listing");
  const records = treeText.split("\0");
  if (records.pop() !== "") fail("Git tree listing lacks its terminal NUL");
  if (records.length > MAX_BUILD_INPUT_ENTRIES_V1) fail("Pinned Git tree exceeds the input-entry cap");
  const entries = records.map((record) => {
    const tab = record.indexOf("\t");
    const header = tab < 0 ? [] : record.slice(0, tab).split(" ");
    const locator = tab < 0 ? "" : canonicalLocator(record.slice(tab + 1));
    if (header.length !== 3 || !["100644", "100755"].includes(header[0]) || header[1] !== "blob" || !FULL_HASH.test(header[2])) {
      fail(`unsupported tracked Git tree entry: ${record.slice(0, 200)}`);
    }
    return Object.freeze({ locator, gitMode: header[0], gitBlobHash: header[2] });
  }).sort((left, right) => compareBytes(left.locator, right.locator));
  const raw = new Set();
  const folded = new Set();
  for (const entry of entries) {
    const fold = entry.locator.normalize("NFC").toLocaleLowerCase("en-US");
    if (raw.has(entry.locator) || folded.has(fold)) fail(`colliding pinned Git locator: ${entry.locator}`);
    raw.add(entry.locator);
    folded.add(fold);
  }
  const blobs = readPinnedBlobs(root, entries);
  let totalBytes = 0;
  for (const entry of entries) {
    totalBytes += blobs.get(entry.gitBlobHash).length;
    if (totalBytes > MAX_BUILD_TOTAL_BYTES_V1) fail("Pinned Git tree exceeds the total-byte cap");
  }
  const body = {
    schema: "setfarm.internal-production-pinned-build-input-set.v1",
    sourceSha,
    sourceTreeHash,
    entries,
  };
  return Object.freeze({
    ...body,
    buildInputSetHash: hashCanonicalJson(body),
    branch,
    porcelainV2Hash: sha256(porcelain),
    blobs,
  });
}

function verifyLivePinnedInputs(root, pinned, rootDevice) {
  for (const entry of pinned.entries) {
    const filePath = path.join(root, ...entry.locator.split("/"));
    if (!filePath.startsWith(`${root}${path.sep}`)) fail("Pinned input escaped the repository");
    const observed = readStableRegular(filePath, MAX_BUILD_FILE_BYTES_V1, { device: rootDevice, nlink: 1 });
    const expectedMode = entry.gitMode === "100755" ? 0o755 : 0o644;
    if (observed.mode !== expectedMode) fail(`live tracked mode differs from pinned Git mode: ${entry.locator}`);
    if (!observed.bytes.equals(pinned.blobs.get(entry.gitBlobHash))) {
      fail(`live tracked bytes do not match pinned Git blob: ${entry.locator}`);
    }
  }
}

function parsePinnedJson(pinned, locator) {
  const entry = pinned.entries.find((candidate) => candidate.locator === locator);
  if (!entry) fail(`Pinned build input is missing ${locator}`);
  try {
    return JSON.parse(strictUtf8(pinned.blobs.get(entry.gitBlobHash), locator));
  } catch (error) {
    fail(`${locator} is not strict JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function verifyBuildTopology(pinned) {
  const pkg = parsePinnedJson(pinned, "package.json");
  if (!pkg || typeof pkg !== "object" || typeof pkg.version !== "string" || pkg.version.length === 0) {
    fail("package.json version is invalid");
  }
  const retentionScriptNames = new Set([
    "build-generation-retention:inspect",
    "build-generation-retention:prepare",
    "build-generation-retention:resume",
  ]);
  const legacyNoRetention = !pinned.entries.some((entry) => entry.locator === "scripts/build-generation-retention.mjs");
  for (const [name, expected] of Object.entries(EXACT_SCRIPTS)) {
    if (legacyNoRetention && retentionScriptNames.has(name)) {
      if (Object.prototype.hasOwnProperty.call(pkg.scripts ?? {}, name)) fail(`legacy package build topology unexpectedly declares script ${name}`);
      continue;
    }
    if (pkg.scripts?.[name] !== expected) fail(`package build topology differs at script ${name}`);
  }
  if (!pkg.scripts.build.startsWith("umask 077 && ") || pkg.scripts.build.match(/umask/g)?.length !== 1) {
    fail("package build script must own exactly one inner umask 077 prefix");
  }
  const tsconfig = parsePinnedJson(pinned, "tsconfig.json");
  if (canonicalJson(tsconfig) !== canonicalJson(EXACT_TSCONFIG)) fail("tsconfig build topology differs");
  const ignoreEntry = pinned.entries.find((entry) => entry.locator === ".gitignore");
  if (!ignoreEntry) fail("Pinned build input is missing .gitignore");
  const ignoreText = strictUtf8(pinned.blobs.get(ignoreEntry.gitBlobHash), ".gitignore");
  if (ignoreText.split("\n").filter((line) => line === ".setfarm/").length !== 1) {
    fail(".gitignore must contain the exact .setfarm/ rule once");
  }
  const copyStepEntry = pinned.entries.find((entry) => entry.locator === "scripts/copy-step-assets.mjs");
  if (!copyStepEntry || copyStepEntry.gitMode !== "100755") fail("Pinned copy-step-assets source is missing or non-executable");
  const copyStepBytes = pinned.blobs.get(copyStepEntry.gitBlobHash);
  if (
    copyStepBytes.length !== COPY_STEP_ASSETS_SOURCE_BYTES_V1
    || sha256(copyStepBytes) !== COPY_STEP_ASSETS_SOURCE_SHA256_V1
  ) fail("copy-step-assets recursive Markdown topology semantic/source projection differs");
  return pkg.version;
}

function deriveExpectedOutputs(pinned) {
  const outputs = [];
  for (const entry of pinned.entries) {
    const locator = entry.locator;
    if (locator.startsWith("src/") && locator.endsWith(".ts") && !/\.(?:d|m|c)\.ts$/.test(locator)) {
      outputs.push(`dist/${locator.slice(4, -3)}.js`);
    } else if (locator === "src/server/index.html" || locator === "src/installer/compat-rules.json") {
      outputs.push(`dist/${locator.slice(4)}`);
    } else if (/^src\/installer\/prompts\/[^/]+\.md$/.test(locator)) {
      outputs.push(`dist/${locator.slice(4)}`);
    } else if (/^src\/installer\/steps\/.+\.md$/.test(locator)) {
      outputs.push(`dist/${locator.slice(4)}`);
    }
  }
  outputs.sort(compareBytes);
  const seen = new Set();
  const folded = new Set();
  for (const locator of outputs) {
    canonicalLocator(locator);
    const fold = locator.normalize("NFC").toLocaleLowerCase("en-US");
    if (seen.has(locator) || folded.has(fold)) fail(`colliding expected output locator: ${locator}`);
    seen.add(locator);
    folded.add(fold);
  }
  if (!seen.has("dist/cli/cli.js")) fail("expected output topology lacks dist/cli/cli.js");
  const directories = new Set();
  for (const locator of outputs) {
    let parent = path.posix.dirname(locator);
    while (parent !== "dist" && parent !== ".") {
      directories.add(parent);
      parent = path.posix.dirname(parent);
    }
  }
  if (outputs.length + directories.size + 4 > MAX_BUILD_OUTPUT_ENTRIES_V1) {
    fail("derived output file/directory closure exceeds the combined output-entry cap");
  }
  return Object.freeze({
    outputs: Object.freeze(outputs),
    directories: Object.freeze([...directories].sort(compareBytes)),
  });
}

function anchorRepository() {
  const root = realpathSync(path.resolve(process.cwd()));
  const identity = directoryIdentity(root, "Platform repository root");
  if ((identity.mode & 0o022) !== 0) fail("Platform repository root is group/world-writable");
  const topLevel = gitLine(root, ["rev-parse", "--show-toplevel"], "Git top-level");
  if (realpathSync(topLevel) !== root) fail("Current module must run from the real Git repository root");
  return Object.freeze({ root, identity, device: BigInt(identity.devDecimal) });
}

function ensureDirectory(directoryPath, mode, parentPath, device) {
  let created = false;
  try {
    const stats = lstatSync(directoryPath, { bigint: true });
    if (!stats.isDirectory() || stats.isSymbolicLink() || stats.dev !== device || realpathSync(directoryPath) !== directoryPath) {
      fail(`${directoryPath} must be one real same-device directory`);
    }
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
    mkdirSync(directoryPath, { mode });
    created = true;
    fsyncDirectory(parentPath);
  }
  const identity = directoryIdentity(directoryPath, directoryPath, device);
  const normalized = normalizeDirectoryRevalidated(directoryPath, identity, mode, directoryPath);
  if (created) fsyncDirectory(parentPath);
  return normalized;
}

function validateStorageTree(rootPath, device, directoryMode, normalizeDirectories, allowPublisherLinks) {
  let entries = 0;
  let totalBytes = 0;
  const directories = [];
  const rawLocators = new Set();
  const nfcLocators = new Set();
  const foldedLocators = new Set();
  const fileSnapshots = [];
  const directorySnapshots = [];
  function visit(directoryPath, relative, depth) {
    if (depth > MAX_BUILD_TREE_DEPTH_V1) fail("build storage exceeds the depth cap");
    const identity = directoryIdentity(directoryPath, `build storage ${relative || "."}`, device);
    if (directoryMode === 0o755 ? identity.mode !== 0o755 : (identity.mode & 0o022) !== 0) {
      fail(`group/world-writable or wrong-mode directory rejected before descendant read: ${relative || "."}`);
    }
    directorySnapshots.push(Object.freeze({
      locator: relative,
      devDecimal: identity.devDecimal,
      inoDecimal: identity.inoDecimal,
      mode: identity.mode,
    }));
    directories.push(Object.freeze({ path: directoryPath, identity }));
    for (const name of readdirSync(directoryPath).sort(compareBytes)) {
      const childRelative = relative ? `${relative}/${name}` : name;
      entries += 1;
      if (entries > MAX_BUILD_OUTPUT_ENTRIES_V1) fail("build storage exceeds the output-entry cap");
      canonicalLocator(childRelative);
      const nfc = childRelative.normalize("NFC");
      const folded = nfc.toLocaleLowerCase("en-US");
      if (rawLocators.has(childRelative) || nfcLocators.has(nfc) || foldedLocators.has(folded)) {
        fail(`build storage locator collision: ${childRelative}`);
      }
      rawLocators.add(childRelative);
      nfcLocators.add(nfc);
      foldedLocators.add(folded);
      const childPath = path.join(directoryPath, name);
      const stats = lstatSync(childPath, { bigint: true });
      if (stats.dev !== device || stats.isSymbolicLink()) fail(`invalid build storage entry: ${childRelative}`);
      if (stats.isDirectory()) {
        visit(childPath, childRelative, depth + 1);
      } else if (stats.isFile()) {
        if (!allowPublisherLinks && !relative && PREVIOUS_BUILD_PUBLISHER_BASENAMES_V1.some((basename) => publisherTempPattern(basename).test(name))) {
          fail(`publisher temporary remained after sanitation: ${childRelative}`);
        }
        const publisher = allowPublisherLinks && !relative && isPublisherFamilyName(name);
        if ((!publisher && stats.nlink !== 1n) || (publisher && stats.nlink > 2n)) {
          fail(`hard-linked build storage entry: ${childRelative}`);
        }
        const stable = readStableRegular(childPath, MAX_BUILD_FILE_BYTES_V1, {
          device,
          nlink: Number(stats.nlink),
        });
        totalBytes += Number(stable.stats.size);
        if (totalBytes > MAX_BUILD_TOTAL_BYTES_V1) fail("build storage exceeds the total-byte cap");
        fileSnapshots.push(Object.freeze({
          locator: childRelative,
          devDecimal: stable.stats.dev.toString(10),
          inoDecimal: stable.stats.ino.toString(10),
          mode: stable.mode,
          nlinkDecimal: stable.stats.nlink.toString(10),
          byteLength: stable.bytes.length,
          sha256: sha256(stable.bytes),
          mtimeNsDecimal: stable.stats.mtimeNs.toString(10),
          ctimeNsDecimal: stable.stats.ctimeNs.toString(10),
        }));
      } else {
        fail(`special build storage entry: ${childRelative}`);
      }
    }
    assertDirectoryIdentity(directoryPath, { ...identity }, `build storage ${relative || "."}`);
  }
  visit(rootPath, "", 0);
  if (normalizeDirectories) {
    for (const item of directories.sort((a, b) => compareBytes(a.path, b.path))) {
      normalizeDirectoryRevalidated(item.path, item.identity, 0o755, "pre-rotation directory");
    }
  }
  if (normalizeDirectories) return undefined;
  return Object.freeze({
    directories: Object.freeze(directorySnapshots),
    files: Object.freeze(fileSnapshots),
    entries,
    totalBytes,
  });
}

function isPublisherFamilyName(name) {
  return PREVIOUS_BUILD_PUBLISHER_BASENAMES_V1.some((basename) => (
    name === basename || name.startsWith(`.${basename}.`)
  ));
}

function publisherTempPattern(basename) {
  return new RegExp(`^\\.${basename.replaceAll(".", "\\.")}\\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\\.tmp$`);
}

function sanitizePublisherFamily(distPath, device, basename) {
  const names = readdirSync(distPath);
  const fixedPresent = names.includes(basename);
  const family = names.filter((name) => name.startsWith(`.${basename}.`));
  const pattern = publisherTempPattern(basename);
  if (family.some((name) => !pattern.test(name)) || family.length > 1) fail(`invalid ${basename} publisher recovery state`);
  const tempName = family[0];
  if (!fixedPresent && !tempName) return;
  const fixedPath = path.join(distPath, basename);
  const tempPath = tempName ? path.join(distPath, tempName) : undefined;
  if (fixedPresent && !tempPath) {
    const fixed = readStableRegular(fixedPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 1 });
    if (fixed.mode !== 0o444) fail(`${basename} fixed authority has the wrong mode`);
    return;
  }
  if (!fixedPresent && tempPath) {
    const temp = readStableRegular(tempPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 1 });
    if (![0o600, 0o444].includes(temp.mode)) fail(`${basename} orphan temporary has the wrong mode`);
    unlinkRevalidated(tempPath, temp, undefined, undefined, `${basename} orphan temporary`);
    return;
  }
  const fixed = readStableRegular(fixedPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 2 });
  const temp = readStableRegular(tempPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 2 });
  if (
    fixed.mode !== 0o444
    || temp.mode !== 0o444
    || fixed.stats.dev !== temp.stats.dev
    || fixed.stats.ino !== temp.stats.ino
    || !fixed.bytes.equals(temp.bytes)
  ) fail(`${basename} linked publisher recovery state conflicts`);
  unlinkRevalidated(tempPath, temp, fixedPath, fixed, `${basename} linked temporary`);
  readStableRegular(fixedPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 1 });
}

function validateArchiveRoot(archiveRoot, device) {
  const names = readdirSync(archiveRoot).sort(compareBytes);
  if (names.length > MAX_BUILD_ARCHIVE_GENERATIONS_V1) fail("BUILD_GENERATION_RETENTION_REQUIRED: archive count exceeds eight");
  for (const name of names) {
    if (!ARCHIVE_NAME.test(name)) fail(`invalid build archive name: ${name}`);
    const generation = path.join(archiveRoot, name);
    const identity = directoryIdentity(generation, `build archive ${name}`, device);
    if (identity.mode !== 0o755) fail(`build archive ${name} has the wrong mode`);
    validateStorageTree(generation, device, 0o755, false, false);
  }
  return names;
}

function prepareArchiveRoot(repository, buildId) {
  const setfarmPath = path.join(repository.root, ".setfarm");
  const archiveRoot = path.join(setfarmPath, "build-generations-v1");
  const probe = `.setfarm/build-generations-v1/${buildId}.dist`;
  const ignored = runGit(repository.root, ["check-ignore", "--no-index", "-q", "--", probe], [0, 1]);
  if (ignored.status !== 0 || ignored.stdout.length !== 0) fail(".setfarm build archive path is not ignored by fixed policy");
  let setfarmIdentity;
  try {
    setfarmIdentity = directoryIdentity(setfarmPath, ".setfarm", repository.device);
    if ((setfarmIdentity.mode & 0o022) !== 0) fail(".setfarm is group/world-writable");
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
    setfarmIdentity = ensureDirectory(setfarmPath, 0o700, repository.root, repository.device);
  }
  let archiveIdentity;
  try {
    archiveIdentity = directoryIdentity(archiveRoot, "build archive root", repository.device);
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
    archiveIdentity = ensureDirectory(archiveRoot, 0o700, setfarmPath, repository.device);
  }
  if (archiveIdentity.mode !== 0o700) fail("build archive root must have mode 0o700");
  const names = validateArchiveRoot(archiveRoot, repository.device);
  assertDirectoryIdentity(setfarmPath, setfarmIdentity, ".setfarm");
  assertDirectoryIdentity(archiveRoot, archiveIdentity, "build archive root");
  return Object.freeze({ setfarmPath, archiveRoot, names, setfarmIdentity, archiveIdentity });
}

function createExpectedDirectories(root, distPath, expectedDirectories, device) {
  const sorted = [...expectedDirectories].sort((left, right) => {
    const depth = left.split("/").length - right.split("/").length;
    return depth || compareBytes(left, right);
  });
  for (const locator of sorted) {
    const directoryPath = path.join(root, ...locator.split("/"));
    ensureDirectory(directoryPath, 0o755, path.dirname(directoryPath), device);
  }
  const actual = [];
  function collect(directoryPath, relative) {
    for (const name of readdirSync(directoryPath).sort(compareBytes)) {
      const child = path.join(directoryPath, name);
      const stats = lstatSync(child, { bigint: true });
      if (stats.isDirectory() && !stats.isSymbolicLink()) {
        const locator = relative ? `${relative}/${name}` : `dist/${name}`;
        actual.push(locator);
        collect(child, locator);
      }
    }
  }
  collect(distPath, "");
  actual.sort(compareBytes);
  if (canonicalJson(actual) !== canonicalJson(expectedDirectories)) fail("fresh dist directory closure is not exact");
}

function artifactState(distPath, basename, device) {
  const names = readdirSync(distPath);
  const fixed = names.includes(basename);
  const familyNames = names.filter((name) => name.startsWith(`.${basename}.`));
  const pattern = publisherTempPattern(basename);
  if (familyNames.some((name) => !pattern.test(name)) || familyNames.length > 1) fail(`invalid ${basename} publication state`);
  return Object.freeze({ fixed, tempName: familyNames[0], device });
}

function verifyFixedArtifact(distPath, basename, expectedBytes, device) {
  const parent = directoryIdentity(distPath, `${basename} publication parent`, device);
  const fixed = readStableRegular(path.join(distPath, basename), MAX_AUTHORITY_BYTES_V1, { device, nlink: 1 });
  if (fixed.mode !== 0o444 || !fixed.bytes.equals(expectedBytes)) fail(`${basename} conflicts with expected authority bytes`);
  fsyncDirectory(distPath);
  const reopened = readStableRegular(path.join(distPath, basename), MAX_AUTHORITY_BYTES_V1, { device, nlink: 1 });
  if (!sameRegularMetadata(reopened.stats, fixed.stats) || !reopened.bytes.equals(fixed.bytes)) {
    fail(`${basename} changed across final parent fsync/reopen`);
  }
  assertDirectoryIdentity(distPath, parent, `${basename} publication parent`);
}

function publishExactArtifact(distPath, basename, expectedBytes, device) {
  let state = artifactState(distPath, basename, device);
  if (state.fixed && !state.tempName) {
    verifyFixedArtifact(distPath, basename, expectedBytes, device);
    return;
  }
  if (state.fixed && state.tempName) {
    const fixedPath = path.join(distPath, basename);
    const tempPath = path.join(distPath, state.tempName);
    const fixed = readStableRegular(fixedPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 2 });
    const temp = readStableRegular(tempPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 2 });
    if (fixed.mode !== 0o444 || temp.mode !== 0o444 || fixed.stats.ino !== temp.stats.ino || !fixed.bytes.equals(expectedBytes) || !temp.bytes.equals(expectedBytes)) {
      fail(`${basename} linked publication state conflicts`);
    }
    unlinkRevalidated(tempPath, temp, fixedPath, fixed, `${basename} linked publication temporary`);
    verifyFixedArtifact(distPath, basename, expectedBytes, device);
    return;
  }

  let tempPath;
  if (state.tempName) {
    tempPath = path.join(distPath, state.tempName);
    const temp = readStableRegular(tempPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 1 });
    if (![0o600, 0o444].includes(temp.mode)) fail(`${basename} orphan publication temporary has the wrong mode`);
    if (!temp.bytes.equals(expectedBytes)) {
      unlinkRevalidated(tempPath, temp, undefined, undefined, `${basename} conflicting publication temporary`);
      tempPath = undefined;
    }
  }
  if (!tempPath) {
    tempPath = path.join(distPath, `.${basename}.${randomUUID()}.tmp`);
    let descriptor;
    try {
      descriptor = openSync(tempPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      writeFileSync(descriptor, expectedBytes);
      fsyncSync(descriptor);
      fchmodSync(descriptor, 0o444);
      fsyncSync(descriptor);
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  } else {
    const temp = readStableRegular(tempPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 1 });
    chmodRevalidated(tempPath, temp, 0o444, `${basename} orphan publication temporary`);
  }
  const temp = readStableRegular(tempPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 1 });
  if (temp.mode !== 0o444 || !temp.bytes.equals(expectedBytes)) fail(`${basename} publication temporary is not exact before link`);
  const fixedPath = path.join(distPath, basename);
  withRevalidatedRegular(tempPath, temp, `${basename} publication temporary`, ({ descriptor, stats, parent, parentPath }) => {
    try {
      lstatSync(fixedPath);
      fail(`${basename} fixed authority appeared before link`);
    } catch (error) {
      if (!error || error.code !== "ENOENT") throw error;
    }
    const immediatelyBefore = lstatSync(tempPath, { bigint: true });
    if (!sameRegularMetadata(immediatelyBefore, stats)) fail(`${basename} temporary changed at link boundary`);
    linkSync(tempPath, fixedPath);
    fsyncDirectory(parentPath);
    const linkedDescriptor = fstatSync(descriptor, { bigint: true });
    if (
      linkedDescriptor.dev !== stats.dev
      || linkedDescriptor.ino !== stats.ino
      || linkedDescriptor.mode !== stats.mode
      || linkedDescriptor.size !== stats.size
      || linkedDescriptor.nlink !== 2n
    ) fail(`${basename} temporary descriptor changed across link`);
    const fixed = readStableRegular(fixedPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 2 });
    if (fixed.stats.ino !== stats.ino || fixed.mode !== 0o444 || !fixed.bytes.equals(expectedBytes)) {
      fail(`${basename} linked fixed authority is not exact`);
    }
    assertDirectoryIdentity(parentPath, parent, `${basename} publication parent`);
  });
  const linkedTemp = readStableRegular(tempPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 2 });
  const linkedFixed = readStableRegular(fixedPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 2 });
  unlinkRevalidated(tempPath, linkedTemp, fixedPath, linkedFixed, `${basename} linked publication temporary`);
  verifyFixedArtifact(distPath, basename, expectedBytes, device);
}

function writePrepareReceipt(distPath, value, device) {
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  const tempPath = path.join(distPath, `.${PREPARE_FILE}.${randomUUID()}.tmp`);
  const fixedPath = path.join(distPath, PREPARE_FILE);
  let descriptor;
  try {
    descriptor = openSync(tempPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
    fchmodSync(descriptor, 0o444);
    fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  renameSync(tempPath, fixedPath);
  fsyncDirectory(distPath);
  const observed = readStableRegular(fixedPath, MAX_AUTHORITY_BYTES_V1, { device, nlink: 1 });
  if (observed.mode !== 0o444 || !observed.bytes.equals(bytes)) fail("prepare receipt publication failed");
}

function parseStrictObject(bytes, expectedKeys, label, compact = true) {
  const text = strictUtf8(bytes, label);
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    fail(`${label} is invalid JSON: ${error instanceof Error ? error.message : error}`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || canonicalJson(Object.keys(value)) !== canonicalJson(expectedKeys)) {
    fail(`${label} has unknown, missing, or reordered fields`);
  }
  const expectedText = compact ? `${JSON.stringify(value)}\n` : `${JSON.stringify(value, null, 2)}\n`;
  if (text !== expectedText) fail(`${label} bytes are not exact`);
  return value;
}

function readPrepareReceipt(distPath, device) {
  const observed = readStableRegular(path.join(distPath, PREPARE_FILE), MAX_AUTHORITY_BYTES_V1, { device, nlink: 1 });
  if (observed.mode !== 0o444) fail("prepare receipt has the wrong mode");
  const value = parseStrictObject(observed.bytes, [
    "schema", "buildId", "sourceSha", "sourceTreeHash", "buildInputSetHash", "branch", "dirty", "porcelainV2Hash", "repositoryDirectoryIdentity", "distDirectoryIdentity",
  ], "prepare receipt");
  if (
    value.schema !== "setfarm.platform-build-prepare.v2"
    || !UUID_V4.test(value.buildId)
    || !FULL_HASH.test(value.sourceSha)
    || !FULL_HASH.test(value.sourceTreeHash)
    || !SHA256.test(value.buildInputSetHash)
    || value.branch !== "main"
    || value.dirty !== false
    || !SHA256.test(value.porcelainV2Hash)
  ) fail("prepare receipt fields are invalid");
  const parseIdentity = (identity, label) => {
    if (
      !identity
      || typeof identity !== "object"
      || Array.isArray(identity)
      || canonicalJson(Object.keys(identity)) !== canonicalJson(["realpath", "devDecimal", "inoDecimal", "mode"])
      || typeof identity.realpath !== "string"
      || !path.isAbsolute(identity.realpath)
      || typeof identity.devDecimal !== "string"
      || !/^(?:0|[1-9][0-9]*)$/.test(identity.devDecimal)
      || typeof identity.inoDecimal !== "string"
      || !/^(?:0|[1-9][0-9]*)$/.test(identity.inoDecimal)
      || !Number.isInteger(identity.mode)
      || identity.mode < 0
      || identity.mode > 0o777
    ) fail(`${label} identity fields are invalid`);
  };
  parseIdentity(value.repositoryDirectoryIdentity, "repository directory");
  parseIdentity(value.distDirectoryIdentity, "dist directory");
  return value;
}

function buildInfoCandidate(pinned, packageVersion) {
  const shortSha = pinned.sourceSha.slice(0, 8);
  return Object.freeze({
    sha: pinned.sourceSha,
    shortSha,
    branch: "main",
    dirty: false,
    packageVersion,
    displayVersion: `${packageVersion}+${shortSha}`,
    builtAt: new Date().toISOString(),
  });
}

function readBuildInfo(distPath, device, pinned, packageVersion) {
  const observed = readStableRegular(path.join(distPath, BUILD_INFO_FILE), MAX_AUTHORITY_BYTES_V1, { device, nlink: 1 });
  if (observed.mode !== 0o444) fail("BUILD_INFO has the wrong mode");
  const value = parseStrictObject(observed.bytes, [
    "sha", "shortSha", "branch", "dirty", "packageVersion", "displayVersion", "builtAt",
  ], "BUILD_INFO", false);
  if (
    value.sha !== pinned.sourceSha
    || value.shortSha !== pinned.sourceSha.slice(0, 8)
    || value.branch !== "main"
    || value.dirty !== false
    || value.packageVersion !== packageVersion
    || value.displayVersion !== `${packageVersion}+${pinned.sourceSha.slice(0, 8)}`
    || typeof value.builtAt !== "string"
    || !RFC3339_MILLIS.test(value.builtAt)
    || new Date(value.builtAt).toISOString() !== value.builtAt
  ) fail("BUILD_INFO fields are invalid");
  return value;
}

function normalizeExpectedTopology(repository, distPath, topology) {
  for (const locator of topology.directories) {
    const directoryPath = path.join(repository.root, ...locator.split("/"));
    const before = directoryIdentity(directoryPath, locator, repository.device);
    if ((before.mode & 0o022) !== 0) fail(`group/world-writable output directory: ${locator}`);
    const after = normalizeDirectoryRevalidated(directoryPath, before, 0o755, locator);
    if (before.devDecimal !== after.devDecimal || before.inoDecimal !== after.inoDecimal || after.mode !== 0o755) fail(`output directory changed: ${locator}`);
  }
  const entries = [];
  for (const locator of topology.outputs) {
    const filePath = path.join(repository.root, ...locator.split("/"));
    const before = readStableRegular(filePath, MAX_BUILD_FILE_BYTES_V1, { device: repository.device, nlink: 1 });
    if ((before.mode & 0o022) !== 0) fail(`group/world-writable output file: ${locator}`);
    const expectedMode = locator === "dist/cli/cli.js" ? 0o755 : 0o644;
    const after = chmodRevalidated(filePath, before, expectedMode, locator);
    if (after.stats.dev !== before.stats.dev || after.stats.ino !== before.stats.ino || after.mode !== expectedMode) fail(`output file changed: ${locator}`);
    entries.push(Object.freeze({ locator, mode: expectedMode, byteLength: after.bytes.length, sha256: sha256(after.bytes) }));
  }
  return Object.freeze(entries);
}

function captureFileSnapshots(repository, locators, label) {
  return Object.freeze([...locators].sort(compareBytes).map((locator) => {
    canonicalLocator(locator);
    const observed = readStableRegular(path.join(repository.root, ...locator.split("/")), MAX_BUILD_FILE_BYTES_V1, {
      device: repository.device,
      nlink: 1,
    });
    return Object.freeze({ locator, observed });
  }));
}

function assertFileSnapshots(repository, snapshots, label) {
  for (const snapshot of snapshots) {
    const reopened = readStableRegular(path.join(repository.root, ...snapshot.locator.split("/")), MAX_BUILD_FILE_BYTES_V1, {
      device: repository.device,
      nlink: 1,
    });
    if (!sameRegularMetadata(reopened.stats, snapshot.observed.stats) || !reopened.bytes.equals(snapshot.observed.bytes)) {
      fail(`${label} file changed after final source verification: ${snapshot.locator}`);
    }
  }
}

function enumerateDist(repository, distPath, topology, allowReceipt) {
  let count = 0;
  let total = 0;
  const files = [];
  const directories = [];
  const fileSnapshots = [];
  function visit(directoryPath, relative, depth) {
    if (depth > MAX_BUILD_TREE_DEPTH_V1) fail("fresh dist exceeds the depth cap");
    for (const name of readdirSync(directoryPath).sort(compareBytes)) {
      count += 1;
      if (count > MAX_BUILD_OUTPUT_ENTRIES_V1) fail("fresh dist exceeds the entry cap");
      const locator = relative ? `${relative}/${name}` : `dist/${name}`;
      canonicalLocator(locator);
      const child = path.join(directoryPath, name);
      const stats = lstatSync(child, { bigint: true });
      if (stats.dev !== repository.device || stats.isSymbolicLink()) fail(`invalid fresh dist entry: ${locator}`);
      if (stats.isDirectory()) {
        directories.push(locator);
        visit(child, locator, depth + 1);
      } else if (stats.isFile()) {
        const recoverablePublisherPath = !relative && (
          name === OUTPUT_TREE_FILE
          || name === RELEASE_MANIFEST_FILE
          || publisherTempPattern(OUTPUT_TREE_FILE).test(name)
          || publisherTempPattern(RELEASE_MANIFEST_FILE).test(name)
        );
        if (stats.nlink !== 1n && !(recoverablePublisherPath && stats.nlink === 2n)) {
          fail(`hard-linked fresh dist file: ${locator}`);
        }
        const observed = readStableRegular(child, MAX_BUILD_FILE_BYTES_V1, {
          device: repository.device,
          nlink: Number(stats.nlink),
        });
        total += observed.bytes.length;
        if (total > MAX_BUILD_TOTAL_BYTES_V1) fail("fresh dist exceeds total-byte cap");
        files.push(locator);
        fileSnapshots.push(Object.freeze({ locator, observed }));
      } else fail(`special fresh dist entry: ${locator}`);
    }
  }
  visit(distPath, "", 0);
  const expectedFiles = new Set(topology.outputs);
  expectedFiles.add(`dist/${BUILD_INFO_FILE}`);
  if (allowReceipt) expectedFiles.add(`dist/${PREPARE_FILE}`);
  if (files.includes(`dist/${OUTPUT_TREE_FILE}`)) expectedFiles.add(`dist/${OUTPUT_TREE_FILE}`);
  if (files.includes(`dist/${RELEASE_MANIFEST_FILE}`)) expectedFiles.add(`dist/${RELEASE_MANIFEST_FILE}`);
  const tempNames = files.filter((locator) => {
    if (!locator.startsWith("dist/.")) return false;
    const name = locator.slice(5);
    return [OUTPUT_TREE_FILE, RELEASE_MANIFEST_FILE].some((basename) => publisherTempPattern(basename).test(name));
  });
  for (const locator of tempNames) expectedFiles.add(locator);
  const unexpected = files.filter((locator) => !expectedFiles.has(locator));
  const missing = [...expectedFiles].filter((locator) => !files.includes(locator) && !tempNames.includes(locator));
  if (unexpected.length || missing.length) fail(`unexpected output or missing exact output: ${unexpected[0] ?? missing[0]}`);
  directories.sort(compareBytes);
  if (canonicalJson(directories) !== canonicalJson(topology.directories)) fail("fresh dist directory topology is not exact");
  const directorySnapshots = directories.map((locator) => {
    const identity = directoryIdentity(path.join(repository.root, ...locator.split("/")), locator, repository.device);
    if (identity.mode !== 0o755) fail(`fresh dist directory has wrong mode: ${locator}`);
    return Object.freeze({ locator, identity });
  });
  return Object.freeze({
    files: Object.freeze(fileSnapshots.sort((left, right) => compareBytes(left.locator, right.locator))),
    directories: Object.freeze(directorySnapshots),
  });
}

function assertOutputEntriesMatchEnumeration(entries, enumeration) {
  const byLocator = new Map(enumeration.files.map((snapshot) => [snapshot.locator, snapshot.observed]));
  for (const entry of entries) {
    const observed = byLocator.get(entry.locator);
    if (
      !observed
      || observed.mode !== entry.mode
      || observed.bytes.length !== entry.byteLength
      || sha256(observed.bytes) !== entry.sha256
    ) fail(`ordinary output changed across normalization/enumeration: ${entry.locator}`);
  }
}

function assertPreNormalizationOutputs(topology, enumeration) {
  const byLocator = new Map(enumeration.files.map((snapshot) => [snapshot.locator, snapshot.observed]));
  for (const locator of topology.outputs) {
    const observed = byLocator.get(locator);
    if (!observed) fail(`pre-normalization inventory lacks ${locator}`);
    if ((observed.mode & 0o022) !== 0) fail(`group/world-writable output file: ${locator}`);
  }
}

function readOnlyOutputEntries(topology, enumeration) {
  const byLocator = new Map(enumeration.files.map((snapshot) => [snapshot.locator, snapshot.observed]));
  return Object.freeze(topology.outputs.map((locator) => {
    const observed = byLocator.get(locator);
    const expectedMode = locator === "dist/cli/cli.js" ? 0o755 : 0o644;
    if (!observed || observed.mode !== expectedMode || observed.stats.nlink !== 1n) {
      fail(`terminal recovery ordinary output mode/link authority drift: ${locator}`);
    }
    return Object.freeze({
      locator,
      mode: expectedMode,
      byteLength: observed.bytes.length,
      sha256: sha256(observed.bytes),
    });
  }));
}

function assertAuthorityCandidatesMatchEnumeration(enumeration, candidates) {
  const byLocator = new Map(enumeration.files.map((snapshot) => [snapshot.locator, snapshot.observed]));
  for (const [locator, bytes] of candidates) {
    const observed = byLocator.get(locator);
    if (!observed || observed.mode !== 0o444 || observed.stats.nlink !== 1n || !observed.bytes.equals(bytes)) {
      fail(`terminal authority differs from its exact candidate: ${locator}`);
    }
  }
}

function assertEnumerationSnapshots(repository, enumeration, label) {
  for (const snapshot of enumeration.files) {
    const reopened = readStableRegular(path.join(repository.root, ...snapshot.locator.split("/")), MAX_BUILD_FILE_BYTES_V1, {
      device: repository.device,
      nlink: Number(snapshot.observed.stats.nlink),
    });
    if (!sameRegularMetadata(reopened.stats, snapshot.observed.stats) || !reopened.bytes.equals(snapshot.observed.bytes)) {
      fail(`${label} file identity changed: ${snapshot.locator}`);
    }
  }
  for (const snapshot of enumeration.directories) {
    assertDirectoryIdentity(
      path.join(repository.root, ...snapshot.locator.split("/")),
      snapshot.identity,
      `${label} directory ${snapshot.locator}`,
    );
  }
}

function expectedReleaseManifest(pinned) {
  const entry = pinned.entries.find((candidate) => candidate.locator === "scripts/stitch-to-jsx.mjs");
  if (!entry || entry.gitMode !== "100644") fail("pinned Stitch converter entry is missing or executable");
  const bytes = pinned.blobs.get(entry.gitBlobHash);
  if (bytes.length < 1 || bytes.length > MAX_STITCH_CONVERTER_BYTES_V1) fail("pinned Stitch converter size is invalid");
  strictUtf8(bytes, "pinned Stitch converter");
  return Object.freeze({
    schema: "setfarm.platform-release-manifest.v1",
    releaseSha: pinned.sourceSha,
    branch: "main",
    dirty: false,
    stitchConverter: {
      converterId: "setfarm.stitch-to-jsx",
      source: {
        schema: "setfarm.source-artifact-ref.v1",
        hash: sha256(bytes),
        mediaType: "text/javascript",
        locator: "scripts/stitch-to-jsx.mjs",
        byteLength: bytes.length,
      },
    },
  });
}

function selectedPhase() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--prepare", "--finalize"].includes(args[0])) {
    fail("exactly one public build-writer command is required");
  }
  return args[0];
}

function rotationControllerSourceV1(pinned) {
  return Object.freeze({
    branch: "main",
    clean: true,
    sourceSha: pinned.sourceSha,
    sourceTreeHash: pinned.sourceTreeHash,
    originMainSha: pinned.sourceSha,
    buildInputSetHash: pinned.buildInputSetHash,
  });
}

function preparePreflight() {
  const repository = anchorRepository();
  const pinned = derivePinnedInputSet(repository.root);
  verifyLivePinnedInputs(repository.root, pinned, repository.device);
  verifyBuildTopology(pinned);
  deriveExpectedOutputs(pinned);
  const buildId = randomUUID();
  return Object.freeze({ schema: "setfarm.platform-build-writer-preflight.v1", buildId, rotationControllerSource: rotationControllerSourceV1(pinned) });
}

function observeLockedWriterV1(lock) {
  if (lock.pid !== process.pid || !Number.isSafeInteger(process.pid) || process.pid < 1) fail("locked writer process PID is invalid");
  const observed = spawnSync("/bin/ps", ["-p", String(lock.pid), "-o", "lstart=", "-o", "pgid="], {
    shell: false,
    env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C" },
    timeout: 10_000,
    maxBuffer: 1_048_576,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = Buffer.isBuffer(observed.stdout) ? observed.stdout : Buffer.from(observed.stdout ?? "");
  const stderr = Buffer.isBuffer(observed.stderr) ? observed.stderr : Buffer.from(observed.stderr ?? "");
  const match = /^([A-Z][a-z]{2} [A-Z][a-z]{2} (?: [1-9]|[12][0-9]|3[01]) [0-9]{2}:[0-9]{2}:[0-9]{2} [0-9]{4}) +([1-9][0-9]*)\n$/.exec(stdout.toString("utf8"));
  if (observed.error || observed.signal !== null || observed.status !== 0 || stderr.length !== 0 || !match || match[1] !== lock.processLstart || Number(match[2]) !== lock.processGroupId) {
    fail("locked writer parent process identity is invalid");
  }
}

function parseLockedRotationPairV1(value, kind) {
  const refKey = `${kind}Ref`;
  const hashKey = `${kind}Hash`;
  if (!hasExactKeys(value, [refKey, hashKey]) || !SHA256.test(value[hashKey])) fail(`locked writer ${kind} pair is invalid`);
  const match = new RegExp(`^setfarm://internal-production/build-generation-rotation-${kind}/([0-9]{20})/([0-9a-f-]{36})/sha256/(${value[hashKey]})$`).exec(value[refKey]);
  if (!match || !UUID_V4.test(match[2])) fail(`locked writer ${kind} pair ref is invalid`);
  return Object.freeze({ ordinal: match[1], buildId: match[2] });
}

function assertLockedPrepareRequest(repository, pinned, phase, value) {
  const isCreate = phase === "create";
  const expectedKeys = isCreate
    ? ["schema", "buildId", "maintenanceCandidateBuildId", "rotationControllerSource", "maintenanceLock", "rotation"]
    : ["schema", "buildId", "maintenanceCandidateBuildId", "rotationControllerSource", "maintenanceLock"];
  const expectedSchema = isCreate
    ? "setfarm.platform-build-writer-locked-create-request.v1"
    : "setfarm.platform-build-writer-locked-sanitize-request.v1";
  if (!value || !hasExactKeys(value, expectedKeys)) fail("locked writer request shape is invalid");
  if (value.schema !== expectedSchema || !UUID_V4.test(value.buildId) || canonicalJson(value.rotationControllerSource) !== canonicalJson(rotationControllerSourceV1(pinned))) fail("locked writer request source is invalid");
  const lock = value.maintenanceLock;
  if (!hasExactKeys(lock, ["schema", "kind", "nonce", "pid", "processLstart", "processGroupId", "candidateKeyHash"])
    || lock.schema !== "setfarm.platform-build-generation-maintenance-lock.v1" || lock.kind !== "writer_prepare" || !UUID_V4.test(lock.nonce)
    || !Number.isSafeInteger(lock.pid) || lock.pid < 1 || typeof lock.processLstart !== "string" || !Number.isSafeInteger(lock.processGroupId) || lock.processGroupId < 1
    || !UUID_V4.test(value.maintenanceCandidateBuildId)
    || lock.candidateKeyHash !== hashCanonicalJson({ kind: "writer_prepare", buildId: value.maintenanceCandidateBuildId, rotationControllerSource: value.rotationControllerSource })
  ) fail("locked writer maintenance authority is invalid");
  observeLockedWriterV1(lock);
  const lockPath = path.join(repository.root, ".setfarm", "build-generation-maintenance-lock-v1.json");
  const observedLock = readStableRegular(lockPath, MAX_AUTHORITY_BYTES_V1, { device: repository.device, nlink: 1 });
  if (observedLock.mode !== 0o600 || !observedLock.bytes.equals(Buffer.from(`${canonicalJson(lock)}\n`, "utf8"))) fail("locked writer maintenance file differs from request");
  if (isCreate) {
    if (!value.rotation || !hasExactKeys(value.rotation, ["rotated", "intent", "completion", "archiveLocator"]) || typeof value.rotation.rotated !== "boolean") fail("locked writer rotation result is invalid");
    if (value.rotation.rotated) {
      const intent = parseLockedRotationPairV1(value.rotation.intent, "intent");
      const completion = parseLockedRotationPairV1(value.rotation.completion, "completion");
      const archive = /^\.setfarm\/build-generations-v1\/([0-9a-f-]{36})\.dist$/.exec(value.rotation.archiveLocator);
      if (!archive || !UUID_V4.test(archive[1]) || intent.ordinal !== completion.ordinal || intent.buildId !== completion.buildId || archive[1] !== completion.buildId) fail("locked writer rotation pairs are invalid");
    } else if (value.rotation.intent !== null || value.rotation.completion !== null || value.rotation.archiveLocator !== null) fail("locked writer rotation pairs are invalid");
  }
  return value;
}

function prepareLockedSanitize(value) {
  const repository = anchorRepository();
  const pinned = derivePinnedInputSet(repository.root);
  verifyLivePinnedInputs(repository.root, pinned, repository.device);
  verifyBuildTopology(pinned);
  deriveExpectedOutputs(pinned);
  const request = assertLockedPrepareRequest(repository, pinned, "sanitize", value);
  const archive = prepareArchiveRoot(repository, request.buildId);
  const candidate = path.join(archive.archiveRoot, `${request.buildId}.dist`);
  try { lstatSync(candidate); fail("build archive candidate already exists"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  const distPath = path.join(repository.root, "dist");
  let distPresent = true;
  try { lstatSync(distPath); } catch (error) { if (error?.code === "ENOENT") distPresent = false; else throw error; }
  if (distPresent && archive.names.length >= MAX_BUILD_ARCHIVE_GENERATIONS_V1) {
    fail("BUILD_GENERATION_RETENTION_REQUIRED: eight retained generations already exist");
  }
  if (distPresent) {
    validateStorageTree(distPath, repository.device, undefined, false, true);
    for (const basename of PREVIOUS_BUILD_PUBLISHER_BASENAMES_V1) sanitizePublisherFamily(distPath, repository.device, basename);
    validateStorageTree(distPath, repository.device, undefined, true, false);
    validateStorageTree(distPath, repository.device, 0o755, false, false);
  }
  verifyLivePinnedInputs(repository.root, pinned, repository.device);
  return Object.freeze({ schema: "setfarm.platform-build-writer-locked-sanitize-response.v1", buildId: request.buildId, distPresent });
}

function createFreshPreparedDist(repository, pinned, packageVersion, topology, buildId) {
  const distPath = path.join(repository.root, "dist");
  try { lstatSync(distPath); fail("locked writer rotation left dist present"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  mkdirSync(distPath, { mode: 0o755 });
  fsyncDirectory(repository.root);
  const createdDistIdentity = directoryIdentity(distPath, "fresh dist", repository.device);
  const distIdentity = normalizeDirectoryRevalidated(distPath, createdDistIdentity, 0o755, "fresh dist");
  createExpectedDirectories(repository.root, distPath, topology.directories, repository.device);
  const candidateInfo = buildInfoCandidate(pinned, packageVersion);
  publishExactArtifact(distPath, BUILD_INFO_FILE, Buffer.from(`${JSON.stringify(candidateInfo, null, 2)}\n`, "utf8"), repository.device);
  const receipt = {
    schema: "setfarm.platform-build-prepare.v2", buildId, sourceSha: pinned.sourceSha, sourceTreeHash: pinned.sourceTreeHash,
    buildInputSetHash: pinned.buildInputSetHash, branch: "main", dirty: false, porcelainV2Hash: pinned.porcelainV2Hash,
    repositoryDirectoryIdentity: repository.identity, distDirectoryIdentity: distIdentity,
  };
  writePrepareReceipt(distPath, receipt, repository.device);
  const prepareSnapshots = captureFileSnapshots(repository, [`dist/${BUILD_INFO_FILE}`, `dist/${PREPARE_FILE}`], "prepared authority");
  verifyLivePinnedInputs(repository.root, pinned, repository.device);
  assertFileSnapshots(repository, prepareSnapshots, "prepared authority");
  assertDirectoryIdentity(repository.root, repository.identity, "Platform repository root");
  assertDirectoryIdentity(distPath, distIdentity, "fresh dist");
  return candidateInfo;
}

function prepareLockedCreate(value) {
  const repository = anchorRepository();
  const pinned = derivePinnedInputSet(repository.root);
  verifyLivePinnedInputs(repository.root, pinned, repository.device);
  const packageVersion = verifyBuildTopology(pinned);
  const topology = deriveExpectedOutputs(pinned);
  const request = assertLockedPrepareRequest(repository, pinned, "create", value);
  const { buildId } = request;
  const archive = prepareArchiveRoot(repository, buildId);
  const candidate = request.rotation.rotated
    ? path.join(repository.root, request.rotation.archiveLocator)
    : path.join(archive.archiveRoot, `${buildId}.dist`);
  const candidatePresent = (() => { try { lstatSync(candidate); return true; } catch (error) { if (error?.code === "ENOENT") return false; throw error; } })();
  if (candidatePresent !== request.rotation.rotated) fail("locked writer rotation/archive result is crossed");
  const candidateInfo = createFreshPreparedDist(repository, pinned, packageVersion, topology, buildId);
  return Object.freeze({ schema: "setfarm.platform-build-writer-locked-create-response.v1", buildId, candidateInfo });
}

function observeWriterProcessIdentity(pid, expected) {
  if (!Number.isSafeInteger(pid) || pid < 1) return Object.freeze({ state: "ambiguous" });
  const observed = spawnSync("/bin/ps", ["-p", String(pid), "-o", "lstart=", "-o", "pgid="], {
    shell: false,
    env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LANG: "C", LC_ALL: "C" },
    timeout: 10_000,
    maxBuffer: 1_048_576,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = Buffer.isBuffer(observed.stdout) ? observed.stdout : Buffer.from(observed.stdout ?? "");
  const stderr = Buffer.isBuffer(observed.stderr) ? observed.stderr : Buffer.from(observed.stderr ?? "");
  if (!observed.error && observed.signal === null && observed.status === 1 && stdout.length === 0 && stderr.length === 0) return Object.freeze({ state: "definitely_dead" });
  const match = /^([A-Z][a-z]{2} [A-Z][a-z]{2} (?: [1-9]|[12][0-9]|3[01]) [0-9]{2}:[0-9]{2}:[0-9]{2} [0-9]{4}) +([1-9][0-9]*)\n$/.exec(stdout.toString("utf8"));
  if (observed.error || observed.signal !== null || observed.status !== 0 || stderr.length !== 0 || !match) return Object.freeze({ state: "ambiguous" });
  const identity = Object.freeze({ processLstart: match[1], processGroupId: Number(match[2]) });
  if (!Number.isSafeInteger(identity.processGroupId) || identity.processGroupId < 1) return Object.freeze({ state: "ambiguous" });
  if (expected && (identity.processLstart !== expected.processLstart || identity.processGroupId !== expected.processGroupId)) return Object.freeze({ state: "live_pid_reused", ...identity });
  return Object.freeze({ state: "live_match", ...identity });
}

function parseWriterMaintenanceLock(filePath) {
  const parsed = parseWriterCanonicalRecord(filePath, [1, 2]);
  const value = parsed.value;
  if (!value || !hasExactKeys(value, ["schema", "kind", "nonce", "pid", "processLstart", "processGroupId", "candidateKeyHash"])
    || value.schema !== "setfarm.platform-build-generation-maintenance-lock.v1"
    || !["writer_prepare", "retention_prepare", "retention_resume"].includes(value.kind)
    || !UUID_V4.test(value.nonce) || !Number.isSafeInteger(value.pid) || value.pid < 1
    || typeof value.processLstart !== "string" || !Number.isSafeInteger(value.processGroupId) || value.processGroupId < 1
    || !SHA256.test(value.candidateKeyHash)) fail("maintenance lock body is invalid");
  return parsed;
}

function recoverWriterMaintenanceLock(setfarm) {
  const pattern = publisherTempPattern(MAINTENANCE_LOCK_FILE_V1);
  const family = readdirSync(setfarm).filter((name) => name === MAINTENANCE_LOCK_FILE_V1 || name.startsWith(`.${MAINTENANCE_LOCK_FILE_V1}.`)).sort(compareBytes);
  const temps = family.filter((name) => name !== MAINTENANCE_LOCK_FILE_V1);
  if (temps.length > MAX_NO_REPLACE_PUBLISHER_TEMP_CANDIDATES_V1 || temps.some((name) => !pattern.test(name))) fail("maintenance lock temporary state is invalid");
  for (const name of family) {
    const filePath = path.join(setfarm, name);
    const parsed = parseWriterMaintenanceLock(filePath);
    const owner = observeWriterProcessIdentity(parsed.value.pid, parsed.value);
    if (["definitely_dead", "live_pid_reused"].includes(owner.state)) writerUnlinkStable(filePath, parsed.observed, setfarm);
    else fail(`maintenance lock owner is ${owner.state}`);
  }
}

function acquireWriterMaintenanceLock(setfarm, candidateKeyHash) {
  recoverWriterMaintenanceLock(setfarm);
  const identity = observeWriterProcessIdentity(process.pid);
  if (identity.state !== "live_match") fail("current maintenance process identity is ambiguous");
  const value = Object.freeze({
    schema: "setfarm.platform-build-generation-maintenance-lock.v1",
    kind: "writer_prepare",
    nonce: randomUUID(),
    pid: process.pid,
    processLstart: identity.processLstart,
    processGroupId: identity.processGroupId,
    candidateKeyHash,
  });
  const fixedPath = path.join(setfarm, MAINTENANCE_LOCK_FILE_V1);
  const tempPath = path.join(setfarm, `.${MAINTENANCE_LOCK_FILE_V1}.${value.nonce}.tmp`);
  const bytes = writerCanonicalRecordBytes(value);
  let descriptor;
  try {
    descriptor = openSync(tempPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  const created = readStableRegular(tempPath, MAX_AUTHORITY_BYTES_V1, { nlink: 1 });
  try {
    linkSync(tempPath, fixedPath);
    fsyncDirectory(setfarm);
  } catch (error) {
    if (optionalWriterLstat(tempPath)) writerUnlinkStable(tempPath, created, setfarm);
    if (error?.code !== "EEXIST") throw error;
    fail("maintenance lock is unavailable");
  }
  const linked = readStableRegular(tempPath, MAX_AUTHORITY_BYTES_V1, { nlink: 2 });
  const fixed = readStableRegular(fixedPath, MAX_AUTHORITY_BYTES_V1, { nlink: 2 });
  if (linked.stats.ino !== fixed.stats.ino || !linked.bytes.equals(bytes) || !fixed.bytes.equals(bytes)) fail("maintenance lock fixed-link identity changed");
  writerUnlinkStable(tempPath, linked, setfarm);
  const reopened = readStableRegular(fixedPath, MAX_AUTHORITY_BYTES_V1, { nlink: 1 });
  if (!reopened.bytes.equals(bytes)) fail("maintenance lock authority changed after publication");
  return Object.freeze({ value, bytes, file: fixedPath });
}

function releaseWriterMaintenanceLock(setfarm, lock) {
  const parsed = parseWriterMaintenanceLock(lock.file);
  if (!parsed.observed.bytes.equals(lock.bytes) || canonicalJson(parsed.value) !== canonicalJson(lock.value)
    || parsed.value.pid !== process.pid || observeWriterProcessIdentity(process.pid, parsed.value).state !== "live_match") fail("maintenance lock ownership changed before release");
  writerUnlinkStable(lock.file, parsed.observed, setfarm);
}

function rotateWriterGeneration(input, roots, inspection) {
  const dist = path.join(roots.root, "dist");
  let intent = inspection.danglingIntent;
  if (intent) {
    if (canonicalJson(intent.rotationControllerSource) !== canonicalJson(input.rotationControllerSource)) fail("writer candidate does not own the dangling rotation intent");
  } else {
    if (!optionalWriterLstat(dist)) return Object.freeze({ rotated: false, intent: null, completion: null });
    if (inspection.generations.filter((generation) => generation.disposition === null).length >= MAX_BUILD_ARCHIVE_GENERATIONS_V1) fail("BUILD_GENERATION_RETENTION_REQUIRED: eight retained generations already exist");
    const ordinal = inspection.generations.length + 1;
    const destinationLocator = `${ARCHIVE_DIRECTORY_V1}/${input.buildId}.dist`;
    if (optionalWriterLstat(path.join(roots.root, destinationLocator))) fail("rotation destination already exists");
    intent = publishWriterRotationRecord(roots.intents, "intent", {
      schema: "setfarm.platform-build-generation-rotation-intent.v1",
      ordinal,
      buildId: input.buildId,
      predecessorCompletion: inspection.completionTip,
      sourceParentIdentity: writerDirectoryIdentity(roots.root, roots.device),
      destinationParentIdentity: writerDirectoryIdentity(roots.archive, roots.device),
      sourceLocator: "dist",
      destinationLocator,
      inventory: writerInventory(dist),
      rotationControllerSource: input.rotationControllerSource,
    });
  }
  const destination = path.join(roots.root, intent.destinationLocator);
  const sourcePresent = optionalWriterLstat(dist);
  const destinationPresent = optionalWriterLstat(destination);
  if (sourcePresent && !destinationPresent) {
    const inventory = writerInventory(dist);
    if (inventory.physicalInventoryHash !== intent.inventory.physicalInventoryHash || inventory.contentInventoryHash !== intent.inventory.contentInventoryHash) fail("dangling rotation source inventory changed");
    renameSync(dist, destination);
    fsyncDirectory(roots.root);
    fsyncDirectory(roots.archive);
  } else if (sourcePresent || !destinationPresent) fail("rotation intent has an ambiguous source/destination state");
  if (optionalWriterLstat(dist)) fail("rotation source remained after rename");
  const archiveIdentity = writerDirectoryIdentity(destination, roots.device);
  const movedInventory = writerInventory(destination);
  if (canonicalJson(movedInventory) !== canonicalJson(intent.inventory)) fail("rotated archive inventory changed");
  const completion = publishWriterRotationRecord(roots.completions, "completion", {
    schema: "setfarm.platform-build-generation-rotation-completion.v1",
    ordinal: intent.ordinal,
    buildId: intent.buildId,
    predecessorCompletion: intent.predecessorCompletion,
    intent: writerPair(intent, "intent"),
    sourceParentIdentity: intent.sourceParentIdentity,
    destinationParentIdentity: intent.destinationParentIdentity,
    archiveLocator: intent.destinationLocator,
    archiveIdentity,
    inventory: movedInventory,
    rotationControllerSource: intent.rotationControllerSource,
  });
  return Object.freeze({ rotated: true, intent, completion });
}

function runCodeOwnedWriterPrepare(pure) {
  if (!pure || typeof pure.hashCanonicalJsonV1 !== "function" || typeof pure.canonicalJsonV1 !== "function" || typeof pure.planNoReplacePublisherRecoveryV1 !== "function") fail("shared pure retention helpers are unavailable");
  const preflight = preparePreflight();
  const input = Object.freeze({ buildId: preflight.buildId, rotationControllerSource: preflight.rotationControllerSource });
  const repository = anchorRepository();
  const setfarm = path.join(repository.root, ".setfarm");
  if (!optionalWriterLstat(setfarm)) ensureDirectory(setfarm, 0o700, repository.root, repository.device);
  else if (writerDirectoryIdentity(setfarm, repository.device).mode !== 0o700) fail(".setfarm must have mode 0o700");
  const candidateKeyHash = pure.hashCanonicalJsonV1({ kind: "writer_prepare", buildId: input.buildId, rotationControllerSource: input.rotationControllerSource });
  const lock = acquireWriterMaintenanceLock(setfarm, candidateKeyHash);
  let released = false;
  try {
    const roots = ensureWriterAuthorityRoots(repository.root);
    normalizeWriterRetentionStores(repository.root, pure);
    if (optionalWriterLstat(path.join(repository.root, "dist")) && readdirSync(roots.archive).length >= MAX_BUILD_ARCHIVE_GENERATIONS_V1) {
      fail("BUILD_GENERATION_RETENTION_REQUIRED: eight retained generations already exist");
    }
    const localInspection = scanWriterRotationLedger(roots);
    const strictInspection = pure.inspectBuildGenerationRotationLedgerV1();
    const strictProjection = { completionTip: strictInspection.completionTip, danglingIntent: strictInspection.danglingIntent, generations: strictInspection.generations };
    if (pure.canonicalJsonV1(localInspection) !== pure.canonicalJsonV1(strictProjection)) fail("writer ledger view differs from strict disposed closure");
    if (strictInspection.danglingIntent && pure.canonicalJsonV1(strictInspection.danglingIntent.rotationControllerSource) !== pure.canonicalJsonV1(input.rotationControllerSource)) fail("current writer source cannot recover the dangling intent");
    const baseRequest = { buildId: input.buildId, maintenanceCandidateBuildId: input.buildId, rotationControllerSource: input.rotationControllerSource, maintenanceLock: lock.value };
    const sanitized = prepareLockedSanitize(Object.freeze({ ...baseRequest, schema: "setfarm.platform-build-writer-locked-sanitize-request.v1" }));
    const rotation = rotateWriterGeneration(input, roots, strictProjection);
    if (sanitized.distPresent && !rotation.rotated) fail("locked build writer sanitation/rotation state is crossed");
    const response = prepareLockedCreate(Object.freeze({
      ...baseRequest,
      schema: "setfarm.platform-build-writer-locked-create-request.v1",
      rotation: rotation.rotated
        ? { rotated: true, intent: writerPair(rotation.intent, "intent"), completion: writerPair(rotation.completion, "completion"), archiveLocator: rotation.completion.archiveLocator }
        : { rotated: false, intent: null, completion: null, archiveLocator: null },
    }));
    releaseWriterMaintenanceLock(setfarm, lock);
    released = true;
    return Object.freeze({ buildId: input.buildId, candidateInfo: response.candidateInfo });
  } finally {
    if (!released && optionalWriterLstat(lock.file)) releaseWriterMaintenanceLock(setfarm, lock);
  }
}

function prepareLegacyInitialBuild() {
  const repository = anchorRepository();
  const pinned = derivePinnedInputSet(repository.root);
  if (pinned.entries.some((entry) => entry.locator === "scripts/build-generation-retention.mjs")) fail("tracked build-generation retention module is missing");
  try { lstatSync(path.join(repository.root, ".setfarm")); fail("legacy initial prepare cannot cross existing maintenance authority"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  try { lstatSync(path.join(repository.root, "dist")); fail("legacy initial prepare cannot rotate an existing build"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  verifyLivePinnedInputs(repository.root, pinned, repository.device);
  const packageVersion = verifyBuildTopology(pinned);
  const topology = deriveExpectedOutputs(pinned);
  const buildId = randomUUID();
  const candidateInfo = createFreshPreparedDist(repository, pinned, packageVersion, topology, buildId);
  return Object.freeze({ buildId, candidateInfo });
}

async function prepare() {
  let result;
  try {
    const pure = await import("./build-generation-retention.mjs");
    result = runCodeOwnedWriterPrepare(pure);
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND" || !String(error.message).includes("build-generation-retention.mjs")) throw error;
    result = prepareLegacyInitialBuild();
  }
  console.log(`[write-build-info] prepared ${result.candidateInfo.displayVersion} build=${result.buildId}`);
}

function finalize() {
  const repository = anchorRepository();
  const distPath = path.join(repository.root, "dist");
  const distIdentity = directoryIdentity(distPath, "fresh dist", repository.device);
  if (distIdentity.mode !== 0o755) fail("fresh dist must have mode 0o755");
  const pinned = derivePinnedInputSet(repository.root);
  verifyLivePinnedInputs(repository.root, pinned, repository.device);
  const packageVersion = verifyBuildTopology(pinned);
  const topology = deriveExpectedOutputs(pinned);
  const preparePath = path.join(distPath, PREPARE_FILE);
  let receipt;
  try {
    receipt = readPrepareReceipt(distPath, repository.device);
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
  }
  if (receipt) {
    if (
      receipt.sourceSha !== pinned.sourceSha
      || receipt.sourceTreeHash !== pinned.sourceTreeHash
      || receipt.buildInputSetHash !== pinned.buildInputSetHash
      || receipt.porcelainV2Hash !== pinned.porcelainV2Hash
      || !sameIdentity(receipt.repositoryDirectoryIdentity, repository.identity)
      || !sameIdentity(receipt.distDirectoryIdentity, distIdentity)
    ) fail("Current source/build identities do not match the exact prepare receipt");
  } else if (!readdirSync(distPath).includes(OUTPUT_TREE_FILE)) {
    fail("prepare receipt is missing before output-tree authority");
  }
  const buildInfo = readBuildInfo(distPath, repository.device, pinned, packageVersion);
  const preNormalizationInventory = enumerateDist(repository, distPath, topology, Boolean(receipt));
  assertPreNormalizationOutputs(topology, preNormalizationInventory);
  const entries = receipt
    ? normalizeExpectedTopology(repository, distPath, topology)
    : readOnlyOutputEntries(topology, preNormalizationInventory);
  const enumeratedBeforePublication = enumerateDist(repository, distPath, topology, Boolean(receipt));
  assertOutputEntriesMatchEnumeration(entries, enumeratedBeforePublication);
  const buildInfoAfterEnumeration = readBuildInfo(distPath, repository.device, pinned, packageVersion);
  if (canonicalJson(buildInfoAfterEnumeration) !== canonicalJson(buildInfo)) fail("BUILD_INFO changed across output enumeration");
  if (receipt) {
    const receiptAfterEnumeration = readPrepareReceipt(distPath, repository.device);
    if (canonicalJson(receiptAfterEnumeration) !== canonicalJson(receipt)) fail("prepare receipt changed across output enumeration");
  }
  assertDirectoryIdentity(repository.root, repository.identity, "Platform repository root before output-tree publication");
  assertDirectoryIdentity(distPath, distIdentity, "fresh dist before output-tree publication");
  const outputTreeProjection = {
    schema: "setfarm.platform-build-output-tree.v1",
    sourceSha: pinned.sourceSha,
    sourceTreeHash: pinned.sourceTreeHash,
    entries,
  };
  const outputTree = Object.freeze({ ...outputTreeProjection, outputTreeHash: hashCanonicalJson(outputTreeProjection) });
  const outputTreeBytes = Buffer.from(`${JSON.stringify(outputTree)}\n`, "utf8");
  publishExactArtifact(distPath, OUTPUT_TREE_FILE, outputTreeBytes, repository.device);
  if (receipt) {
    const prepareBytes = Buffer.from(`${JSON.stringify(receipt)}\n`, "utf8");
    const prepareStable = readStableRegular(preparePath, MAX_AUTHORITY_BYTES_V1, { device: repository.device, nlink: 1 });
    if (prepareStable.mode !== 0o444 || !prepareStable.bytes.equals(prepareBytes)) fail("prepare receipt changed before removal");
    unlinkRevalidated(preparePath, prepareStable, undefined, undefined, "prepare receipt");
  }
  const releaseManifest = expectedReleaseManifest(pinned);
  const releaseBytes = Buffer.from(`${JSON.stringify(releaseManifest)}\n`, "utf8");
  publishExactArtifact(distPath, RELEASE_MANIFEST_FILE, releaseBytes, repository.device);
  const terminalEnumeration = enumerateDist(repository, distPath, topology, false);
  assertOutputEntriesMatchEnumeration(entries, terminalEnumeration);
  const buildInfoBytes = Buffer.from(`${JSON.stringify(buildInfo, null, 2)}\n`, "utf8");
  assertAuthorityCandidatesMatchEnumeration(terminalEnumeration, [
    [`dist/${BUILD_INFO_FILE}`, buildInfoBytes],
    [`dist/${OUTPUT_TREE_FILE}`, outputTreeBytes],
    [`dist/${RELEASE_MANIFEST_FILE}`, releaseBytes],
  ]);
  verifyFixedArtifact(distPath, BUILD_INFO_FILE, buildInfoBytes, repository.device);
  verifyFixedArtifact(distPath, OUTPUT_TREE_FILE, outputTreeBytes, repository.device);
  verifyFixedArtifact(distPath, RELEASE_MANIFEST_FILE, releaseBytes, repository.device);
  const after = derivePinnedInputSet(repository.root);
  verifyLivePinnedInputs(repository.root, after, repository.device);
  if (
    after.sourceSha !== pinned.sourceSha
    || after.sourceTreeHash !== pinned.sourceTreeHash
    || after.buildInputSetHash !== pinned.buildInputSetHash
  ) fail("Pinned source changed during finalization");
  assertEnumerationSnapshots(repository, terminalEnumeration, "terminal build tree after final source verification");
  assertDirectoryIdentity(repository.root, repository.identity, "Platform repository root");
  assertDirectoryIdentity(distPath, distIdentity, "fresh dist");
  console.log(`[write-build-info] finalized ${buildInfo.displayVersion}; manifest is terminal`);
}

try {
  const phase = selectedPhase();
  if (phase === "--prepare") await prepare();
  else finalize();
} catch (error) {
  console.error(`[write-build-info] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
