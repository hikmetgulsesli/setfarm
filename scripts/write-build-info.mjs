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
const RFC3339_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CANONICAL_ORIGIN = "https://github.com/hikmetgulsesli/setfarm.git\n";
const COPY_STEP_ASSETS_SOURCE_SHA256_V1 = "ebc1329d163f2e3670372ba203ed98dd1d2e79c0fcaa946e364aa8db334a1a8c";
const COPY_STEP_ASSETS_SOURCE_BYTES_V1 = 1_117;

const EXACT_SCRIPTS = Object.freeze({
  prebuild: "node scripts/write-build-info.mjs --prepare && node scripts/check-version-contract.mjs && node scripts/check-english-contract.mjs && node scripts/check-path-contract.mjs && npm run check:migration-digests && npm run check:mission-control-contracts",
  build: "umask 077 && tsc -p tsconfig.json && cp src/server/index.html dist/server/index.html && cp src/installer/compat-rules.json dist/installer/compat-rules.json && mkdir -p dist/installer/prompts && cp src/installer/prompts/*.md dist/installer/prompts/ && node scripts/copy-step-assets.mjs && chmod +x dist/cli/cli.js && node scripts/inject-version.js",
  postbuild: "node scripts/write-build-info.mjs --finalize",
  "check:migration-digests": "node --import tsx scripts/check-contract-spine-migration-digests.ts --check",
  "check:mission-control-contracts": "node --import tsx scripts/mission-control-contract-artifacts.ts --check",
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
  for (const [name, expected] of Object.entries(EXACT_SCRIPTS)) {
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
    if (relative) directories.push(Object.freeze({ path: directoryPath, identity }));
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

function sameDirectoryMetadata(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function optionalLstat(targetPath) {
  try {
    return lstatSync(targetPath, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

function rotateStorageGeneration(repository, archive, distPath, candidate, distIdentity, capturedStorage) {
  let descriptor;
  try {
    descriptor = openSync(distPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = fstatSync(descriptor, { bigint: true });
    if (
      !before.isDirectory()
      || before.dev.toString(10) !== distIdentity.devDecimal
      || before.ino.toString(10) !== distIdentity.inoDecimal
      || modeOf(before) !== distIdentity.mode
    ) fail("pre-rotation dist changed before boundary descriptor open");
    const boundaryStorage = validateStorageTree(distPath, repository.device, 0o755, false, false);
    if (canonicalJson(boundaryStorage) !== canonicalJson(capturedStorage)) fail("pre-rotation storage changed at rename boundary");
    const afterTraversal = fstatSync(descriptor, { bigint: true });
    const namedBefore = lstatSync(distPath, { bigint: true });
    if (!sameDirectoryMetadata(before, afterTraversal) || !sameDirectoryMetadata(afterTraversal, namedBefore)) {
      fail("pre-rotation dist directory changed at rename boundary");
    }
    assertDirectoryIdentity(repository.root, repository.identity, "Platform repository root before rotation");
    assertDirectoryIdentity(archive.setfarmPath, archive.setfarmIdentity, ".setfarm before rotation");
    assertDirectoryIdentity(archive.archiveRoot, archive.archiveIdentity, "build archive root before rotation");
    assertDirectoryIdentity(distPath, distIdentity, "pre-rotation dist");

    try {
      renameSync(distPath, candidate);
    } catch (error) {
      const sourceStats = optionalLstat(distPath);
      const candidateStats = optionalLstat(candidate);
      if (!sourceStats && candidateStats) {
        if (!candidateStats.isDirectory() || candidateStats.isSymbolicLink()) fail("response-lost rotation candidate type conflicts");
        fsyncDirectory(repository.root);
        fsyncDirectory(archive.archiveRoot);
        const adopted = directoryIdentity(candidate, "response-lost rotated build generation", repository.device);
        if (
          adopted.devDecimal !== distIdentity.devDecimal
          || adopted.inoDecimal !== distIdentity.inoDecimal
          || adopted.mode !== 0o755
        ) fail("response-lost rotation candidate identity conflicts");
        const adoptedStorage = validateStorageTree(candidate, repository.device, 0o755, false, false);
        if (canonicalJson(adoptedStorage) !== canonicalJson(capturedStorage)) fail("response-lost rotation candidate tree conflicts");
      } else if (sourceStats && !candidateStats) {
        const unchanged = directoryIdentity(distPath, "unchanged pre-rotation dist", repository.device);
        if (
          !sourceStats.isDirectory()
          || sourceStats.isSymbolicLink()
          || unchanged.devDecimal !== distIdentity.devDecimal
          || unchanged.inoDecimal !== distIdentity.inoDecimal
          || unchanged.mode !== 0o755
        ) fail("failed rotation changed the source identity");
        const unchangedStorage = validateStorageTree(distPath, repository.device, 0o755, false, false);
        if (canonicalJson(unchangedStorage) !== canonicalJson(capturedStorage)) fail("failed rotation changed the source tree");
        throw error;
      } else {
        fail("rotation outcome is ambiguous or conflicting");
      }
    }

    fsyncDirectory(repository.root);
    fsyncDirectory(archive.archiveRoot);
    const heldAfter = fstatSync(descriptor, { bigint: true });
    if (
      !heldAfter.isDirectory()
      || heldAfter.dev !== before.dev
      || heldAfter.ino !== before.ino
      || modeOf(heldAfter) !== 0o755
    ) fail("rotated generation descriptor identity changed");
    const moved = directoryIdentity(candidate, "rotated build generation", repository.device);
    if (moved.devDecimal !== distIdentity.devDecimal || moved.inoDecimal !== distIdentity.inoDecimal || moved.mode !== 0o755) {
      fail("rotated build generation identity changed");
    }
    const rotatedStorage = validateStorageTree(candidate, repository.device, 0o755, false, false);
    if (canonicalJson(rotatedStorage) !== canonicalJson(capturedStorage)) fail("rotated build generation tree changed across whole-directory rename");
    assertDirectoryIdentity(repository.root, repository.identity, "Platform repository root after rotation");
    assertDirectoryIdentity(archive.setfarmPath, archive.setfarmIdentity, ".setfarm after rotation");
    assertDirectoryIdentity(archive.archiveRoot, archive.archiveIdentity, "build archive root after rotation");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function selectedPhase() {
  const phases = process.argv.slice(2).filter((value) => value === "--prepare" || value === "--finalize");
  if (phases.length !== 1 || process.argv.slice(2).length !== 1) fail("exactly one explicit phase is required: --prepare or --finalize");
  return phases[0];
}

function prepare() {
  const repository = anchorRepository();
  const pinned = derivePinnedInputSet(repository.root);
  verifyLivePinnedInputs(repository.root, pinned, repository.device);
  const packageVersion = verifyBuildTopology(pinned);
  const topology = deriveExpectedOutputs(pinned);
  const buildId = randomUUID();
  const archive = prepareArchiveRoot(repository, buildId);
  const candidate = path.join(archive.archiveRoot, `${buildId}.dist`);
  try { lstatSync(candidate); fail("build archive candidate already exists"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  const distPath = path.join(repository.root, "dist");
  let distExists = true;
  try { lstatSync(distPath); } catch (error) { if (error?.code === "ENOENT") distExists = false; else throw error; }
  if (distExists && archive.names.length >= MAX_BUILD_ARCHIVE_GENERATIONS_V1) {
    fail("BUILD_GENERATION_RETENTION_REQUIRED: eight retained generations already exist");
  }
  if (distExists) {
    const distIdentity = directoryIdentity(distPath, "pre-rotation dist", repository.device);
    if (distIdentity.mode !== 0o755) fail("pre-rotation dist must have mode 0o755");
    validateStorageTree(distPath, repository.device, undefined, false, true);
    for (const basename of PREVIOUS_BUILD_PUBLISHER_BASENAMES_V1) sanitizePublisherFamily(distPath, repository.device, basename);
    validateStorageTree(distPath, repository.device, undefined, true, false);
    const capturedStorage = validateStorageTree(distPath, repository.device, 0o755, false, false);
    rotateStorageGeneration(repository, archive, distPath, candidate, distIdentity, capturedStorage);
  }
  mkdirSync(distPath, { mode: 0o755 });
  fsyncDirectory(repository.root);
  const createdDistIdentity = directoryIdentity(distPath, "fresh dist", repository.device);
  const distIdentity = normalizeDirectoryRevalidated(distPath, createdDistIdentity, 0o755, "fresh dist");
  createExpectedDirectories(repository.root, distPath, topology.directories, repository.device);
  const info = buildInfoCandidate(pinned, packageVersion);
  publishExactArtifact(distPath, BUILD_INFO_FILE, Buffer.from(`${JSON.stringify(info, null, 2)}\n`, "utf8"), repository.device);
  const receipt = {
    schema: "setfarm.platform-build-prepare.v2",
    buildId,
    sourceSha: pinned.sourceSha,
    sourceTreeHash: pinned.sourceTreeHash,
    buildInputSetHash: pinned.buildInputSetHash,
    branch: "main",
    dirty: false,
    porcelainV2Hash: pinned.porcelainV2Hash,
    repositoryDirectoryIdentity: repository.identity,
    distDirectoryIdentity: distIdentity,
  };
  writePrepareReceipt(distPath, receipt, repository.device);
  const prepareSnapshots = captureFileSnapshots(repository, [
    `dist/${BUILD_INFO_FILE}`,
    `dist/${PREPARE_FILE}`,
  ], "prepared authority");
  verifyLivePinnedInputs(repository.root, pinned, repository.device);
  assertFileSnapshots(repository, prepareSnapshots, "prepared authority");
  assertDirectoryIdentity(repository.root, repository.identity, "Platform repository root");
  assertDirectoryIdentity(distPath, distIdentity, "fresh dist");
  console.log(`[write-build-info] prepared ${info.displayVersion} build=${buildId}`);
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
  if (phase === "--prepare") prepare();
  else finalize();
} catch (error) {
  console.error(`[write-build-info] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
