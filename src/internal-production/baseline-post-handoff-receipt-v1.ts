import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
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
  unlinkSync,
  writeFileSync,
} from "node:fs";
import type { BigIntStats } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import type { InternalProductionCompleteZeroOwnerCensusV1 } from "./owner-admission-v1.js";

const MAX_BUILD_TREE_DEPTH_V1 = 64;
const MAX_BUILD_INPUT_ENTRIES_V1 = 10_000;
const MAX_BUILD_OUTPUT_ENTRIES_V1 = 10_000;
const MAX_BUILD_LOCATOR_UTF8_OCTETS_V1 = 1_024;
const MAX_BUILD_FILE_BYTES_V1 = 33_554_432;
const MAX_BUILD_TOTAL_BYTES_V1 = 536_870_912;
const MAX_STITCH_CONVERTER_BYTES_V1 = 16_777_216;
const FULL_HASH = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const SHA256 = /^[a-f0-9]{64}$/;
const RFC3339_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CANONICAL_ORIGIN = "https://github.com/hikmetgulsesli/setfarm.git\n";
const COPY_STEP_ASSETS_SOURCE_SHA256_V1 = "ebc1329d163f2e3670372ba203ed98dd1d2e79c0fcaa946e364aa8db334a1a8c";
const COPY_STEP_ASSETS_SOURCE_BYTES_V1 = 1_117;
const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
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

export type InternalProductionCleanSetfarmSourceBuildV1 = Readonly<{
  branch: "main";
  clean: true;
  sha: string;
  treeHash: string;
  buildHash: string;
  originMainSha: string;
}>;

type DirectoryIdentityV1 = Readonly<{
  realpath: string;
  devDecimal: string;
  inoDecimal: string;
  mode: number;
}>;

type DirectorySnapshot = Readonly<{
  identity: DirectoryIdentityV1;
  device: bigint;
}>;

type PinnedEntry = Readonly<{
  locator: string;
  gitMode: "100644" | "100755";
  gitBlobHash: string;
}>;

type PinnedSet = Readonly<{
  schema: "setfarm.internal-production-pinned-build-input-set.v1";
  sourceSha: string;
  sourceTreeHash: string;
  entries: readonly PinnedEntry[];
  buildInputSetHash: string;
  blobs: ReadonlyMap<string, Buffer>;
}>;

type SourceObservation = Readonly<{
  pinned: PinnedSet;
  originMainSha: string;
  repository: DirectorySnapshot;
  packageVersion: string;
  outputs: readonly string[];
  directories: readonly string[];
}>;

type StableRegular = Readonly<{
  bytes: Buffer;
  mode: number;
  stats: BigIntStats;
}>;

type FileSnapshot = Readonly<{
  locator: string;
  observed: StableRegular;
}>;

function fail(message: string): never {
  throw new Error(`INTERNAL_PRODUCTION_SETFARM_SOURCE_BUILD_INVALID:${message}`);
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalComparable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalComparable).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalComparable(record[key])}`).join(",")}}`;
}

function compareBytes(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function strictUtf8(bytes: Buffer, label: string): string {
  let text: string;
  try {
    text = UTF8.decode(bytes);
  } catch {
    return fail(`${label} is not strict UTF-8`);
  }
  if (!Buffer.from(text, "utf8").equals(bytes)) fail(`${label} does not round-trip as UTF-8`);
  return text;
}

function canonicalLocator(locator: string): string {
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
  ) fail(`noncanonical locator ${JSON.stringify(locator)}`);
  return locator;
}

function directorySnapshot(directoryPath: string, label: string, expectedDevice?: bigint): DirectorySnapshot {
  const real = realpathSync(directoryPath);
  const stats = lstatSync(directoryPath, { bigint: true });
  if (!stats.isDirectory() || stats.isSymbolicLink() || real !== directoryPath) fail(`${label} must be one real directory`);
  if (expectedDevice !== undefined && stats.dev !== expectedDevice) fail(`${label} is on the wrong device`);
  return Object.freeze({
    identity: Object.freeze({
      realpath: real,
      devDecimal: stats.dev.toString(10),
      inoDecimal: stats.ino.toString(10),
      mode: Number(stats.mode & 0o777n),
    }),
    device: stats.dev,
  });
}

function sameDirectory(left: DirectoryIdentityV1, right: DirectoryIdentityV1): boolean {
  return left.realpath === right.realpath
    && left.devDecimal === right.devDecimal
    && left.inoDecimal === right.inoDecimal
    && left.mode === right.mode;
}

function assertDirectory(directoryPath: string, expected: DirectorySnapshot, label: string): void {
  const observed = directorySnapshot(directoryPath, label, expected.device);
  if (!sameDirectory(observed.identity, expected.identity)) fail(`${label} identity changed`);
}

function sameRegularMetadata(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function runGit(root: string, args: readonly string[], acceptedStatuses: readonly number[] = [0], input?: Buffer) {
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
  ) fail(`Git command failed (${args.join(" ")})`);
  return Object.freeze({ status: result.status, stdout });
}

function gitLine(root: string, args: readonly string[], label: string): string {
  const text = strictUtf8(runGit(root, args).stdout, label);
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n") || text.slice(0, -1).includes("\r")) {
    fail(`${label} must be exactly one line`);
  }
  return text.slice(0, -1);
}

function fixedRepositoryRoot(): string {
  const modulePath = realpathSync(fileURLToPath(import.meta.url));
  const expectedBasenames = new Set([
    "baseline-post-handoff-receipt-v1.ts",
    "baseline-post-handoff-receipt-v1.js",
  ]);
  if (!expectedBasenames.has(path.basename(modulePath))) fail("observer module basename is not code-owned");
  const internalProduction = path.dirname(modulePath);
  if (path.basename(internalProduction) !== "internal-production") fail("observer module directory is invalid");
  const sourceOrDist = path.dirname(internalProduction);
  if (!["src", "dist"].includes(path.basename(sourceOrDist))) fail("observer module is outside src/dist");
  return realpathSync(path.dirname(sourceOrDist));
}

function readStableRegular(
  filePath: string,
  maxBytes: number,
  device: bigint,
  expectedLinkCount = 1,
): StableRegular {
  const parentPath = path.dirname(filePath);
  const parentBefore = directorySnapshot(parentPath, `parent of ${filePath}`, device);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.dev !== device || before.nlink !== BigInt(expectedLinkCount)) {
      fail(`${filePath} is not one same-device regular link-count-${expectedLinkCount} file`);
    }
    if (before.size > BigInt(maxBytes)) fail(`${filePath} exceeds the file cap`);
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
    ) fail(`${filePath} changed during read`);
    const reopened = lstatSync(filePath, { bigint: true });
    if (reopened.isSymbolicLink() || !reopened.isFile() || reopened.dev !== after.dev || reopened.ino !== after.ino) {
      fail(`${filePath} changed before reopen`);
    }
    assertDirectory(parentPath, parentBefore, `parent of ${filePath}`);
    const secondDescriptor = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const secondBefore = fstatSync(secondDescriptor, { bigint: true });
      if (!secondBefore.isFile() || !sameRegularMetadata(after, secondBefore)) fail(`${filePath} changed before second open`);
      const secondBytes = readFileSync(secondDescriptor);
      const secondAfter = fstatSync(secondDescriptor, { bigint: true });
      if (!sameRegularMetadata(secondBefore, secondAfter) || BigInt(secondBytes.length) !== secondAfter.size || !secondBytes.equals(bytes)) {
        fail(`${filePath} changed during second read`);
      }
      const secondReopen = lstatSync(filePath, { bigint: true });
      if (secondReopen.isSymbolicLink() || !secondReopen.isFile() || !sameRegularMetadata(secondAfter, secondReopen)) {
        fail(`${filePath} changed after second read`);
      }
      assertDirectory(parentPath, parentBefore, `parent of ${filePath}`);
      return Object.freeze({ bytes: secondBytes, mode: Number(secondAfter.mode & 0o777n), stats: secondAfter });
    } finally {
      closeSync(secondDescriptor);
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function readPinnedBlobs(root: string, entries: readonly PinnedEntry[]): ReadonlyMap<string, Buffer> {
  const input = Buffer.from(`${entries.map((entry) => entry.gitBlobHash).join("\n")}\n`, "ascii");
  const output = runGit(root, ["cat-file", "--batch"], [0], input).stdout;
  const blobs = new Map<string, Buffer>();
  let offset = 0;
  for (const entry of entries) {
    const newline = output.indexOf(0x0a, offset);
    if (newline < 0) fail("Git blob batch header is truncated");
    const match = /^([a-f0-9]{40}|[a-f0-9]{64}) blob ([0-9]+)$/.exec(output.subarray(offset, newline).toString("ascii"));
    if (!match || match[1] !== entry.gitBlobHash) fail("Git blob batch returned the wrong object");
    const size = Number(match[2]);
    if (!Number.isSafeInteger(size) || size > MAX_BUILD_FILE_BYTES_V1) fail("Pinned Git blob exceeds its cap");
    const start = newline + 1;
    const end = start + size;
    if (end >= output.length || output[end] !== 0x0a) fail("Git blob batch body is truncated");
    blobs.set(entry.gitBlobHash, Buffer.from(output.subarray(start, end)));
    offset = end + 1;
  }
  if (offset !== output.length) fail("Git blob batch emitted trailing bytes");
  return blobs;
}

function derivePinnedSet(root: string): PinnedSet {
  const sourceSha = gitLine(root, ["rev-parse", "--verify", "HEAD^{commit}"], "HEAD commit");
  const sourceTreeHash = gitLine(root, ["rev-parse", "--verify", "HEAD^{tree}"], "HEAD tree");
  if (!FULL_HASH.test(sourceSha) || !FULL_HASH.test(sourceTreeHash) || sourceSha.length !== sourceTreeHash.length) {
    fail("HEAD commit/tree hashes are invalid");
  }
  const listingBytes = runGit(root, ["ls-tree", "-r", "-z", "--full-tree", sourceSha]).stdout;
  const records = strictUtf8(listingBytes, "Git tree listing").split("\0");
  if (records.pop() !== "") fail("Git tree listing has no terminal NUL");
  if (records.length > MAX_BUILD_INPUT_ENTRIES_V1) fail("Pinned input set exceeds the entry cap");
  const entries = records.map((record): PinnedEntry => {
    const tab = record.indexOf("\t");
    const header = tab < 0 ? [] : record.slice(0, tab).split(" ");
    const locator = tab < 0 ? "" : canonicalLocator(record.slice(tab + 1));
    if (
      header.length !== 3
      || (header[0] !== "100644" && header[0] !== "100755")
      || header[1] !== "blob"
      || !FULL_HASH.test(header[2] ?? "")
    ) fail(`unsupported tracked Git entry ${record.slice(0, 200)}`);
    return Object.freeze({ locator, gitMode: header[0], gitBlobHash: header[2]! });
  }).sort((left, right) => compareBytes(left.locator, right.locator));
  const raw = new Set<string>();
  const folded = new Set<string>();
  for (const entry of entries) {
    const fold = entry.locator.normalize("NFC").toLocaleLowerCase("en-US");
    if (raw.has(entry.locator) || folded.has(fold)) fail(`colliding pinned locator ${entry.locator}`);
    raw.add(entry.locator);
    folded.add(fold);
  }
  const blobs = readPinnedBlobs(root, entries);
  let totalBytes = 0;
  for (const entry of entries) {
    totalBytes += blobs.get(entry.gitBlobHash)!.length;
    if (totalBytes > MAX_BUILD_TOTAL_BYTES_V1) fail("Pinned input set exceeds the total-byte cap");
  }
  const body = Object.freeze({
    schema: "setfarm.internal-production-pinned-build-input-set.v1" as const,
    sourceSha,
    sourceTreeHash,
    entries,
  });
  return Object.freeze({ ...body, buildInputSetHash: hashCanonicalJson(body), blobs });
}

function verifyLiveInputs(root: string, pinned: PinnedSet, device: bigint): void {
  for (const entry of pinned.entries) {
    const filePath = path.join(root, ...entry.locator.split("/"));
    if (!filePath.startsWith(`${root}${path.sep}`)) fail("Pinned input escaped the repository");
    const observed = readStableRegular(filePath, MAX_BUILD_FILE_BYTES_V1, device);
    const expectedMode = entry.gitMode === "100755" ? 0o755 : 0o644;
    if (observed.mode !== expectedMode) fail(`live tracked mode differs from pinned Git mode: ${entry.locator}`);
    if (!observed.bytes.equals(pinned.blobs.get(entry.gitBlobHash)!)) {
      fail(`live tracked bytes do not match pinned Git blob: ${entry.locator}`);
    }
  }
}

function pinnedJson(pinned: PinnedSet, locator: string): Record<string, unknown> {
  const entry = pinned.entries.find((candidate) => candidate.locator === locator);
  if (!entry) fail(`Pinned input lacks ${locator}`);
  let value: unknown;
  try {
    value = JSON.parse(strictUtf8(pinned.blobs.get(entry.gitBlobHash)!, locator));
  } catch {
    return fail(`${locator} is not strict JSON`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${locator} is not one object`);
  return value as Record<string, unknown>;
}

function verifyTopology(pinned: PinnedSet): string {
  const pkg = pinnedJson(pinned, "package.json");
  const scripts = pkg.scripts as Record<string, unknown> | undefined;
  for (const [name, expected] of Object.entries(EXACT_SCRIPTS)) {
    if (scripts?.[name] !== expected) fail(`package build topology differs at ${name}`);
  }
  if (typeof pkg.version !== "string" || pkg.version.length === 0) fail("package version is invalid");
  if (canonicalComparable(pinnedJson(pinned, "tsconfig.json")) !== canonicalComparable(EXACT_TSCONFIG)) {
    fail("tsconfig build topology differs");
  }
  const ignoreEntry = pinned.entries.find((entry) => entry.locator === ".gitignore");
  if (!ignoreEntry) fail("Pinned input lacks .gitignore");
  const ignoreText = strictUtf8(pinned.blobs.get(ignoreEntry.gitBlobHash)!, ".gitignore");
  if (ignoreText.split("\n").filter((line) => line === ".setfarm/").length !== 1) {
    fail(".gitignore must contain the exact .setfarm/ rule once");
  }
  const copyStepEntry = pinned.entries.find((entry) => entry.locator === "scripts/copy-step-assets.mjs");
  if (!copyStepEntry || copyStepEntry.gitMode !== "100755") fail("Pinned copy-step-assets source is missing or non-executable");
  const copyStepBytes = pinned.blobs.get(copyStepEntry.gitBlobHash)!;
  if (
    copyStepBytes.length !== COPY_STEP_ASSETS_SOURCE_BYTES_V1
    || sha256(copyStepBytes) !== COPY_STEP_ASSETS_SOURCE_SHA256_V1
  ) fail("copy-step-assets recursive Markdown topology semantic/source projection differs");
  return pkg.version;
}

function expectedTopology(pinned: PinnedSet): Readonly<{ outputs: readonly string[]; directories: readonly string[] }> {
  const outputs: string[] = [];
  for (const entry of pinned.entries) {
    const locator = entry.locator;
    if (locator.startsWith("src/") && locator.endsWith(".ts") && !/\.(?:d|m|c)\.ts$/.test(locator)) {
      outputs.push(`dist/${locator.slice(4, -3)}.js`);
    } else if (locator === "src/server/index.html" || locator === "src/installer/compat-rules.json") {
      outputs.push(`dist/${locator.slice(4)}`);
    } else if (/^src\/installer\/prompts\/[^/]+\.md$/.test(locator) || /^src\/installer\/steps\/.+\.md$/.test(locator)) {
      outputs.push(`dist/${locator.slice(4)}`);
    }
  }
  outputs.sort(compareBytes);
  const seen = new Set<string>();
  const folded = new Set<string>();
  for (const locator of outputs) {
    canonicalLocator(locator);
    const fold = locator.normalize("NFC").toLocaleLowerCase("en-US");
    if (seen.has(locator) || folded.has(fold)) fail(`colliding expected output ${locator}`);
    seen.add(locator);
    folded.add(fold);
  }
  if (!seen.has("dist/cli/cli.js")) fail("expected output topology lacks the CLI");
  const directories = new Set<string>();
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
  return Object.freeze({ outputs: Object.freeze(outputs), directories: Object.freeze([...directories].sort(compareBytes)) });
}

function observeSource(root: string): SourceObservation {
  const repository = directorySnapshot(root, "Setfarm repository");
  if ((repository.identity.mode & 0o022) !== 0) fail("Setfarm repository is group/world-writable");
  const topLevel = gitLine(root, ["rev-parse", "--show-toplevel"], "Git top-level");
  if (realpathSync(topLevel) !== root) fail("observer module root differs from Git top-level");
  const include = runGit(root, ["config", "--local", "--no-includes", "--name-only", "--get-regexp", "^include"], [0, 1]);
  if (include.status !== 1 || include.stdout.length !== 0) fail("local Git include/includeIf configuration is forbidden");
  const origin = runGit(root, ["config", "--local", "--no-includes", "--get-all", "remote.origin.url"]);
  if (!origin.stdout.equals(Buffer.from(CANONICAL_ORIGIN, "utf8"))) fail("canonical origin must have exactly one byte-identical value");
  if (gitLine(root, ["branch", "--show-current"], "current branch") !== "main") fail("current branch is not main");
  if (runGit(root, ["status", "--porcelain=v2", "--untracked-files=all"]).stdout.length !== 0) fail("current Setfarm worktree is dirty");
  const pinned = derivePinnedSet(root);
  const originMainSha = gitLine(root, ["rev-parse", "--verify", "refs/remotes/origin/main^{commit}"], "origin/main commit");
  if (originMainSha !== pinned.sourceSha) fail("HEAD does not equal origin/main");
  verifyLiveInputs(root, pinned, repository.device);
  const packageVersion = verifyTopology(pinned);
  const topology = expectedTopology(pinned);
  assertDirectory(root, repository, "Setfarm repository");
  return Object.freeze({ pinned, originMainSha, repository, packageVersion, ...topology });
}

function strictObject(
  bytes: Buffer,
  keys: readonly string[],
  label: string,
  pretty: boolean,
): Record<string, unknown> {
  const text = strictUtf8(bytes, label);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fail(`${label} is not JSON`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} is not one object`);
  const record = value as Record<string, unknown>;
  if (canonicalComparable(Object.keys(record)) !== canonicalComparable(keys)) fail(`${label} has unknown, missing, or reordered fields`);
  const exact = `${JSON.stringify(record, null, pretty ? 2 : undefined)}\n`;
  if (text !== exact) fail(`${label} raw bytes are not exact`);
  return record;
}

function expectedManifest(source: SourceObservation): Record<string, unknown> {
  const entry = source.pinned.entries.find((candidate) => candidate.locator === "scripts/stitch-to-jsx.mjs");
  if (!entry || entry.gitMode !== "100644") fail("Pinned Stitch converter is missing or executable");
  const bytes = source.pinned.blobs.get(entry.gitBlobHash)!;
  if (bytes.length < 1 || bytes.length > MAX_STITCH_CONVERTER_BYTES_V1) fail("Pinned Stitch converter has invalid size");
  strictUtf8(bytes, "Pinned Stitch converter");
  return {
    schema: "setfarm.platform-release-manifest.v1",
    releaseSha: source.pinned.sourceSha,
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
  };
}

function observeArtifacts(root: string, source: SourceObservation): Readonly<{
  buildInfo: Record<string, unknown>;
  outputTree: Record<string, unknown>;
  manifest: Record<string, unknown>;
  buildHash: string;
  bytes: readonly Buffer[];
  fileSnapshots: readonly FileSnapshot[];
  dist: DirectorySnapshot;
  directoryIdentities: readonly Readonly<{ locator: string; snapshot: DirectorySnapshot }>[];
}> {
  const distPath = path.join(root, "dist");
  const dist = directorySnapshot(distPath, "finalized dist", source.repository.device);
  if (dist.identity.mode !== 0o755) fail("finalized dist has wrong mode");
  let entryCount = 0;
  let totalBytes = 0;
  const files: string[] = [];
  const enumeratedFiles = new Map<string, StableRegular>();
  const directories: string[] = [];
  const directoryIdentities: Array<Readonly<{ locator: string; snapshot: DirectorySnapshot }>> = [];
  function visit(directoryPath: string, relative: string, depth: number): void {
    if (depth > MAX_BUILD_TREE_DEPTH_V1) fail("finalized dist exceeds depth cap");
    for (const name of readdirSync(directoryPath).sort(compareBytes)) {
      entryCount += 1;
      if (entryCount > MAX_BUILD_OUTPUT_ENTRIES_V1) fail("finalized dist exceeds entry cap");
      const locator = relative ? `${relative}/${name}` : `dist/${name}`;
      canonicalLocator(locator);
      const child = path.join(directoryPath, name);
      const stats = lstatSync(child, { bigint: true });
      if (stats.dev !== source.repository.device || stats.isSymbolicLink()) fail(`invalid finalized dist entry ${locator}`);
      if (stats.isDirectory()) {
        const identity = directorySnapshot(child, locator, source.repository.device);
        if (identity.identity.mode !== 0o755) fail(`wrong finalized directory mode ${locator}`);
        directories.push(locator);
        directoryIdentities.push(Object.freeze({ locator, snapshot: identity }));
        visit(child, locator, depth + 1);
      } else if (stats.isFile()) {
        if (stats.nlink !== 1n || stats.size > BigInt(MAX_BUILD_FILE_BYTES_V1)) fail(`invalid finalized file ${locator}`);
        const observed = readStableRegular(child, MAX_BUILD_FILE_BYTES_V1, source.repository.device);
        totalBytes += observed.bytes.length;
        if (totalBytes > MAX_BUILD_TOTAL_BYTES_V1) fail("finalized dist exceeds total-byte cap");
        files.push(locator);
        enumeratedFiles.set(locator, observed);
      } else fail(`special finalized dist entry ${locator}`);
    }
  }
  visit(distPath, "", 0);
  directories.sort(compareBytes);
  if (canonicalComparable(directories) !== canonicalComparable(source.directories)) fail("finalized directory topology is not exact");
  const expectedFiles = [...source.outputs, "dist/BUILD_INFO.json", "dist/PLATFORM_BUILD_OUTPUT_TREE.json", "dist/PLATFORM_RELEASE_MANIFEST.json"].sort(compareBytes);
  files.sort(compareBytes);
  if (canonicalComparable(files) !== canonicalComparable(expectedFiles)) fail("finalized file topology is not exact");

  const ordinarySnapshots: FileSnapshot[] = [];
  const outputEntries = source.outputs.map((locator) => {
    const observed = readStableRegular(path.join(root, ...locator.split("/")), MAX_BUILD_FILE_BYTES_V1, source.repository.device);
    const enumerated = enumeratedFiles.get(locator);
    if (!enumerated || !sameRegularMetadata(observed.stats, enumerated.stats) || !observed.bytes.equals(enumerated.bytes)) {
      fail(`ordinary output changed after enumeration ${locator}`);
    }
    const expectedMode = locator === "dist/cli/cli.js" ? 0o755 : 0o644;
    if (observed.mode !== expectedMode) fail(`wrong ordinary output mode ${locator}`);
    ordinarySnapshots.push(Object.freeze({ locator, observed }));
    return Object.freeze({ locator, mode: expectedMode, byteLength: observed.bytes.length, sha256: sha256(observed.bytes) });
  });

  const infoObserved = readStableRegular(path.join(distPath, "BUILD_INFO.json"), MAX_BUILD_FILE_BYTES_V1, source.repository.device);
  const enumeratedInfo = enumeratedFiles.get("dist/BUILD_INFO.json");
  if (!enumeratedInfo || !sameRegularMetadata(infoObserved.stats, enumeratedInfo.stats) || !infoObserved.bytes.equals(enumeratedInfo.bytes)) {
    fail("BUILD_INFO changed after enumeration");
  }
  if (infoObserved.mode !== 0o444) fail("BUILD_INFO has wrong mode");
  const buildInfo = strictObject(infoObserved.bytes, ["sha", "shortSha", "branch", "dirty", "packageVersion", "displayVersion", "builtAt"], "BUILD_INFO", true);
  if (
    buildInfo.sha !== source.pinned.sourceSha
    || buildInfo.shortSha !== source.pinned.sourceSha.slice(0, 8)
    || buildInfo.branch !== "main"
    || buildInfo.dirty !== false
    || buildInfo.packageVersion !== source.packageVersion
    || buildInfo.displayVersion !== `${source.packageVersion}+${source.pinned.sourceSha.slice(0, 8)}`
    || typeof buildInfo.builtAt !== "string"
    || !RFC3339_MILLIS.test(buildInfo.builtAt)
    || new Date(buildInfo.builtAt).toISOString() !== buildInfo.builtAt
  ) fail("BUILD_INFO fields are invalid");

  const outputObserved = readStableRegular(path.join(distPath, "PLATFORM_BUILD_OUTPUT_TREE.json"), MAX_BUILD_FILE_BYTES_V1, source.repository.device);
  const enumeratedOutputTree = enumeratedFiles.get("dist/PLATFORM_BUILD_OUTPUT_TREE.json");
  if (!enumeratedOutputTree || !sameRegularMetadata(outputObserved.stats, enumeratedOutputTree.stats) || !outputObserved.bytes.equals(enumeratedOutputTree.bytes)) {
    fail("output tree changed after enumeration");
  }
  if (outputObserved.mode !== 0o444) fail("output tree has wrong mode");
  const outputTree = strictObject(outputObserved.bytes, ["schema", "sourceSha", "sourceTreeHash", "entries", "outputTreeHash"], "output tree", false);
  if (
    outputTree.schema !== "setfarm.platform-build-output-tree.v1"
    || outputTree.sourceSha !== source.pinned.sourceSha
    || outputTree.sourceTreeHash !== source.pinned.sourceTreeHash
    || !Array.isArray(outputTree.entries)
    || canonicalComparable(outputTree.entries) !== canonicalComparable(outputEntries)
    || typeof outputTree.outputTreeHash !== "string"
    || !SHA256.test(outputTree.outputTreeHash)
  ) fail("output tree fields or entries are invalid");
  for (const entry of outputTree.entries) {
    if (
      !entry
      || typeof entry !== "object"
      || Array.isArray(entry)
      || canonicalComparable(Object.keys(entry as Record<string, unknown>))
        !== canonicalComparable(["locator", "mode", "byteLength", "sha256"])
    ) fail("output tree entry has unknown, missing, or reordered fields");
  }
  const outputProjection = {
    schema: outputTree.schema,
    sourceSha: outputTree.sourceSha,
    sourceTreeHash: outputTree.sourceTreeHash,
    entries: outputTree.entries,
  };
  if (outputTree.outputTreeHash !== hashCanonicalJson(outputProjection)) fail("output tree hash is invalid");

  const manifestObserved = readStableRegular(path.join(distPath, "PLATFORM_RELEASE_MANIFEST.json"), MAX_BUILD_FILE_BYTES_V1, source.repository.device);
  const enumeratedManifest = enumeratedFiles.get("dist/PLATFORM_RELEASE_MANIFEST.json");
  if (!enumeratedManifest || !sameRegularMetadata(manifestObserved.stats, enumeratedManifest.stats) || !manifestObserved.bytes.equals(enumeratedManifest.bytes)) {
    fail("release manifest changed after enumeration");
  }
  if (manifestObserved.mode !== 0o444) fail("release manifest has wrong mode");
  const manifest = strictObject(manifestObserved.bytes, ["schema", "releaseSha", "branch", "dirty", "stitchConverter"], "release manifest", false);
  const manifestCandidate = expectedManifest(source);
  const expectedManifestBytes = Buffer.from(`${JSON.stringify(manifestCandidate)}\n`, "utf8");
  if (!manifestObserved.bytes.equals(expectedManifestBytes) || canonicalComparable(manifest) !== canonicalComparable(manifestCandidate)) {
    fail("release manifest bytes differ from pinned source authority");
  }

  const stableBuildInfo = {
    schema: "setfarm.internal-production-stable-setfarm-build-info.v1",
    sha: buildInfo.sha,
    shortSha: buildInfo.shortSha,
    branch: buildInfo.branch,
    dirty: buildInfo.dirty,
    packageVersion: buildInfo.packageVersion,
    displayVersion: buildInfo.displayVersion,
  };
  const buildHash = hashCanonicalJson({
    schema: "setfarm.internal-production-controller-build.v1",
    stableBuildInfo,
    buildInputSetHash: source.pinned.buildInputSetHash,
    outputTreeHash: outputTree.outputTreeHash,
    releaseManifestHash: hashCanonicalJson(manifest),
  });
  const fileSnapshots = Object.freeze([
    ...ordinarySnapshots,
    Object.freeze({ locator: "dist/BUILD_INFO.json", observed: infoObserved }),
    Object.freeze({ locator: "dist/PLATFORM_BUILD_OUTPUT_TREE.json", observed: outputObserved }),
    Object.freeze({ locator: "dist/PLATFORM_RELEASE_MANIFEST.json", observed: manifestObserved }),
  ].sort((left, right) => compareBytes(left.locator, right.locator)));
  const stableTotalBytes = fileSnapshots.reduce((sum, snapshot) => sum + snapshot.observed.bytes.length, 0);
  if (stableTotalBytes !== totalBytes || stableTotalBytes > MAX_BUILD_TOTAL_BYTES_V1) {
    fail("finalized file totals changed across stable reads");
  }
  for (const item of directoryIdentities) {
    assertDirectory(path.join(root, ...item.locator.split("/")), item.snapshot, item.locator);
  }
  assertDirectory(distPath, dist, "finalized dist");
  return Object.freeze({
    buildInfo,
    outputTree,
    manifest,
    buildHash,
    bytes: Object.freeze([infoObserved.bytes, outputObserved.bytes, manifestObserved.bytes]),
    fileSnapshots,
    dist,
    directoryIdentities: Object.freeze(directoryIdentities),
  });
}

/** Observes only the code-relative current clean Setfarm checkout and build. */
export function observeCurrentInternalProductionCleanSetfarmSourceBuildV1(): InternalProductionCleanSetfarmSourceBuildV1 {
  const root = fixedRepositoryRoot();
  const before = observeSource(root);
  const artifactsBefore = observeArtifacts(root, before);
  const after = observeSource(root);
  if (
    after.pinned.sourceSha !== before.pinned.sourceSha
    || after.pinned.sourceTreeHash !== before.pinned.sourceTreeHash
    || after.pinned.buildInputSetHash !== before.pinned.buildInputSetHash
    || after.originMainSha !== before.originMainSha
  ) fail("source authority changed across artifact observation");
  const artifactsAfter = observeArtifacts(root, after);
  for (let index = 0; index < artifactsBefore.bytes.length; index += 1) {
    if (!artifactsBefore.bytes[index]!.equals(artifactsAfter.bytes[index]!)) fail("artifact authority changed across observation");
  }
  if (artifactsAfter.buildHash !== artifactsBefore.buildHash) fail("controller build hash changed across observation");
  if (artifactsBefore.fileSnapshots.length !== artifactsAfter.fileSnapshots.length) {
    fail("finalized file snapshots changed across observation");
  }
  for (let index = 0; index < artifactsBefore.fileSnapshots.length; index += 1) {
    const left = artifactsBefore.fileSnapshots[index]!;
    const right = artifactsAfter.fileSnapshots[index]!;
    if (
      left.locator !== right.locator
      || !sameRegularMetadata(left.observed.stats, right.observed.stats)
      || !left.observed.bytes.equals(right.observed.bytes)
    ) fail("finalized ordinary/authority file snapshots changed across observation");
  }
  if (artifactsBefore.directoryIdentities.length !== artifactsAfter.directoryIdentities.length) {
    fail("finalized directory identities changed across observation");
  }
  for (let index = 0; index < artifactsBefore.directoryIdentities.length; index += 1) {
    const left = artifactsBefore.directoryIdentities[index]!;
    const right = artifactsAfter.directoryIdentities[index]!;
    if (left.locator !== right.locator || !sameDirectory(left.snapshot.identity, right.snapshot.identity)) {
      fail("finalized directory identities changed across observation");
    }
  }
  assertDirectory(root, before.repository, "Setfarm repository");
  assertDirectory(path.join(root, "dist"), artifactsBefore.dist, "finalized dist");
  return Object.freeze({
    branch: "main",
    clean: true,
    sha: before.pinned.sourceSha,
    treeHash: before.pinned.sourceTreeHash,
    buildHash: artifactsBefore.buildHash,
    originMainSha: before.originMainSha,
  });
}

type Sha256V1 = string;
type CanonicalRefV1 = string;

export type InternalProductionAuthorityV3Migration31AuditPairV1 = Readonly<{
  authorityV3Migration31AuditRef: CanonicalRefV1;
  authorityV3Migration31AuditHash: Sha256V1;
}>;

export type InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1 = Readonly<{
  pendingBootstrapHandoffMigrationRef: CanonicalRefV1;
  pendingBootstrapHandoffMigrationHash: Sha256V1;
}>;

export type InternalProductionCurrentEntryOperationPairV1 = Readonly<{
  operationRef: CanonicalRefV1;
  operationHash: Sha256V1;
}>;

type CurrentAuthorityAuditV1 = Readonly<Record<string, unknown>>;
type Migration31AuditDataV1 = Readonly<Record<string, unknown>>;
type PendingSuccessorV1 = Readonly<Record<string, unknown>>;
type ProductBuildAuthorityObservationV1 = Readonly<{
  schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1";
  observationTransport: "source-cli";
  response: Readonly<Record<string, unknown>>;
}>;

export type InternalProductionAuthorityV3Migration31AuditV1 = Readonly<{
  schema: "setfarm.internal-production-authority-v3-migration31-audit.v1";
  currentStatus: "current";
  controllerSource: InternalProductionCleanSetfarmSourceBuildV1;
  pr86Delivery: Readonly<{
    pullRequestNumber: 86;
    mergeSha: "1d691c89760339ea905dfe17f8e9188e62603c1c";
    mergeTreeHash: "04f1d95a58360d06e866fe816138655efa916284";
    descendantSha: string;
    descendantTreeHash: string;
    expectedMergeBase: "1d691c89760339ea905dfe17f8e9188e62603c1c";
  }>;
  authorityV3ContractSpineThroughMigration31: Migration31AuditDataV1;
  currentAuthorityAudit: CurrentAuthorityAuditV1;
  currentAuthorityAuditHash: Sha256V1;
  migration31SemanticDigest: Sha256V1;
  migration31SourceManifestEntryHash: Sha256V1;
  authorityV3Migration31AuditRef: CanonicalRefV1;
  authorityV3Migration31AuditHash: Sha256V1;
}>;

export type InternalProductionPendingBootstrapHandoffMigrationProjectionV1 = Readonly<{
  schema: "setfarm.internal-production-pending-bootstrap-handoff-migration-projection.v1";
  currentStatus: "current";
  controllerSource: InternalProductionCleanSetfarmSourceBuildV1;
  pendingSuccessor: PendingSuccessorV1;
  migrationImplementation: Readonly<{
    locator: "src/db/bootstrap-main-claim-handoff-v1-migration.ts";
    gitMode: "100644";
    gitBlobHash: string;
  }>;
  pendingBootstrapHandoffMigrationRef: CanonicalRefV1;
  pendingBootstrapHandoffMigrationHash: Sha256V1;
}>;

export type InternalProductionCurrentEntryOperationV1 = Readonly<{
  schema: "setfarm.internal-production-current-entry-operation.v1";
  purpose: "task6a-internal-production-current-entry-v1";
  controllerSource: InternalProductionCleanSetfarmSourceBuildV1;
  productBuildAuthorityV2DeliveryEvidence: Readonly<{
    deliveryEvidenceRef: CanonicalRefV1;
    deliveryEvidenceHash: Sha256V1;
  }>;
  productBuildAuthorityV2Observation: ProductBuildAuthorityObservationV1;
  authorityV3Migration31Audit: InternalProductionAuthorityV3Migration31AuditPairV1;
  pendingBootstrapHandoffMigration: InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1;
  operationRef: CanonicalRefV1;
  operationHash: Sha256V1;
}>;

const CURRENT_ENTRY_STORE_DIRECTORY = "data/internal-production-baseline/current-entry-v1";
const CURRENT_ENTRY_MAX_BYTES = 1_048_576;
const PR86_SHA: "1d691c89760339ea905dfe17f8e9188e62603c1c" = "1d691c89760339ea905dfe17f8e9188e62603c1c";
const PR86_TREE: "04f1d95a58360d06e866fe816138655efa916284" = "04f1d95a58360d06e866fe816138655efa916284";
const V31_MIGRATION_IDENTITIES = Object.freeze([
  ["001_execution_attempts", "a48083e6d48d0072a36f255f02d05708606053edc38aa140dea8a58c7b48a32e"], ["002_run_protocol_identity", "993e11cff9a7e641c8de2e1c08d2591675df9ca18dfb78c304a37dd0e9d14ea4"], ["003_migration_release_attestation", "57e24f73ee6d3ce0272dae83893b1a7090fb9b80e476fe48d794ab22ee0fda8f"], ["004_compiler_preflight_identity", "09b9b471a27100baf58466ffd119b0780c259d525bd42dfe3177d069aab60b84"], ["005_claim_attempt_relational_binding", "96f89ef4277159b29835423a68ff35f94e1d56a3f98ec876e93a87ce295563b4"], ["006_durable_runtime_ownership", "7cec2991286163c7da8390d880635beebc362682ae391fdc22dd4dedb888b872"], ["007_manager_owned_completion", "acf77eb33c6854dcaa86c5b8bf2c80fd74db96985bb0ae497350a9d9d407696d"], ["008_runtime_completion_effect_ledger", "c312da49662daa1c96f0637142711bdc83eb9e901a6632121ab1a499c44f7aa2"], ["009_product_artifact_index", "400e0d5f5b8a9263590e3c9e03a2e7198cc969219ef664b753daed23be461f54"], ["010_finding_recovery_evidence_ledger", "f659f09b904de01d3d0a361ee5fcd8fb28e9ca916be4567ef146114b6a836114"], ["011_revisioned_recovery_delivery_ledger", "8397a861b8355b18781f44c89806a624bcf315656b6c1c9cc33b17648a5fd243"], ["012_canonical_operational_event_projection", "0339b0d90d9e2c5c2c0d81bbae51a622a113e68343cab3413bbdaf2ddbb02778"], ["013_accepted_candidate_ledger", "e3c4f5d3a46ece129be1961780afcb9d4d0a49e12c7868c5a3d754e3c2061616"], ["014_v3_deploy_receipt_ledger", "3d03d4401412ad68359bb8ae8041f5310ee4bbb7ecb534781be036191acfcc34"], ["015_v3_release_admission_ledger", "4a99286d68ab8711b092c1356778016af38bb83e552f11426cb4e59bfd078b33"], ["016_v3_preparation_block_ledger", "63b90ee3af285600e25f957cfd5fb0b183bcfca7384294c0e40622204561db70"], ["017_v3_github_review_resolution_evidence", "68ef6910f3b1b5c5237594e84560570a106f439be374d6fd84398db6fa94ec7e"], ["018_v3_project_transfer_ack_ledger", "3570c459ab60cf7bae539c6492097d9c03949ce1db407e79eefab6a31e8b2f83"], ["019_runtime_completion_submission_evidence", "bb707d9f15fa7ae95a2c3989ee06121c16d364ce5bdfaba923584153fb9bac22"], ["020_recovery_terminal_lease_identity", "d572e4832ad41bd748f46b361dd2787eb76cd7e1901501ccfa94d26186975c33"], ["021_operational_failure_cause_seal", "b7c6ad4a60d4f3203cf44ffd23a795284985e88d99761885632c8af66bdfc735"], ["022_product_compilation_attempt_ledger", "0bf46cc0dd468e6d9d47df76b289b98e0a7ae60072e99d64fdab7f43d0894646"], ["023_artifact_publication_batch_ledger", "11325a4362172f995607ca8494aeeac397c86d3310a26832b51f62245a1f17fe"], ["024_artifact_store_authority_ledger", "a1b1126a58a6c7b8d845e65cc958401a7f9be43df3c261e1b28ca6999f3e399e"], ["025_v3_preparation_authority_v2_ledger", "6342434911b27cd47eccae2408af1c3f7820bc431e00ece0ec46cca070ddb51d"], ["026_artifact_publication_batch_plan_ledger", "c60d91230dc5ff0704ce2dfef5134a94d91e6d63e3e34cfeb1998dfb897a0155"], ["027_platform_release_store_record_ledger_v3", "53fc69b28238b2bc27d092c2da620b653cbfee378b2d2808f2fd3e4c593eb1ff"], ["028_runtime_completion_manifest_authority", "6c759b27e39e1d482c6531c50475e48cabf1be12e539d81f795532c70b073de9"], ["029_v3_story_claim_runtime_binding_v1", "5d854397e305aa3bbacff85cee184b7db7566b8e2805ea2a7641273f2d018fcb"], ["030_operational_failure_cause_authority_v2", "ee9644b0c3fd20290902fb62d336e851d7b6f4e32e8956d6f07a52156a3c4dc1"], ["031_operational_failure_cause_authority_v3", "7fba6cf62e2201dc12e64175611e3a77fe780bc5af98a62f5f353281e075ab8f"],
] as const);
const PENDING_MIGRATION_32 = Object.freeze({
  checksum: "d152ec3d70de4221dc2a5bc79ccf46b4a6b89a3f5e8b966b8002a129d9e8c71d",
  migrationDigest: "8cbaab0c47bf3639033442d2df9a1c15d421eb34adbab72fa82951712cafe4e2",
  namedMigrationDigestEntryHash: "81d9164ca0f2c0be1cece391fc654a854c28ccfce905b87c3ad680202f95557c",
  orderedStatementsHash: "ccfcfdb6ed9e9d87add9e28394b2e67bf9ed55347841fe0529cdde4d6a5b34c9",
  expectedSchemaProjectionHash: "9f44b6312ba62fb7b48da153e70fa7f19ce543dbeec500b9111d750847a7eed1",
});
const CURRENT_ENTRY_FILES = Object.freeze({
  authorityV3Migration31Audit: "authority-v3-migration31-audit.json",
  pendingBootstrapHandoffMigration: "pending-bootstrap-handoff-migration.json",
  operation: "current-entry-operation.json",
});

function currentEntryFail(message: string): never {
  throw new Error(`INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:${message}`);
}

function isEnoent(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function recursivelyFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && "value" in descriptor) recursivelyFreeze(descriptor.value);
    }
    Object.freeze(value);
  }
  return value;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return canonicalComparable([...Object.keys(value)].sort(compareBytes)) === canonicalComparable([...keys].sort(compareBytes));
}

function requireSha256(value: unknown, label: string): Sha256V1 {
  if (typeof value !== "string" || !SHA256.test(value)) currentEntryFail(`${label} is not SHA-256`);
  return value;
}

function requireGitHash(value: unknown, label: string): string {
  if (typeof value !== "string" || !FULL_HASH.test(value)) currentEntryFail(`${label} is not a Git object hash`);
  return value;
}

function isNaturalNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function requirePair(
  value: unknown,
  refKey: string,
  hashKey: string,
  prefix: string,
): Readonly<Record<string, string>> {
  if (!isPlainRecord(value) || !hasExactKeys(value, [refKey, hashKey])) currentEntryFail(`${refKey} pair shape is invalid`);
  const hash = requireSha256(value[hashKey], hashKey);
  const ref = value[refKey];
  if (typeof ref !== "string" || ref !== `${prefix}${hash}`) currentEntryFail(`${refKey} does not match its hash`);
  return Object.freeze({ [refKey]: ref, [hashKey]: hash });
}

function requireSource(value: unknown): InternalProductionCleanSetfarmSourceBuildV1 {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["branch", "clean", "sha", "treeHash", "buildHash", "originMainSha"])) {
    currentEntryFail("controller source shape is invalid");
  }
  if (value.branch !== "main" || value.clean !== true) currentEntryFail("controller source is not clean main");
  const sha = requireGitHash(value.sha, "controller source SHA");
  const treeHash = requireGitHash(value.treeHash, "controller source tree");
  const buildHash = requireSha256(value.buildHash, "controller build hash");
  const originMainSha = requireGitHash(value.originMainSha, "controller origin/main SHA");
  if (sha !== originMainSha) currentEntryFail("controller source is not synchronized to origin/main");
  return Object.freeze({ branch: "main", clean: true, sha, treeHash, buildHash, originMainSha });
}

function requireMigrationPlanRecord(
  value: unknown,
  expectedVersion: number,
  expectedClass: "automatic" | "guarded",
  expectedStates: readonly string[],
  expectedName?: string,
): void {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["version", "name", "migrationClass", "checksum", "state"])) currentEntryFail("migration record shape is invalid");
  if (
    value.version !== expectedVersion
    || value.migrationClass !== expectedClass
    || !expectedStates.includes(value.state as string)
    || typeof value.name !== "string"
    || !/^[a-z0-9][a-z0-9._-]{0,254}$/.test(value.name)
    || (expectedName !== undefined && value.name !== expectedName)
  ) currentEntryFail(`migration ${expectedVersion} record is invalid`);
  requireSha256(value.checksum, `migration ${expectedVersion} checksum`);
}

function requireAuthorityV3Migration31Audit(value: unknown): void {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["schema", "status", "throughVersion", "migrations"])) currentEntryFail("v31 predecessor audit shape is invalid");
  if (value.schema !== "setfarm.authority-v3-contract-spine-through-migration-31-audit.v1" || value.status !== "verified" || value.throughVersion !== 31 || !Array.isArray(value.migrations) || value.migrations.length !== 31) currentEntryFail("v31 predecessor audit is invalid");
  for (let index = 0; index < value.migrations.length; index += 1) {
    const [name, checksum] = V31_MIGRATION_IDENTITIES[index]!;
    requireMigrationPlanRecord(value.migrations[index], index + 1, "automatic", ["applied", "adopted"], name);
    if ((value.migrations[index] as Record<string, unknown>).checksum !== checksum) currentEntryFail(`migration ${index + 1} checksum is invalid`);
  }
}

function requireCurrentAuthorityAudit(value: unknown): void {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["schema", "version", "scope", "status", "authorityState", "productionAuthority", "productionAdmission", "mutationAuthority", "storeAuthority", "restartAuthority", "trustConclusion", "artifactPublicationAuthorityLedger", "platformReleaseStoreRecordLedger", "v3StoryClaimRuntimeBinding"])) currentEntryFail("current-authority audit shape is invalid");
  if (
    value.schema !== "setfarm.contract-spine-current-authority-ledgers-audit.v2"
    || value.version !== "2.0.0"
    || value.scope !== "database-current-authority-ledgers-only"
    || value.status !== "verified"
    || value.authorityState !== "database_integrity_audit_only"
    || value.productionAuthority !== false
    || value.productionAdmission !== "forbidden"
    || value.mutationAuthority !== false
    || value.storeAuthority !== false
    || value.restartAuthority !== false
    || value.trustConclusion !== "characterization_only"
    || !isPlainRecord(value.artifactPublicationAuthorityLedger)
    || !isPlainRecord(value.platformReleaseStoreRecordLedger)
    || !isPlainRecord(value.v3StoryClaimRuntimeBinding)
  ) currentEntryFail("current-authority audit is invalid");
  const artifact = value.artifactPublicationAuthorityLedger;
  if (!hasExactKeys(artifact, ["schema", "scope", "status", "batchPlanCount", "authority"]) || artifact.schema !== "setfarm.artifact-publication-authority-ledger-audit.v2" || artifact.scope !== "database-ledger-only" || artifact.status !== "verified" || !isNaturalNumber(artifact.batchPlanCount)) currentEntryFail("current-authority artifact audit is invalid");
  if (artifact.authority !== null) {
    if (!isPlainRecord(artifact.authority) || !hasExactKeys(artifact.authority, ["authorityKey", "authoritySchema", "authorityId", "rootLocatorHash", "state", "diagnostic", "createdAt", "updatedAt"]) || typeof artifact.authority.authorityKey !== "string" || typeof artifact.authority.authoritySchema !== "string" || typeof artifact.authority.authorityId !== "string" || !SHA256.test(typeof artifact.authority.rootLocatorHash === "string" ? artifact.authority.rootLocatorHash : "") || !["binding", "ready", "quarantined"].includes(artifact.authority.state as string) || !(artifact.authority.diagnostic === null || typeof artifact.authority.diagnostic === "string") || typeof artifact.authority.createdAt !== "string" || typeof artifact.authority.updatedAt !== "string") currentEntryFail("current-authority artifact binding is invalid");
  }
  const platform = value.platformReleaseStoreRecordLedger;
  if (!hasExactKeys(platform, ["schema", "scope", "status", "authorityState", "productionAuthority", "productionAdmission", "mutationAuthority", "storeAuthority", "restartAuthority", "trustConclusion", "recordCount", "tailRecordHash", "tailPublishedCensusHash"]) || platform.schema !== "setfarm.platform-release-store-record-ledger-current-audit.v3" || platform.scope !== "database-record-integrity-only" || platform.status !== "integrity_verified" || platform.authorityState !== "database_record_integrity_audit_only" || platform.productionAuthority !== false || platform.productionAdmission !== "forbidden" || platform.mutationAuthority !== false || platform.storeAuthority !== false || platform.restartAuthority !== false || platform.trustConclusion !== "characterization_only" || !isNaturalNumber(platform.recordCount) || !(platform.tailRecordHash === null || SHA256.test(typeof platform.tailRecordHash === "string" ? platform.tailRecordHash : "")) || !(platform.tailPublishedCensusHash === null || SHA256.test(typeof platform.tailPublishedCensusHash === "string" ? platform.tailPublishedCensusHash : ""))) currentEntryFail("current-authority platform audit is invalid");
  const binding = value.v3StoryClaimRuntimeBinding;
  if (!hasExactKeys(binding, ["schema", "scope", "status", "authorityState", "productionAuthority", "productionAdmission", "mutationAuthority", "bindingCount", "requiredOwnerCount"]) || binding.schema !== "setfarm.v3-story-claim-runtime-binding-current-audit.v1" || binding.scope !== "database-binding-integrity-only" || binding.status !== "integrity_verified" || binding.authorityState !== "database_binding_integrity_audit_only" || binding.productionAuthority !== false || binding.productionAdmission !== "forbidden" || binding.mutationAuthority !== false || !isNaturalNumber(binding.bindingCount) || !isNaturalNumber(binding.requiredOwnerCount)) currentEntryFail("current-authority binding audit is invalid");
}

function requirePendingSuccessor(value: unknown): void {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["schema", "status", "migration", "migrationDigest", "namedMigrationDigestEntryHash", "orderedStatementsHash", "expectedSchemaProjectionHash"])) currentEntryFail("pending successor shape is invalid");
  if (value.schema !== "setfarm.pending-bootstrap-main-claim-handoff-guarded-successor.v1" || value.status !== "exact_pending_guarded_successor") currentEntryFail("pending successor is invalid");
  requireMigrationPlanRecord(value.migration, 32, "guarded", ["pending"], "contract-spine-bootstrap-main-claim-handoff-v1");
  if ((value.migration as Record<string, unknown>).checksum !== PENDING_MIGRATION_32.checksum) currentEntryFail("pending migration checksum is invalid");
  if (requireSha256(value.migrationDigest, "pending migration digest") !== PENDING_MIGRATION_32.migrationDigest) currentEntryFail("pending migration digest is invalid");
  if (requireSha256(value.namedMigrationDigestEntryHash, "pending named migration digest entry hash") !== PENDING_MIGRATION_32.namedMigrationDigestEntryHash) currentEntryFail("pending named migration digest entry hash is invalid");
  if (requireSha256(value.orderedStatementsHash, "pending ordered statements hash") !== PENDING_MIGRATION_32.orderedStatementsHash) currentEntryFail("pending ordered statements hash is invalid");
  if (requireSha256(value.expectedSchemaProjectionHash, "pending expected schema projection hash") !== PENDING_MIGRATION_32.expectedSchemaProjectionHash) currentEntryFail("pending expected schema projection hash is invalid");
}

type NoReplacePlannerV1 = (input: Readonly<{
  basename: string;
  candidateBytes: Buffer;
  entries: readonly Readonly<{
    name: string;
    bytes: Buffer;
    mode: number;
    linkCount: number;
    devDecimal: string;
    inoDecimal: string;
  }>[];
}>) => Readonly<{
  state: "block" | "resume" | "cleanup" | "adopt";
  fixedName: string | null;
  selectedTempName: string | null;
  cleanupTempNames: readonly string[];
  reason?: string;
  terminalState?: "resume" | "adopt";
}>;

type NoReplacePlanV1 = ReturnType<NoReplacePlannerV1>;

async function currentEntryPublisherPlannerV1(): Promise<NoReplacePlannerV1> {
  const url = new URL("../../scripts/build-generation-retention.mjs", import.meta.url).href;
  const loaded = await import(url) as Readonly<{ planNoReplacePublisherRecoveryV1?: unknown }>;
  if (typeof loaded.planNoReplacePublisherRecoveryV1 !== "function") currentEntryFail("shared no-replace planner is unavailable");
  return loaded.planNoReplacePublisherRecoveryV1 as NoReplacePlannerV1;
}

function ensureCurrentEntryStore(): Readonly<{ directory: string; device: bigint }> {
  const repository = directorySnapshot(fixedRepositoryRoot(), "Setfarm repository");
  const workspace = path.dirname(fixedRepositoryRoot());
  const workspaceSnapshot = directorySnapshot(workspace, "Setfarm workspace", repository.device);
  const segments = CURRENT_ENTRY_STORE_DIRECTORY.split("/");
  let directory = workspace;
  for (const segment of segments) {
    directory = path.join(directory, segment);
    try {
      mkdirSync(directory, { mode: 0o700 });
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
    }
    const observed = directorySnapshot(directory, `current-entry store ${segment}`, workspaceSnapshot.device);
    if (observed.identity.mode !== 0o700) currentEntryFail(`current-entry store ${segment} has wrong mode`);
  }
  return Object.freeze({ directory, device: workspaceSnapshot.device });
}

function readCurrentEntryStore(): Readonly<{ directory: string; device: bigint }>;
function readCurrentEntryStore(allowAbsent: true): Readonly<{ directory: string; device: bigint }> | null;
function readCurrentEntryStore(allowAbsent = false): Readonly<{ directory: string; device: bigint }> | null {
  const repository = directorySnapshot(fixedRepositoryRoot(), "Setfarm repository");
  const workspace = path.dirname(fixedRepositoryRoot());
  const workspaceSnapshot = directorySnapshot(workspace, "Setfarm workspace", repository.device);
  let directory = workspace;
  let parentDirectory = workspace;
  let parentSnapshot = workspaceSnapshot;
  for (const segment of CURRENT_ENTRY_STORE_DIRECTORY.split("/")) {
    directory = path.join(directory, segment);
    try {
      lstatSync(directory, { bigint: true });
    } catch (error) {
      if (!allowAbsent || !isEnoent(error)) throw error;
      assertDirectory(parentDirectory, parentSnapshot, `parent of absent current-entry store ${segment}`);
      try {
        lstatSync(directory, { bigint: true });
      } catch (reobservedError) {
        if (!isEnoent(reobservedError)) throw reobservedError;
        assertDirectory(parentDirectory, parentSnapshot, `parent of absent current-entry store ${segment}`);
        return null;
      }
      currentEntryFail(`absent current-entry store ${segment} appeared while observed`);
    }
    const observed = directorySnapshot(directory, `current-entry store ${segment}`, workspaceSnapshot.device);
    if (observed.identity.mode !== 0o700) currentEntryFail(`current-entry store ${segment} has wrong mode`);
    parentDirectory = directory;
    parentSnapshot = observed;
  }
  return Object.freeze({ directory, device: workspaceSnapshot.device });
}

function publisherEntry(
  directory: string,
  name: string,
  device: bigint,
): Readonly<{ name: string; bytes: Buffer; mode: number; linkCount: number; devDecimal: string; inoDecimal: string }> {
  const file = path.join(directory, name);
  const descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.dev !== device || (before.mode & 0o777n) !== 0o600n || ![1n, 2n].includes(before.nlink) || before.size > BigInt(CURRENT_ENTRY_MAX_BYTES)) {
      currentEntryFail(`publisher record ${name} has invalid identity`);
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (!sameRegularMetadata(before, after) || BigInt(bytes.length) !== after.size) currentEntryFail(`publisher record ${name} changed while read`);
    return Object.freeze({
      name,
      bytes,
      mode: 0o600,
      linkCount: Number(after.nlink),
      devDecimal: after.dev.toString(10),
      inoDecimal: after.ino.toString(10),
    });
  } finally {
    closeSync(descriptor);
  }
}

function readCurrentEntryRecord(directory: string, basename: string, device: bigint): Buffer {
  return readStableRegular(path.join(directory, basename), CURRENT_ENTRY_MAX_BYTES, device, 1).bytes;
}

function unlinkPlannedPublisherEntry(
  directory: string,
  expected: Readonly<{ name: string; bytes: Buffer; mode: number; linkCount: number; devDecimal: string; inoDecimal: string }>,
  device: bigint,
): void {
  const reopened = publisherEntry(directory, expected.name, device);
  if (
    reopened.mode !== expected.mode
    || reopened.linkCount !== expected.linkCount
    || reopened.devDecimal !== expected.devDecimal
    || reopened.inoDecimal !== expected.inoDecimal
    || !reopened.bytes.equals(expected.bytes)
  ) currentEntryFail(`publisher record ${expected.name} changed before cleanup`);
  unlinkSync(path.join(directory, expected.name));
  const directoryDescriptor = openSync(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    fsyncSync(directoryDescriptor);
  } finally {
    closeSync(directoryDescriptor);
  }
}

function fsyncCurrentEntryDirectory(directory: string): void {
  const descriptor = openSync(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function normalizeExistingCurrentEntryFamily(
  store: Readonly<{ directory: string; device: bigint }>,
  basename: string,
  bytes: Buffer,
  entries: readonly Readonly<{ name: string; bytes: Buffer; mode: number; linkCount: number; devDecimal: string; inoDecimal: string }>[],
  plan: NoReplacePlanV1,
): boolean {
  if (plan.state === "adopt") return false;
  if (plan.state === "block" || plan.fixedName !== basename) currentEntryFail(`publisher family ${basename} cannot normalize`);
  try {
    if (plan.state === "cleanup" && plan.selectedTempName === null) {
      for (const name of plan.cleanupTempNames) {
        const entry = entries.find((candidate) => candidate.name === name);
        if (!entry) currentEntryFail(`publisher family ${basename} cleanup member is absent`);
        unlinkPlannedPublisherEntry(store.directory, entry, store.device);
      }
      return plan.cleanupTempNames.length > 0;
    }
    const selected = plan.selectedTempName;
    if (!selected) currentEntryFail(`publisher family ${basename} recovery temp is absent`);
    const selectedEntry = entries.find((entry) => entry.name === selected);
    if (!selectedEntry || selectedEntry.linkCount !== 1) currentEntryFail(`publisher family ${basename} recovery temp is invalid`);
    linkSync(path.join(store.directory, selected), path.join(store.directory, basename));
    fsyncCurrentEntryDirectory(store.directory);
    const fixedAfterLink = publisherEntry(store.directory, basename, store.device);
    const selectedAfterLink = publisherEntry(store.directory, selected, store.device);
    if (
      fixedAfterLink.linkCount !== 2
      || selectedAfterLink.linkCount !== 2
      || fixedAfterLink.devDecimal !== selectedAfterLink.devDecimal
      || fixedAfterLink.inoDecimal !== selectedAfterLink.inoDecimal
      || !fixedAfterLink.bytes.equals(bytes)
      || !selectedAfterLink.bytes.equals(bytes)
    ) currentEntryFail(`publisher family ${basename} recovery link is invalid`);
    for (const name of [...plan.cleanupTempNames, selected]) {
      const entry = name === selected ? selectedAfterLink : entries.find((candidate) => candidate.name === name);
      if (!entry) currentEntryFail(`publisher family ${basename} cleanup member is absent`);
      unlinkPlannedPublisherEntry(store.directory, entry, store.device);
    }
    fsyncCurrentEntryDirectory(store.directory);
    const reopened = readCurrentEntryRecord(store.directory, basename, store.device);
    if (!reopened.equals(bytes)) currentEntryFail(`publisher family ${basename} did not normalize exactly`);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error.code === "EEXIST" || error.code === "ENOENT")) return true;
    throw error;
  }
}

async function publishCurrentEntryRecord(basename: string, bytes: Buffer): Promise<void> {
  if (bytes.length === 0 || bytes.length > CURRENT_ENTRY_MAX_BYTES) currentEntryFail("record bytes exceed the cap");
  const targetKind = (Object.entries(CURRENT_ENTRY_FILES) as readonly ["authorityV3Migration31Audit" | "pendingBootstrapHandoffMigration" | "operation", string][]).find(([, fixedName]) => fixedName === basename)?.[0];
  if (!targetKind) currentEntryFail("publisher target family is invalid");
  await validateCurrentEntryRecordBytes(targetKind, bytes);
  const store = ensureCurrentEntryStore();
  const planner = await currentEntryPublisherPlannerV1();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const tempPattern = new RegExp(`^\\.${basename.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.tmp$`);
    const families = (Object.entries(CURRENT_ENTRY_FILES) as readonly ["authorityV3Migration31Audit" | "pendingBootstrapHandoffMigration" | "operation", string][]).map(([kind, fixedName]) => Object.freeze({
      kind,
      fixedName,
      pattern: new RegExp(`^(?:${fixedName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}|\\.${fixedName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.tmp)$`),
    }));
    const inventory = readdirSync(store.directory).sort(compareBytes);
    if (inventory.some((name) => !families.some((family) => family.pattern.test(name)))) currentEntryFail("current-entry store has an unknown or foreign dirent");
    const familyStates = families.map((family) => {
      const entries = inventory.filter((name) => family.pattern.test(name)).map((name) => publisherEntry(store.directory, name, store.device));
      if (entries.length === 0) return Object.freeze({ family, entries, bytes: null, topology: null });
      const fixed = entries.find((entry) => entry.name === family.fixedName);
      const familyBytes = (fixed ?? entries[0]!).bytes;
      const topology = planner({ basename: family.fixedName, candidateBytes: familyBytes, entries });
      if (topology.state === "block" || topology.fixedName !== family.fixedName) currentEntryFail(`publisher family ${family.fixedName} has invalid topology: ${topology.reason ?? "invalid plan"}`);
      return Object.freeze({ family, entries, bytes: familyBytes, topology });
    });
    const invalidSoleTemps: Array<Readonly<{ name: string; bytes: Buffer; mode: number; linkCount: number; devDecimal: string; inoDecimal: string }>> = [];
    const parsedDependencies: Partial<{ v31Body: Record<string, unknown>; pendingBody: Record<string, unknown> }> = {};
    for (const state of familyStates.filter((candidate) => candidate.family.kind !== "operation")) {
      for (const entry of state.entries) {
        try {
          await validateCurrentEntryRecordBytes(state.family.kind, entry.bytes);
          if (state.family.kind === "authorityV3Migration31Audit") parsedDependencies.v31Body = strictCanonicalRecord(entry.bytes, "publisher v31 dependency");
          else parsedDependencies.pendingBody = strictCanonicalRecord(entry.bytes, "publisher pending dependency");
        } catch (error) {
          const invalidAuthenticatedSoleTemp = entry.name !== state.family.fixedName && state.entries.length === 1 && entry.linkCount === 1;
          if (!invalidAuthenticatedSoleTemp) throw error;
          invalidSoleTemps.push(entry);
        }
      }
    }
    const operationState = familyStates.find((state) => state.family.kind === "operation");
    if (operationState) {
      for (const entry of operationState.entries) {
        try {
          const dependencies = parsedDependencies.v31Body && parsedDependencies.pendingBody
            ? Object.freeze({ v31Body: parsedDependencies.v31Body, pendingBody: parsedDependencies.pendingBody })
            : undefined;
          await validateCurrentEntryRecordBytes("operation", entry.bytes, dependencies);
        } catch (error) {
          const invalidAuthenticatedSoleTemp = entry.name !== operationState.family.fixedName && operationState.entries.length === 1 && entry.linkCount === 1;
          if (!invalidAuthenticatedSoleTemp) throw error;
          invalidSoleTemps.push(entry);
        }
      }
    }
    if (invalidSoleTemps.length > 0) {
      for (const entry of invalidSoleTemps) unlinkPlannedPublisherEntry(store.directory, entry, store.device);
      continue;
    }
    let normalizedExistingFamily = false;
    for (const state of familyStates) {
      if (state.topology && state.bytes) {
        normalizedExistingFamily = normalizeExistingCurrentEntryFamily(store, state.family.fixedName, state.bytes, state.entries, state.topology) || normalizedExistingFamily;
      }
    }
    if (normalizedExistingFamily) continue;
    const names = inventory.filter((name) => name === basename || name.startsWith(`.${basename}.`));
    if (names.some((name) => name !== basename && !tempPattern.test(name))) currentEntryFail("unknown publisher-like dirent");
    const entries = names.map((name) => publisherEntry(store.directory, name, store.device));
    if (entries.length === 1 && entries[0]!.name !== basename && !entries[0]!.bytes.equals(bytes)) {
      unlinkPlannedPublisherEntry(store.directory, entries[0]!, store.device);
      continue;
    }
    const plan = planner({ basename, candidateBytes: bytes, entries });
    if (plan.state === "block" || plan.fixedName !== basename) currentEntryFail(`no-replace publisher blocked: ${plan.reason ?? "invalid plan"}`);
    if (plan.state === "adopt") {
      if (!readCurrentEntryRecord(store.directory, basename, store.device).equals(bytes)) currentEntryFail("existing immutable record differs");
      return;
    }
    if (plan.state === "cleanup" && plan.selectedTempName === null) {
      for (const name of plan.cleanupTempNames) {
        const entry = entries.find((candidate) => candidate.name === name);
        if (!entry) currentEntryFail("no-replace publisher cleanup record is absent");
        unlinkPlannedPublisherEntry(store.directory, entry, store.device);
      }
      continue;
    }
    let selected = plan.selectedTempName;
    if (!selected) {
      selected = `.${basename}.${randomUUID()}.tmp`;
      const descriptor = openSync(path.join(store.directory, selected), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
      try {
        writeFileSync(descriptor, bytes);
        fchmodSync(descriptor, 0o600);
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
    }
    const selectedPath = path.join(store.directory, selected);
    try {
      linkSync(selectedPath, path.join(store.directory, basename));
      const directoryDescriptor = openSync(store.directory, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        fsyncSync(directoryDescriptor);
      } finally {
        closeSync(directoryDescriptor);
      }
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST" || attempt === 3) throw error;
      continue;
    }
    const fixedAfterLink = publisherEntry(store.directory, basename, store.device);
    const selectedAfterLink = publisherEntry(store.directory, selected, store.device);
    if (
      fixedAfterLink.linkCount !== 2
      || selectedAfterLink.linkCount !== 2
      || fixedAfterLink.devDecimal !== selectedAfterLink.devDecimal
      || fixedAfterLink.inoDecimal !== selectedAfterLink.inoDecimal
      || !fixedAfterLink.bytes.equals(bytes)
      || !selectedAfterLink.bytes.equals(bytes)
    ) currentEntryFail("no-replace publisher link publication is not one authenticated inode pair");
    for (const name of [...plan.cleanupTempNames, selected]) {
      try {
        const entry = name === selected ? selectedAfterLink : entries.find((candidate) => candidate.name === name);
        if (!entry) currentEntryFail("no-replace publisher cleanup record is absent");
        unlinkPlannedPublisherEntry(
          store.directory,
          entry,
          store.device,
        );
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      }
    }
    const directoryDescriptor = openSync(store.directory, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      fsyncSync(directoryDescriptor);
    } finally {
      closeSync(directoryDescriptor);
    }
    if (!readCurrentEntryRecord(store.directory, basename, store.device).equals(bytes)) currentEntryFail("published record does not reopen exactly");
    return;
  }
  currentEntryFail("no-replace publication did not converge");
}

async function canonicalRecordBytes(value: unknown): Promise<Buffer> {
  const url = new URL("../../scripts/build-generation-retention.mjs", import.meta.url).href;
  const loaded = await import(url) as Readonly<{ canonicalJsonV1?: unknown }>;
  if (typeof loaded.canonicalJsonV1 !== "function") currentEntryFail("shared canonical JSON writer is unavailable");
  return Buffer.from(`${(loaded.canonicalJsonV1 as (input: unknown) => string)(value)}\n`, "utf8");
}

function strictCanonicalRecord(bytes: Buffer, label: string): Record<string, unknown> {
  if (bytes.length === 0 || bytes.length > CURRENT_ENTRY_MAX_BYTES) currentEntryFail(`${label} record size is invalid`);
  const text = strictUtf8(bytes, label);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    currentEntryFail(`${label} record is not JSON`);
  }
  if (!isPlainRecord(value) || text !== `${canonicalComparable(value)}\n`) currentEntryFail(`${label} record is not canonical JSON`);
  return value;
}

function fixedCurrentEntryPath(kind: "authorityV3Migration31Audit" | "pendingBootstrapHandoffMigration" | "operation"): Readonly<{ directory: string; basename: string; device: bigint }> {
  const store = readCurrentEntryStore();
  return Object.freeze({ ...store, basename: CURRENT_ENTRY_FILES[kind] });
}

async function validateStoredCurrentEntryFamily(kind: "authorityV3Migration31Audit" | "pendingBootstrapHandoffMigration" | "operation"): Promise<void> {
  const target = fixedCurrentEntryPath(kind);
  let body: Record<string, unknown>;
  try {
    body = strictCanonicalRecord(readCurrentEntryRecord(target.directory, target.basename, target.device), `stored ${kind}`);
  } catch (error) {
    if (isEnoent(error)) return;
    throw error;
  }
  if (kind === "authorityV3Migration31Audit") {
    await resolveInternalProductionAuthorityV3Migration31AuditV1(requirePair(Object.freeze({ authorityV3Migration31AuditRef: body.authorityV3Migration31AuditRef, authorityV3Migration31AuditHash: body.authorityV3Migration31AuditHash }), "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "setfarm://internal-production/authority-v3-migration31-audit/sha256/") as InternalProductionAuthorityV3Migration31AuditPairV1);
    return;
  }
  if (kind === "pendingBootstrapHandoffMigration") {
    await resolveInternalProductionPendingBootstrapHandoffMigrationV1(requirePair(Object.freeze({ pendingBootstrapHandoffMigrationRef: body.pendingBootstrapHandoffMigrationRef, pendingBootstrapHandoffMigrationHash: body.pendingBootstrapHandoffMigrationHash }), "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash", "setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/") as InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1);
    return;
  }
  await resolveInternalProductionCurrentEntryOperationV1(requirePair(Object.freeze({ operationRef: body.operationRef, operationHash: body.operationHash }), "operationRef", "operationHash", "setfarm://internal-production/current-entry-operation/sha256/") as InternalProductionCurrentEntryOperationPairV1);
}

async function validateCurrentEntryRecordBytes(
  kind: "authorityV3Migration31Audit" | "pendingBootstrapHandoffMigration" | "operation",
  bytes: Buffer,
  publisherDependencies?: Readonly<{ v31Body: Record<string, unknown>; pendingBody: Record<string, unknown> }>,
): Promise<void> {
  const body = strictCanonicalRecord(bytes, `current-entry ${kind}`);
  if (kind === "authorityV3Migration31Audit") {
    const expected = requirePair(Object.freeze({ authorityV3Migration31AuditRef: body.authorityV3Migration31AuditRef, authorityV3Migration31AuditHash: body.authorityV3Migration31AuditHash }), "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "setfarm://internal-production/authority-v3-migration31-audit/sha256/");
    await parseAuthorityV3Migration31AuditBody(body, expected);
    return;
  }
  if (kind === "pendingBootstrapHandoffMigration") {
    const expected = requirePair(Object.freeze({ pendingBootstrapHandoffMigrationRef: body.pendingBootstrapHandoffMigrationRef, pendingBootstrapHandoffMigrationHash: body.pendingBootstrapHandoffMigrationHash }), "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash", "setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/");
    parsePendingBootstrapHandoffMigrationBody(body, expected);
    return;
  }
  const expected = requirePair(Object.freeze({ operationRef: body.operationRef, operationHash: body.operationHash }), "operationRef", "operationHash", "setfarm://internal-production/current-entry-operation/sha256/");
  await parseCurrentEntryOperationBody(body, expected, true, publisherDependencies);
}

function v31Pair(value: InternalProductionAuthorityV3Migration31AuditV1): InternalProductionAuthorityV3Migration31AuditPairV1 {
  return Object.freeze({ authorityV3Migration31AuditRef: value.authorityV3Migration31AuditRef, authorityV3Migration31AuditHash: value.authorityV3Migration31AuditHash });
}

function pendingPair(value: InternalProductionPendingBootstrapHandoffMigrationProjectionV1): InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1 {
  return Object.freeze({ pendingBootstrapHandoffMigrationRef: value.pendingBootstrapHandoffMigrationRef, pendingBootstrapHandoffMigrationHash: value.pendingBootstrapHandoffMigrationHash });
}

function operationPair(value: InternalProductionCurrentEntryOperationV1): InternalProductionCurrentEntryOperationPairV1 {
  return Object.freeze({ operationRef: value.operationRef, operationHash: value.operationHash });
}

function migrationImplementationEntry(source: InternalProductionCleanSetfarmSourceBuildV1): Readonly<{ locator: "src/db/bootstrap-main-claim-handoff-v1-migration.ts"; gitMode: "100644"; gitBlobHash: string }> {
  const root = fixedRepositoryRoot();
  const text = gitLine(root, ["ls-tree", source.sha, "--", "src/db/bootstrap-main-claim-handoff-v1-migration.ts"], "migration implementation Git entry");
  const match = /^100644 blob ((?:[a-f0-9]{40}|[a-f0-9]{64}))\tsrc\/db\/bootstrap-main-claim-handoff-v1-migration\.ts$/.exec(text);
  if (!match) currentEntryFail("migration implementation Git entry is invalid");
  return Object.freeze({ locator: "src/db/bootstrap-main-claim-handoff-v1-migration.ts", gitMode: "100644", gitBlobHash: match[1]! });
}

async function migration31Digests(): Promise<Readonly<{ semanticDigest: Sha256V1; sourceManifestEntryHash: Sha256V1 }>> {
  const digests = await import("../db/contract-spine-migration-digests.generated.js") as unknown as Readonly<{
    CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS: Readonly<Record<number, string>>;
  }>;
  const sourceIntegrity = await import("../db/contract-spine-migration-source-integrity.js") as unknown as Readonly<{
    CONTRACT_SPINE_SEMANTIC_MIGRATION_SOURCE_MANIFEST: Readonly<Record<number, unknown>>;
  }>;
  return Object.freeze({
    semanticDigest: requireSha256(digests.CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[31], "migration 31 semantic digest"),
    sourceManifestEntryHash: requireSha256(hashCanonicalJson(sourceIntegrity.CONTRACT_SPINE_SEMANTIC_MIGRATION_SOURCE_MANIFEST[31]), "migration 31 source-manifest entry hash"),
  });
}

export async function observeCurrentInternalProductionAuthorityV3Migration31AuditV1(): Promise<InternalProductionAuthorityV3Migration31AuditV1> {
  const ports = await import("../db-pg.js") as Readonly<{
    auditCurrentInternalProductionAuthorityV3Migration31V1?: () => Promise<Readonly<{ authorityV3ContractSpineThroughMigration31: Migration31AuditDataV1; currentAuthorityAudit: CurrentAuthorityAuditV1 }>>;
  }>;
  if (typeof ports.auditCurrentInternalProductionAuthorityV3Migration31V1 !== "function") currentEntryFail("current v31 database port is unavailable");
  const controllerSource = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  const observed = await ports.auditCurrentInternalProductionAuthorityV3Migration31V1();
  const digests = await migration31Digests();
  const body = {
    schema: "setfarm.internal-production-authority-v3-migration31-audit.v1" as const,
    currentStatus: "current" as const,
    controllerSource,
    pr86Delivery: Object.freeze({
      pullRequestNumber: 86 as const,
      mergeSha: PR86_SHA,
      mergeTreeHash: PR86_TREE,
      descendantSha: controllerSource.sha,
      descendantTreeHash: controllerSource.treeHash,
      expectedMergeBase: PR86_SHA,
    }),
    authorityV3ContractSpineThroughMigration31: observed.authorityV3ContractSpineThroughMigration31,
    currentAuthorityAudit: observed.currentAuthorityAudit,
    currentAuthorityAuditHash: hashCanonicalJson(observed.currentAuthorityAudit),
    migration31SemanticDigest: digests.semanticDigest,
    migration31SourceManifestEntryHash: digests.sourceManifestEntryHash,
  };
  const authorityV3Migration31AuditHash = hashCanonicalJson(body);
  const value: InternalProductionAuthorityV3Migration31AuditV1 = Object.freeze({
    ...body,
    authorityV3Migration31AuditRef: `setfarm://internal-production/authority-v3-migration31-audit/sha256/${authorityV3Migration31AuditHash}`,
    authorityV3Migration31AuditHash,
  });
  await publishCurrentEntryRecord(CURRENT_ENTRY_FILES.authorityV3Migration31Audit, await canonicalRecordBytes(value));
  return resolveInternalProductionAuthorityV3Migration31AuditV1(v31Pair(value));
}

export async function observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1(): Promise<InternalProductionPendingBootstrapHandoffMigrationProjectionV1> {
  const ports = await import("../db-pg.js") as Readonly<{
    inspectCurrentInternalProductionPendingBootstrapHandoffMigrationV1?: () => Promise<PendingSuccessorV1>;
  }>;
  if (typeof ports.inspectCurrentInternalProductionPendingBootstrapHandoffMigrationV1 !== "function") currentEntryFail("current pending database port is unavailable");
  const controllerSource = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  const pendingSuccessor = await ports.inspectCurrentInternalProductionPendingBootstrapHandoffMigrationV1();
  const body = {
    schema: "setfarm.internal-production-pending-bootstrap-handoff-migration-projection.v1" as const,
    currentStatus: "current" as const,
    controllerSource,
    pendingSuccessor,
    migrationImplementation: migrationImplementationEntry(controllerSource),
  };
  const pendingBootstrapHandoffMigrationHash = hashCanonicalJson(body);
  const value: InternalProductionPendingBootstrapHandoffMigrationProjectionV1 = Object.freeze({
    ...body,
    pendingBootstrapHandoffMigrationRef: `setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/${pendingBootstrapHandoffMigrationHash}`,
    pendingBootstrapHandoffMigrationHash,
  });
  await publishCurrentEntryRecord(CURRENT_ENTRY_FILES.pendingBootstrapHandoffMigration, await canonicalRecordBytes(value));
  return resolveInternalProductionPendingBootstrapHandoffMigrationV1(pendingPair(value));
}

export async function resolveInternalProductionAuthorityV3Migration31AuditV1(
  pair: InternalProductionAuthorityV3Migration31AuditPairV1,
): Promise<InternalProductionAuthorityV3Migration31AuditV1> {
  const expected = requirePair(pair, "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "setfarm://internal-production/authority-v3-migration31-audit/sha256/");
  const target = fixedCurrentEntryPath("authorityV3Migration31Audit");
  const body = strictCanonicalRecord(readCurrentEntryRecord(target.directory, target.basename, target.device), "v31 audit");
  return parseAuthorityV3Migration31AuditBody(body, expected);
}

async function parseAuthorityV3Migration31AuditBody(
  body: Record<string, unknown>,
  expected: Readonly<Record<string, string>>,
): Promise<InternalProductionAuthorityV3Migration31AuditV1> {
  if (!hasExactKeys(body, ["schema", "currentStatus", "controllerSource", "pr86Delivery", "authorityV3ContractSpineThroughMigration31", "currentAuthorityAudit", "currentAuthorityAuditHash", "migration31SemanticDigest", "migration31SourceManifestEntryHash", "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash"])) currentEntryFail("v31 audit fields are invalid");
  if (body.schema !== "setfarm.internal-production-authority-v3-migration31-audit.v1" || body.currentStatus !== "current") currentEntryFail("v31 audit discriminator is invalid");
  const projection = { ...body };
  delete projection.authorityV3Migration31AuditRef;
  delete projection.authorityV3Migration31AuditHash;
  const hash = requireSha256(body.authorityV3Migration31AuditHash, "v31 audit hash");
  if (hashCanonicalJson(projection) !== hash || body.authorityV3Migration31AuditRef !== `setfarm://internal-production/authority-v3-migration31-audit/sha256/${hash}` || expected.authorityV3Migration31AuditHash !== hash || expected.authorityV3Migration31AuditRef !== body.authorityV3Migration31AuditRef) currentEntryFail("v31 audit pair/hash is invalid");
  const controllerSource = requireSource(body.controllerSource);
  if (!isPlainRecord(body.pr86Delivery) || !hasExactKeys(body.pr86Delivery, ["pullRequestNumber", "mergeSha", "mergeTreeHash", "descendantSha", "descendantTreeHash", "expectedMergeBase"]) || body.pr86Delivery.pullRequestNumber !== 86 || body.pr86Delivery.mergeSha !== PR86_SHA || body.pr86Delivery.mergeTreeHash !== PR86_TREE || body.pr86Delivery.expectedMergeBase !== PR86_SHA || body.pr86Delivery.descendantSha !== controllerSource.sha || body.pr86Delivery.descendantTreeHash !== controllerSource.treeHash) currentEntryFail("v31 audit PR86 binding is invalid");
  requireAuthorityV3Migration31Audit(body.authorityV3ContractSpineThroughMigration31);
  requireCurrentAuthorityAudit(body.currentAuthorityAudit);
  if (body.currentAuthorityAuditHash !== hashCanonicalJson(body.currentAuthorityAudit)) currentEntryFail("v31 current-authority audit hash is invalid");
  const migration31SemanticDigest = requireSha256(body.migration31SemanticDigest, "migration 31 semantic digest");
  const migration31SourceManifestEntryHash = requireSha256(body.migration31SourceManifestEntryHash, "migration 31 source-manifest entry hash");
  const expectedDigests = await migration31Digests();
  if (migration31SemanticDigest !== expectedDigests.semanticDigest || migration31SourceManifestEntryHash !== expectedDigests.sourceManifestEntryHash) currentEntryFail("v31 migration digest binding is invalid");
  const replay = await import("../execution/v3-git-revision.js") as unknown as Readonly<{ replayV3HistoricalGitCommitAncestryV1?: (input: Readonly<{
    repo: string;
    ancestorSha: string;
    descendantSha: string;
    expectedAncestorTreeHash: string;
    expectedDescendantTreeHash: string;
    expectedMergeBase: string;
  }>) => unknown }>;
  if (typeof replay.replayV3HistoricalGitCommitAncestryV1 !== "function") currentEntryFail("historical Git replay is unavailable");
  replay.replayV3HistoricalGitCommitAncestryV1({ repo: fixedRepositoryRoot(), ancestorSha: PR86_SHA, descendantSha: controllerSource.sha, expectedAncestorTreeHash: PR86_TREE, expectedDescendantTreeHash: controllerSource.treeHash, expectedMergeBase: PR86_SHA });
  return Object.freeze(body as unknown as InternalProductionAuthorityV3Migration31AuditV1);
}

export async function resolveInternalProductionPendingBootstrapHandoffMigrationV1(
  pair: InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1,
): Promise<InternalProductionPendingBootstrapHandoffMigrationProjectionV1> {
  const expected = requirePair(pair, "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash", "setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/");
  const target = fixedCurrentEntryPath("pendingBootstrapHandoffMigration");
  const body = strictCanonicalRecord(readCurrentEntryRecord(target.directory, target.basename, target.device), "pending migration");
  return parsePendingBootstrapHandoffMigrationBody(body, expected);
}

function parsePendingBootstrapHandoffMigrationBody(
  body: Record<string, unknown>,
  expected: Readonly<Record<string, string>>,
): InternalProductionPendingBootstrapHandoffMigrationProjectionV1 {
  if (!hasExactKeys(body, ["schema", "currentStatus", "controllerSource", "pendingSuccessor", "migrationImplementation", "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash"])) currentEntryFail("pending migration fields are invalid");
  if (body.schema !== "setfarm.internal-production-pending-bootstrap-handoff-migration-projection.v1" || body.currentStatus !== "current") currentEntryFail("pending migration discriminator is invalid");
  const projection = { ...body };
  delete projection.pendingBootstrapHandoffMigrationRef;
  delete projection.pendingBootstrapHandoffMigrationHash;
  const hash = requireSha256(body.pendingBootstrapHandoffMigrationHash, "pending migration hash");
  if (hashCanonicalJson(projection) !== hash || body.pendingBootstrapHandoffMigrationRef !== `setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/${hash}` || expected.pendingBootstrapHandoffMigrationHash !== hash || expected.pendingBootstrapHandoffMigrationRef !== body.pendingBootstrapHandoffMigrationRef) currentEntryFail("pending migration pair/hash is invalid");
  const controllerSource = requireSource(body.controllerSource);
  requirePendingSuccessor(body.pendingSuccessor);
  if (!isPlainRecord(body.migrationImplementation) || !hasExactKeys(body.migrationImplementation, ["locator", "gitMode", "gitBlobHash"]) || body.migrationImplementation.locator !== "src/db/bootstrap-main-claim-handoff-v1-migration.ts" || body.migrationImplementation.gitMode !== "100644") currentEntryFail("pending migration implementation is invalid");
  const implementationBlob = requireGitHash(body.migrationImplementation.gitBlobHash, "pending migration Git blob");
  if (migrationImplementationEntry(controllerSource).gitBlobHash !== implementationBlob) currentEntryFail("pending migration implementation does not match stored controller source");
  return Object.freeze(body as unknown as InternalProductionPendingBootstrapHandoffMigrationProjectionV1);
}

async function observeCurrentPba(): Promise<ProductBuildAuthorityObservationV1> {
  const pba = await import("./product-build-authority-v2-delivery-evidence-v1.js") as Readonly<{
    observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1?: () => Promise<ProductBuildAuthorityObservationV1>;
    parseProductBuildAuthorityV2DeliveryEvidenceResponseV1?: (value: unknown) => Readonly<Record<string, unknown>>;
  }>;
  if (typeof pba.observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1 !== "function" || typeof pba.parseProductBuildAuthorityV2DeliveryEvidenceResponseV1 !== "function") currentEntryFail("current PBA observer is unavailable");
  const observation = await pba.observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1();
  if (!isPlainRecord(observation) || !hasExactKeys(observation, ["schema", "observationTransport", "response"]) || observation.schema !== "setfarm.product-build-authority-v2-delivery-evidence-observation.v1" || observation.observationTransport !== "source-cli" || canonicalComparable(observation.response) !== canonicalComparable(pba.parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(observation.response))) currentEntryFail("current PBA observation is invalid");
  pbaPair(observation);
  return observation;
}

function pbaPair(observation: ProductBuildAuthorityObservationV1): Readonly<{ deliveryEvidenceRef: CanonicalRefV1; deliveryEvidenceHash: Sha256V1 }> {
  if (!isPlainRecord(observation.response) || !hasExactKeys(observation.response, ["schema", "currentStatus", "deliveryEvidenceRef", "deliveryEvidenceHash", "evidence"]) || observation.response.schema !== "mission-control.product-build-authority-v2-delivery-evidence-response.v1" || observation.response.currentStatus !== "current" || !isPlainRecord(observation.response.evidence)) currentEntryFail("PBA response is invalid");
  const ref = observation.response.deliveryEvidenceRef;
  const hash = observation.response.deliveryEvidenceHash;
  const evidence = observation.response.evidence;
  const evidenceProjection = { ...evidence };
  delete evidenceProjection.deliveryEvidenceRef;
  delete evidenceProjection.deliveryEvidenceHash;
  if (
    typeof ref !== "string"
    || !SHA256.test(typeof hash === "string" ? hash : "")
    || ref !== `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${hash}`
    || evidence.deliveryEvidenceRef !== ref
    || evidence.deliveryEvidenceHash !== hash
    || hashCanonicalJson(evidenceProjection) !== hash
  ) currentEntryFail("PBA pair/body is crossed");
  return Object.freeze({ deliveryEvidenceRef: ref, deliveryEvidenceHash: hash as string });
}

/** Reads an already prepared immutable operation without publishing or recovering state. */
export async function observePreparedInternalProductionCurrentEntryOperationV1(): Promise<
  InternalProductionCurrentEntryOperationV1 | null
> {
  const store = readCurrentEntryStore(true);
  if (store === null) return null;
  const storeBefore = directorySnapshot(store.directory, "prepared current-entry store", store.device);
  const allowed = new Set<string>(Object.values(CURRENT_ENTRY_FILES));
  const entries = readdirSync(store.directory).sort(compareBytes);
  if (entries.length > allowed.size || entries.some((entry) => !allowed.has(entry))) {
    currentEntryFail("prepared current-entry inventory is invalid");
  }
  const firstSnapshots = new Map<string, StableRegular>();
  for (const entry of entries) {
    const observed = readStableRegular(
      path.join(store.directory, entry),
      CURRENT_ENTRY_MAX_BYTES,
      store.device,
      1,
    );
    if (observed.mode !== 0o600 || observed.bytes.length < 1) {
      currentEntryFail(`prepared current-entry member ${entry} is invalid`);
    }
    firstSnapshots.set(entry, observed);
  }
  assertDirectory(store.directory, storeBefore, "prepared current-entry store");
  let operation: InternalProductionCurrentEntryOperationV1 | null = null;
  if (!entries.includes(CURRENT_ENTRY_FILES.operation)) {
    for (const kind of ["authorityV3Migration31Audit", "pendingBootstrapHandoffMigration"] as const) {
      const snapshot = firstSnapshots.get(CURRENT_ENTRY_FILES[kind]);
      if (snapshot) await validateCurrentEntryRecordBytes(kind, snapshot.bytes);
    }
  } else {
    const operationSnapshot = firstSnapshots.get(CURRENT_ENTRY_FILES.operation);
    if (!operationSnapshot) currentEntryFail("prepared current-entry operation snapshot is absent");
    const body = strictCanonicalRecord(operationSnapshot.bytes, "prepared current-entry operation");
    const pair = requirePair(
      { operationRef: body.operationRef, operationHash: body.operationHash },
      "operationRef",
      "operationHash",
      "setfarm://internal-production/current-entry-operation/sha256/",
    ) as InternalProductionCurrentEntryOperationPairV1;
    const v31Snapshot = firstSnapshots.get(CURRENT_ENTRY_FILES.authorityV3Migration31Audit);
    const pendingSnapshot = firstSnapshots.get(CURRENT_ENTRY_FILES.pendingBootstrapHandoffMigration);
    if (!v31Snapshot || !pendingSnapshot) currentEntryFail("prepared current-entry operation dependencies are absent");
    operation = await parseCurrentEntryOperationBody(body, pair, true, {
      v31Body: strictCanonicalRecord(v31Snapshot.bytes, "prepared v31 audit"),
      pendingBody: strictCanonicalRecord(pendingSnapshot.bytes, "prepared pending migration"),
    });
  }
  const finalEntries = readdirSync(store.directory).sort(compareBytes);
  assertDirectory(store.directory, storeBefore, "prepared current-entry store");
  if (canonicalComparable(entries) !== canonicalComparable(finalEntries)) currentEntryFail("prepared current-entry inventory changed while observed");
  for (const entry of entries) {
    const first = firstSnapshots.get(entry)!;
    const final = readStableRegular(path.join(store.directory, entry), CURRENT_ENTRY_MAX_BYTES, store.device, 1);
    if (final.mode !== 0o600 || !sameRegularMetadata(first.stats, final.stats) || !first.bytes.equals(final.bytes)) {
      currentEntryFail(`prepared current-entry member ${entry} changed after validation`);
    }
  }
  assertDirectory(store.directory, storeBefore, "prepared current-entry store");
  return operation;
}

export async function prepareInternalProductionCurrentEntryOperationV1(): Promise<InternalProductionCurrentEntryOperationV1> {
  try {
    const store = readCurrentEntryStore();
    const target = Object.freeze({ ...store, basename: CURRENT_ENTRY_FILES.operation });
    const existing = strictCanonicalRecord(readCurrentEntryRecord(target.directory, target.basename, target.device), "current-entry operation");
    const existingPair = Object.freeze({ operationRef: existing.operationRef, operationHash: existing.operationHash });
    return resolveInternalProductionCurrentEntryOperationV1(
      requirePair(existingPair, "operationRef", "operationHash", "setfarm://internal-production/current-entry-operation/sha256/") as InternalProductionCurrentEntryOperationPairV1,
    );
  } catch (error) {
    if (!isEnoent(error)) throw error;
  }
  const s0 = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  const pba0 = await observeCurrentPba();
  const v31 = await observeCurrentInternalProductionAuthorityV3Migration31AuditV1();
  const pending = await observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1();
  const s1 = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  const pba1 = await observeCurrentPba();
  const v31Again = await observeCurrentInternalProductionAuthorityV3Migration31AuditV1();
  const pendingAgain = await observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1();
  if (
    canonicalComparable(s0) !== canonicalComparable(s1)
    || canonicalComparable(pba0) !== canonicalComparable(pba1)
    || canonicalComparable(v31) !== canonicalComparable(v31Again)
    || canonicalComparable(pending) !== canonicalComparable(pendingAgain)
    || canonicalComparable(v31.controllerSource) !== canonicalComparable(s0)
    || canonicalComparable(pending.controllerSource) !== canonicalComparable(s0)
  ) currentEntryFail("current-entry prerequisites changed before publication");
  const body = {
    schema: "setfarm.internal-production-current-entry-operation.v1" as const,
    purpose: "task6a-internal-production-current-entry-v1" as const,
    controllerSource: s0,
    productBuildAuthorityV2DeliveryEvidence: pbaPair(pba0),
    productBuildAuthorityV2Observation: pba0,
    authorityV3Migration31Audit: v31Pair(v31),
    pendingBootstrapHandoffMigration: pendingPair(pending),
  };
  const operationHash = hashCanonicalJson(body);
  const value: InternalProductionCurrentEntryOperationV1 = Object.freeze({ ...body, operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash });
  await publishCurrentEntryRecord(CURRENT_ENTRY_FILES.operation, await canonicalRecordBytes(value));
  const resolved = await resolveInternalProductionCurrentEntryOperationV1(operationPair(value));
  const finalV31 = await observeCurrentInternalProductionAuthorityV3Migration31AuditV1();
  const finalPending = await observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1();
  const finalSource = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  const finalPba = await observeCurrentPba();
  if (canonicalComparable(finalSource) !== canonicalComparable(s0) || canonicalComparable(finalPba) !== canonicalComparable(pba0) || canonicalComparable(v31Pair(finalV31)) !== canonicalComparable(v31Pair(v31)) || canonicalComparable(pendingPair(finalPending)) !== canonicalComparable(pendingPair(pending))) currentEntryFail("current-entry final equality fence failed");
  return resolved;
}

export async function resolveInternalProductionCurrentEntryOperationV1(
  pair: InternalProductionCurrentEntryOperationPairV1,
): Promise<InternalProductionCurrentEntryOperationV1> {
  const expected = requirePair(pair, "operationRef", "operationHash", "setfarm://internal-production/current-entry-operation/sha256/");
  const target = fixedCurrentEntryPath("operation");
  const body = strictCanonicalRecord(readCurrentEntryRecord(target.directory, target.basename, target.device), "current-entry operation");
  return parseCurrentEntryOperationBody(body, expected);
}

async function parseCurrentEntryOperationBody(
  body: Record<string, unknown>,
  expected: Readonly<Record<string, string>>,
  publisherValidation = false,
  publisherDependencies?: Readonly<{ v31Body: Record<string, unknown>; pendingBody: Record<string, unknown> }>,
): Promise<InternalProductionCurrentEntryOperationV1> {
  if (!hasExactKeys(body, ["schema", "purpose", "controllerSource", "productBuildAuthorityV2DeliveryEvidence", "productBuildAuthorityV2Observation", "authorityV3Migration31Audit", "pendingBootstrapHandoffMigration", "operationRef", "operationHash"])) currentEntryFail("current-entry operation fields are invalid");
  if (body.schema !== "setfarm.internal-production-current-entry-operation.v1" || body.purpose !== "task6a-internal-production-current-entry-v1") currentEntryFail("current-entry operation discriminator is invalid");
  const projection = { ...body };
  delete projection.operationRef;
  delete projection.operationHash;
  const hash = requireSha256(body.operationHash, "current-entry operation hash");
  if (hashCanonicalJson(projection) !== hash || body.operationRef !== `setfarm://internal-production/current-entry-operation/sha256/${hash}` || expected.operationHash !== hash || expected.operationRef !== body.operationRef) currentEntryFail("current-entry operation pair/hash is invalid");
  const source = requireSource(body.controllerSource);
  let v31: InternalProductionAuthorityV3Migration31AuditV1;
  let pending: InternalProductionPendingBootstrapHandoffMigrationProjectionV1;
  if (publisherValidation) {
    const v31Expected = requirePair(body.authorityV3Migration31Audit, "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "setfarm://internal-production/authority-v3-migration31-audit/sha256/");
    const v31Body = publisherDependencies?.v31Body ?? (() => {
      const target = fixedCurrentEntryPath("authorityV3Migration31Audit");
      return strictCanonicalRecord(publisherEntry(target.directory, target.basename, target.device).bytes, "publisher v31 audit");
    })();
    v31 = await parseAuthorityV3Migration31AuditBody(v31Body, v31Expected);
    const pendingExpected = requirePair(body.pendingBootstrapHandoffMigration, "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash", "setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/");
    const pendingBody = publisherDependencies?.pendingBody ?? (() => {
      const target = fixedCurrentEntryPath("pendingBootstrapHandoffMigration");
      return strictCanonicalRecord(publisherEntry(target.directory, target.basename, target.device).bytes, "publisher pending migration");
    })();
    pending = parsePendingBootstrapHandoffMigrationBody(pendingBody, pendingExpected);
  } else {
    v31 = await resolveInternalProductionAuthorityV3Migration31AuditV1(body.authorityV3Migration31Audit as InternalProductionAuthorityV3Migration31AuditPairV1);
    pending = await resolveInternalProductionPendingBootstrapHandoffMigrationV1(body.pendingBootstrapHandoffMigration as InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1);
  }
  if (canonicalComparable(v31.controllerSource) !== canonicalComparable(source) || canonicalComparable(pending.controllerSource) !== canonicalComparable(source)) currentEntryFail("current-entry nested source is crossed");
  const pba = await import("./product-build-authority-v2-delivery-evidence-v1.js") as Readonly<{ parseProductBuildAuthorityV2DeliveryEvidenceResponseV1?: (value: unknown) => Readonly<Record<string, unknown>> }>;
  if (!isPlainRecord(body.productBuildAuthorityV2Observation) || !hasExactKeys(body.productBuildAuthorityV2Observation, ["schema", "observationTransport", "response"]) || body.productBuildAuthorityV2Observation.schema !== "setfarm.product-build-authority-v2-delivery-evidence-observation.v1" || body.productBuildAuthorityV2Observation.observationTransport !== "source-cli" || typeof pba.parseProductBuildAuthorityV2DeliveryEvidenceResponseV1 !== "function") currentEntryFail("stored PBA observation is invalid");
  const parsed = pba.parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(body.productBuildAuthorityV2Observation.response);
  const parsedPair = pbaPair(Object.freeze({ schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1", observationTransport: "source-cli", response: parsed }) as ProductBuildAuthorityObservationV1);
  if (!isPlainRecord(body.productBuildAuthorityV2DeliveryEvidence) || !hasExactKeys(body.productBuildAuthorityV2DeliveryEvidence, ["deliveryEvidenceRef", "deliveryEvidenceHash"]) || body.productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceRef !== parsedPair.deliveryEvidenceRef || body.productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceHash !== parsedPair.deliveryEvidenceHash || canonicalComparable(body.productBuildAuthorityV2Observation.response) !== canonicalComparable(parsed)) currentEntryFail("stored PBA pair/response is crossed");
  return recursivelyFreeze(body as unknown as InternalProductionCurrentEntryOperationV1);
}

export type InternalProductionServiceCensusSpawnerV1 = Readonly<{
  pid: number;
  processStartTimeEpochMs: number;
  processIdentityHash: Sha256V1;
  serviceIdentityHash: Sha256V1;
  generationHash: Sha256V1;
  loadedSourceSha: string;
  loadedTreeHash: string;
  loadedBuildHash: Sha256V1;
  processOwnerCount: 1;
  listener: null;
}>;

type InternalProductionListeningServiceCensusV1 = Readonly<{
  pid: number;
  processStartTimeEpochMs: number;
  processIdentityHash: Sha256V1;
  serviceIdentityHash: Sha256V1;
  generationHash: Sha256V1;
  loadedSourceSha: string | null;
  loadedTreeHash: string | null;
  loadedBuildHash: Sha256V1 | null;
  processOwnerCount: 1;
  listenerOwnerCount: 1;
  listener: Readonly<{
    host: "127.0.0.1";
    port: 3333 | 3080 | 18789;
    listenerIdentityHash: Sha256V1;
  }>;
}>;

export type InternalProductionServiceCensusV1 = Readonly<{
  schema: "setfarm.internal-production-service-census.v1";
  spawner: InternalProductionServiceCensusSpawnerV1;
  dashboard: InternalProductionListeningServiceCensusV1;
  missionControl: InternalProductionListeningServiceCensusV1;
  openClaw: InternalProductionListeningServiceCensusV1;
  censusHash: Sha256V1;
}>;

export type InternalProductionLegacyPreManifestZeroOwnerObservationPairV1 = Readonly<{
  observationRef: CanonicalRefV1;
  observationHash: Sha256V1;
}>;

export type InternalProductionLegacyPreManifestZeroOwnerObservationV1 = Readonly<{
  schema: "setfarm.internal-production-legacy-pre-manifest-zero-owner-observation.v1";
  observationKind: "legacy-pre-manifest-existing-live-truth";
  authorityV3Migration31AuditRef: CanonicalRefV1;
  authorityV3Migration31AuditHash: Sha256V1;
  cleanSetfarmSourceSha: string;
  cleanSetfarmTreeHash: string;
  cleanSetfarmBuildHash: Sha256V1;
  observedSpawnerGenerationHash: Sha256V1;
  census: InternalProductionCompleteZeroOwnerCensusV1;
  allThirtySixScalarCountsZero: true;
  ownerReservationSidecarState: "absent-before-migration-32";
  ownerAdmissionHeadState: "absent-before-migration-32";
  manifestActivationState: "absent-before-initial-a-activation";
  observationRef: CanonicalRefV1;
  observationHash: Sha256V1;
}>;

const LEGACY_ZERO_STORE_V1 = "data/internal-production-baseline/legacy-pre-manifest-zero-owner-observation-v1";
const LEGACY_ZERO_PREFIX_V1 = "setfarm://internal-production/legacy-pre-manifest-zero-owner-observation/sha256/";
const COMPLETE_ZERO_CENSUS_KEYS_V1 = Object.freeze([
  "activeRunCount", "openClaimCount", "executionAttemptCount", "activeRuntimeSessionCount",
  "activeCompletionOwnerCount", "unsettledMandatoryEffectCount", "ordinaryStartingCount",
  "restartReservationCount", "serviceRestartOperationCount", "launchPreparationCount",
  "preparedLaunchCount", "stagedCaseCount", "fixtureAttemptCount", "artifactReservationCount",
  "publicationBatchCount", "artifactPublicationCount", "docsSessionCount", "docsLeaseCount",
  "fleetStageCount", "fleetInflightCount", "fleetPendingReviewCount", "matrixInflightCount",
  "launchOutboxCount", "terminationOwnerCount", "findingOwnerCount", "recoveryOwnerCount",
  "operationalDeliveryCount", "sourceRunOwnerCount", "coldRehearsalOwnerCount",
  "compilationLeaseCount", "executionLeaseCount", "ownedProcessCount", "ownedListenerCount",
  "ownedWorktreeCount", "dirtyWorktreeCount", "staleChildCount",
] as const satisfies readonly (keyof InternalProductionCompleteZeroOwnerCensusV1)[]);

const PHYSICAL_COMMAND_CAP_V1 = 1_048_576;
const PHYSICAL_ENTRY_CAP_V1 = 256;
const PHYSICAL_PROCESS_CAP_V1 = 4_096;
const PHYSICAL_ENV_V1 = Object.freeze({
  PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
  LANG: "C",
  LC_ALL: "C",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_NO_REPLACE_OBJECTS: "1",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_TERMINAL_PROMPT: "0",
});
const FIXED_WORKTREE_BASES_V1 = Object.freeze([
  "/Users/setrox/ai/setrox/.worktrees",
  "/Users/setrox/ai/setrox/setfarm/.worktrees",
  "/Users/setrox/ai/setrox/mission-control/.worktrees",
  "/Users/setrox/.openclaw/workspace/agent-scratch/story-worktrees",
]);
const WORKFLOW_BASE_V1 = "/Users/setrox/.openclaw/workspaces/workflows";
const PROJECTS_BASE_V1 = "/Users/setrox/projects";
const PHYSICAL_NAME_V1 = /^[A-Za-z0-9._-]+$/;

type PhysicalProcessV1 = Readonly<{
  uid: number; pid: number; ppid: number; pgid: number; stat: string;
  lstart: string; command: string; cwd: string | null;
}>;

type PhysicalInventoryV1 = Readonly<{
  worktrees: readonly Readonly<{ root: string; dirty: boolean }>[];
  processes: readonly PhysicalProcessV1[];
  listeners: readonly Readonly<{ pid: number; protocol: "TCP"; localAddress: string; port: number }>[];
  stale: readonly number[];
  ownedProcessCount: number; ownedListenerCount: number; ownedWorktreeCount: number;
  dirtyWorktreeCount: number; staleChildCount: number;
}>;

function runPhysicalCommandV1(executable: string, args: readonly string[], accepted: readonly number[] = [0]): Readonly<{ status: number; stdout: Buffer }> {
  const result = spawnSync(executable, [...args], {
    env: PHYSICAL_ENV_V1,
    shell: false,
    encoding: "buffer",
    timeout: 10_000,
    maxBuffer: PHYSICAL_COMMAND_CAP_V1,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? "");
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.from(result.stderr ?? "");
  if (result.error || result.signal || result.status === null || !accepted.includes(result.status) || stderr.length !== 0 || stdout.length > PHYSICAL_COMMAND_CAP_V1) {
    currentEntryFail(`physical command failed: ${executable} ${args.join(" ")}`);
  }
  return Object.freeze({ status: result.status, stdout });
}

function requirePhysicalDirectoryV1(target: string, label: string): void {
  let observed: BigIntStats;
  try { observed = lstatSync(target, { bigint: true }); } catch { return currentEntryFail(`${label} is absent`); }
  if (!observed.isDirectory() || observed.isSymbolicLink() || realpathSync(target) !== target) currentEntryFail(`${label} is not one real directory`);
}

function boundedPhysicalChildrenV1(root: string): readonly string[] {
  requirePhysicalDirectoryV1(root, `physical base ${root}`);
  const names = readdirSync(root).sort(compareBytes);
  if (names.length > PHYSICAL_ENTRY_CAP_V1) currentEntryFail(`physical base ${root} exceeds the entry cap`);
  const children: string[] = [];
  for (const name of names) {
    if (!PHYSICAL_NAME_V1.test(name)) currentEntryFail(`physical base ${root} contains a noncanonical child`);
    const child = path.join(root, name);
    const observed = lstatSync(child, { bigint: true });
    if (observed.isSymbolicLink()) currentEntryFail(`physical base ${root} contains a symlink child`);
    if (observed.isDirectory()) children.push(child);
  }
  return Object.freeze(children);
}

function physicalManagedBasesV1(): readonly string[] {
  const roots = [...FIXED_WORKTREE_BASES_V1];
  for (const workflow of boundedPhysicalChildrenV1(WORKFLOW_BASE_V1)) {
    const agents = path.join(workflow, "agents");
    for (const agent of boundedPhysicalChildrenV1(agents)) roots.push(path.join(agent, "story-worktrees"));
  }
  for (const project of boundedPhysicalChildrenV1(PROJECTS_BASE_V1)) roots.push(path.join(project, ".worktrees"));
  if (roots.length > PHYSICAL_ENTRY_CAP_V1) currentEntryFail("managed worktree root inventory exceeds the cap");
  for (const root of roots) requirePhysicalDirectoryV1(root, `managed worktree root ${root}`);
  return Object.freeze(roots.sort(compareBytes));
}

function physicalImmediateProjectsV1(): readonly string[] {
  return Object.freeze([...boundedPhysicalChildrenV1(PROJECTS_BASE_V1)].sort(compareBytes));
}

function parseGitWorktreeListV1(bytes: Buffer): readonly string[] {
  const text = strictUtf8(bytes, "Git worktree list");
  if (!text.endsWith("\0")) currentEntryFail("Git worktree list is truncated");
  const worktrees: string[] = [];
  for (const field of text.split("\0")) {
    if (!field) continue;
    if (field.startsWith("worktree ")) {
      const root = field.slice("worktree ".length);
      if (!path.isAbsolute(root) || root !== root.normalize("NFC")) currentEntryFail("Git worktree root is invalid");
      worktrees.push(root);
    }
  }
  if (new Set(worktrees).size !== worktrees.length) currentEntryFail("Git worktree list contains a duplicate");
  return Object.freeze(worktrees);
}

function observeManagedWorktreesV1(): readonly Readonly<{ root: string; dirty: boolean }>[] {
  const bases = physicalManagedBasesV1();
  const physical = bases.flatMap((base) => boundedPhysicalChildrenV1(base));
  if (physical.length > PHYSICAL_ENTRY_CAP_V1 || new Set(physical).size !== physical.length) currentEntryFail("managed worktree inventory is ambiguous");
  const physicalSet = new Set(physical);
  const seenListedNonPrimary = new Set<string>();
  const result: Array<Readonly<{ root: string; dirty: boolean }>> = [];
  for (const candidate of physical.sort(compareBytes)) {
    const listed = parseGitWorktreeListV1(runPhysicalCommandV1("/usr/bin/git", ["-C", candidate, "worktree", "list", "--porcelain", "-z"]).stdout);
    if (listed.length < 2 || listed[0] === candidate || !listed.slice(1).includes(candidate)) currentEntryFail(`Git does not authenticate managed non-primary worktree ${candidate}`);
    for (const item of listed.slice(1)) seenListedNonPrimary.add(item);
    const status = runPhysicalCommandV1("/usr/bin/git", ["-C", candidate, "status", "--porcelain=v2", "--untracked-files=all"]).stdout;
    result.push(Object.freeze({ root: candidate, dirty: status.length !== 0 }));
  }
  if (seenListedNonPrimary.size !== physicalSet.size || [...seenListedNonPrimary].some((item) => !physicalSet.has(item))) currentEntryFail("Git/physical worktree inventories disagree");
  return Object.freeze(result);
}

function parsePhysicalProcessesV1(bytes: Buffer): readonly PhysicalProcessV1[] {
  const text = strictUtf8(bytes, "global process census");
  if (text.includes("\r") || text.includes("\0") || !text.endsWith("\n")) currentEntryFail("global process census is malformed");
  const lines = text.slice(0, -1).split("\n").filter(Boolean);
  if (lines.length > PHYSICAL_PROCESS_CAP_V1) currentEntryFail("global process census exceeds the row cap");
  const result: PhysicalProcessV1[] = [];
  const pids = new Set<number>();
  for (const line of lines) {
    const match = /^\s*([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+(\S+)\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+[ 0-9][0-9]\s+[0-9]{2}:[0-9]{2}:[0-9]{2}\s+[0-9]{4})\s+(.+)$/.exec(line);
    if (!match) currentEntryFail("global process row is malformed");
    const [uid, pid, ppid, pgid] = match.slice(1, 5).map(Number);
    if (![uid, pid, ppid, pgid].every(Number.isSafeInteger) || uid! < 0 || pid! < 1 || ppid! < 0 || pgid! < 0 || pids.has(pid!)) currentEntryFail("global process identity is invalid");
    pids.add(pid!);
    result.push(Object.freeze({ uid: uid!, pid: pid!, ppid: ppid!, pgid: pgid!, stat: match[5]!, lstart: match[6]!, command: match[7]!, cwd: null }));
  }
  return Object.freeze(result.sort((left, right) => left.pid - right.pid));
}

function lsofFieldsV1(bytes: Buffer, label: string): readonly string[] {
  const text = strictUtf8(bytes, label);
  if (text.includes("\r") || !text.endsWith("\0\n")) currentEntryFail(`${label} is truncated`);
  return Object.freeze(text.split("\0").map((field) => field.replace(/^\n+/, "")).filter(Boolean));
}

function parseLsofReferencesV1(bytes: Buffer, root: string): Readonly<{ pids: readonly number[]; deleted: readonly number[] }> {
  const pids = new Set<number>();
  const deleted = new Set<number>();
  let currentPid: number | null = null;
  for (const field of lsofFieldsV1(bytes, `lsof reference ${root}`)) {
    if (field[0] === "p") {
      if (!/^[0-9]+$/.test(field.slice(1))) currentEntryFail("lsof reference process identity is malformed");
      const pid = Number(field.slice(1));
      if (!Number.isSafeInteger(pid) || pid < 1 || pids.has(pid)) currentEntryFail("lsof reference process identity is ambiguous");
      currentPid = pid;
      pids.add(pid);
    } else if (field[0] === "n") {
      if (currentPid === null || field.length < 2) currentEntryFail("lsof reference name has no process");
      if (field.endsWith(" (deleted)")) deleted.add(currentPid);
    }
  }
  if (pids.size === 0) currentEntryFail("lsof reference inventory has no process record");
  return Object.freeze({ pids: Object.freeze([...pids].sort((a, b) => a - b)), deleted: Object.freeze([...deleted].sort((a, b) => a - b)) });
}

function lsofReferencedPidsV1(root: string): Readonly<{ pids: readonly number[]; deleted: readonly number[] }> {
  const result = runPhysicalCommandV1("/usr/sbin/lsof", ["-nP", "-F0", "+D", root], [0, 1]);
  if (result.status === 1 && result.stdout.length !== 0) currentEntryFail("empty lsof reference inventory has output");
  if (result.status === 1) return Object.freeze({ pids: Object.freeze([]), deleted: Object.freeze([]) });
  return parseLsofReferencesV1(result.stdout, root);
}

function observeProcessCwdV1(pid: number, expectedPpid: number): string {
  const fields = lsofFieldsV1(runPhysicalCommandV1("/usr/sbin/lsof", ["-a", "-p", String(pid), "-d", "cwd", "-F0pcRfn"]).stdout, `process ${pid} cwd`);
  const pids = fields.filter((field) => field[0] === "p").map((field) => Number(field.slice(1)));
  const parents = fields.filter((field) => field[0] === "R").map((field) => Number(field.slice(1)));
  const cwds = fields.filter((field) => field[0] === "n").map((field) => field.slice(1));
  if (pids.length !== 1 || pids[0] !== pid || parents.length !== 1 || parents[0] !== expectedPpid || cwds.length !== 1 || !path.isAbsolute(cwds[0]!)) currentEntryFail(`process ${pid} cwd identity is ambiguous`);
  return cwds[0]!;
}

function parseProcessListenersV1(bytes: Buffer, pid: number): readonly Readonly<{ pid: number; protocol: "TCP"; localAddress: string; port: number }>[] {
  const fields = lsofFieldsV1(bytes, `process ${pid} listeners`);
  const pids = fields.filter((field) => field[0] === "p").map((field) => Number(field.slice(1)));
  if (pids.length !== 1 || pids[0] !== pid) currentEntryFail(`process ${pid} listener identity is ambiguous`);
  const listeners = fields.filter((field) => field[0] === "n").map((field) => {
    const match = /^(?:TCP\s+)?(.+):([0-9]+)$/.exec(field.slice(1));
    if (!match) currentEntryFail(`process ${pid} listener endpoint is malformed`);
    const port = Number(match[2]);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) currentEntryFail(`process ${pid} listener port is invalid`);
    return Object.freeze({ pid, protocol: "TCP" as const, localAddress: match[1]!, port });
  });
  const keys = listeners.map((listener) => canonicalComparable(listener));
  if (new Set(keys).size !== keys.length) currentEntryFail(`process ${pid} listener inventory contains a duplicate`);
  return Object.freeze(listeners);
}

function observeProcessListenersV1(pid: number): readonly Readonly<{ pid: number; protocol: "TCP"; localAddress: string; port: number }>[] {
  const result = runPhysicalCommandV1("/usr/sbin/lsof", ["-nP", "-a", "-p", String(pid), "-iTCP", "-sTCP:LISTEN", "-F0pcfn"], [0, 1]);
  if (result.status === 1 && result.stdout.length === 0) return Object.freeze([]);
  return parseProcessListenersV1(result.stdout, pid);
}

function assertPhysicalInventoryPassStableV1(first: unknown, second: unknown): void {
  if (canonicalComparable(first) !== canonicalComparable(second)) currentEntryFail("physical inventory changed across observation passes");
}

function observePhysicalInventoryV1(services: InternalProductionServiceCensusV1, activeRunCount: number): PhysicalInventoryV1 {
  if (process.platform !== "darwin") currentEntryFail("physical census requires Darwin");
  const worktrees = observeManagedWorktreesV1();
  const processes = parsePhysicalProcessesV1(runPhysicalCommandV1("/bin/ps", ["-axo", "uid=,pid=,ppid=,pgid=,stat=,lstart=,command="]).stdout);
  const byPid = new Map(processes.map((entry) => [entry.pid, entry]));
  const persistent = [services.spawner, services.dashboard, services.missionControl, services.openClaw];
  for (const service of persistent) {
    const row = byPid.get(service.pid);
    if (!row || Date.parse(row.lstart) !== service.processStartTimeEpochMs || sha256(`${row.pid}\n${row.lstart}\n`) !== service.processIdentityHash) currentEntryFail("persistent service changed during physical census");
  }
  const managedRoots = physicalManagedBasesV1();
  const immediateProjects = physicalImmediateProjectsV1();
  const referencePids = new Set<number>();
  const deletedPids = new Set<number>();
  for (const root of [...managedRoots, ...worktrees.map((entry) => entry.root), ...immediateProjects]) {
    const refs = lsofReferencedPidsV1(root);
    refs.pids.forEach((pid) => referencePids.add(pid));
    refs.deleted.forEach((pid) => deletedPids.add(pid));
  }
  for (const pid of referencePids) if (!Number.isSafeInteger(pid) || pid < 1 || !byPid.has(pid)) currentEntryFail("lsof referenced process disappeared from the physical census");
  const persistentPids = new Set(persistent.map((service) => service.pid));
  const descendantPids = new Set<number>(persistentPids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of processes) if (!descendantPids.has(row.pid) && descendantPids.has(row.ppid)) { descendantPids.add(row.pid); changed = true; }
  }
  const managedPrefixes = [...managedRoots, ...worktrees.map((entry) => entry.root)].map((root) => `${root}/`);
  const projectPrefixes = immediateProjects.map((root) => `${root}/`);
  const commandReferencesExactPath = (command: string, target: string, requireChild: boolean): boolean => {
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const suffix = requireChild ? "\\/[A-Za-z0-9._-]+(?:\\/|$|[^A-Za-z0-9._-])" : "(?:\\/|$|[^A-Za-z0-9._-])";
    return new RegExp(`(?:^|[^A-Za-z0-9._/\\-])${escaped}${suffix}`).test(command);
  };
  const commandReferencesManagedStoryWorktree = (command: string): boolean => managedRoots.some((managedRoot) => {
    if (!managedRoot.endsWith("/story-worktrees")) return false;
    return commandReferencesExactPath(command, managedRoot, true);
  });
  const orphanPattern = /openclaw.*agent.*--session-id\s+spawner-/i;
  const seeds = processes.filter((row) => !persistentPids.has(row.pid) && (
    descendantPids.has(row.pid) || orphanPattern.test(row.command) || referencePids.has(row.pid)
    || commandReferencesManagedStoryWorktree(row.command)
  ));
  const owned: PhysicalProcessV1[] = [];
  const stale = new Set<number>();
  for (const row of seeds) {
    const cwd = observeProcessCwdV1(row.pid, row.ppid);
    const cwdOwned = managedPrefixes.some((prefix) => cwd === prefix.slice(0, -1) || cwd.startsWith(prefix))
      || projectPrefixes.some((prefix) => cwd === prefix.slice(0, -1) || cwd.startsWith(prefix));
    const managedStoryCommand = commandReferencesManagedStoryWorktree(row.command);
    const isOwned = descendantPids.has(row.pid) || orphanPattern.test(row.command) || referencePids.has(row.pid) || cwdOwned || managedStoryCommand;
    if (!isOwned) continue;
    const complete = Object.freeze({ ...row, cwd });
    owned.push(complete);
    const unresolvedStoryWorktree = managedStoryCommand
      && !worktrees.some((worktree) => commandReferencesExactPath(row.command, worktree.root, false));
    if ((orphanPattern.test(row.command) && activeRunCount === 0) || row.stat.includes("Z") || cwd.endsWith(" (deleted)") || deletedPids.has(row.pid) || unresolvedStoryWorktree) stale.add(row.pid);
  }
  const listenerPids = new Set([...persistentPids, ...owned.map((entry) => entry.pid)]);
  const listeners = [...listenerPids].sort((a, b) => a - b).flatMap((pid) => observeProcessListenersV1(pid));
  const expectedListeners = new Set([
    `${services.dashboard.pid}|127.0.0.1|3333`,
    `${services.missionControl.pid}|127.0.0.1|3080`,
    `${services.openClaw.pid}|127.0.0.1|18789`,
  ]);
  const extraListeners = listeners.filter((listener) => !expectedListeners.has(`${listener.pid}|${listener.localAddress}|${listener.port}`));
  const processesAgain = parsePhysicalProcessesV1(runPhysicalCommandV1("/bin/ps", ["-axo", "uid=,pid=,ppid=,pgid=,stat=,lstart=,command="]).stdout);
  assertPhysicalInventoryPassStableV1(processes, processesAgain);
  return recursivelyFreeze({
    worktrees,
    processes: owned.sort((left, right) => left.pid - right.pid),
    listeners: extraListeners.sort((left, right) => left.pid - right.pid || left.port - right.port),
    stale: [...stale].sort((a, b) => a - b),
    ownedProcessCount: owned.length,
    ownedListenerCount: extraListeners.length,
    ownedWorktreeCount: worktrees.length,
    dirtyWorktreeCount: worktrees.filter((entry) => entry.dirty).length,
    staleChildCount: stale.size,
  });
}

function boundedChildText(executable: string, args: readonly string[], label: string): string {
  const result = spawnSync(executable, [...args], {
    env: Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }),
    shell: false,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1_048_576,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.signal || result.status !== 0 || result.stderr !== "") {
    currentEntryFail(`${label} observation failed`);
  }
  return result.stdout;
}

function loadedMissionControlSourceV1(): Readonly<{ sha: string; treeHash: string; buildHash: string }> {
  const identityPath = path.resolve(fixedRepositoryRoot(), "../mission-control/dist-server/internal-production-build-identity.v1.json");
  const value = strictCanonicalRecord(readStableRegular(identityPath, CURRENT_ENTRY_MAX_BYTES, lstatSync(path.dirname(identityPath), { bigint: true }).dev, 1).bytes, "Mission Control build identity");
  if (!hasExactKeys(value, ["schema", "sourceSha", "treeHash", "buildHash"]) || value.schema !== "mission-control.internal-production-build-identity.v1") {
    currentEntryFail("Mission Control build identity is invalid");
  }
  return Object.freeze({
    sha: requireGitHash(value.sourceSha, "Mission Control source SHA"),
    treeHash: requireGitHash(value.treeHash, "Mission Control tree hash"),
    buildHash: requireSha256(value.buildHash, "Mission Control build hash"),
  });
}

const PHASE_CLOSED_FUTURE_PRODUCERS_V1 = Object.freeze([
  ["src/internal-production/internal-production-service-restart-startup-v1.ts", "reserveInternalProductionOrdinaryServiceStartOwnerV1"],
  ["src/internal-production/internal-production-service-restart-authority-v1.ts", "reserveInternalProductionServiceRestartDispatchOwnerV1"],
  ["src/internal-production/internal-production-service-restart-authority-v1.ts", "reserveInternalProductionServiceRestartOperationOwnerV1"],
  ["src/internal-production/golden-run-phase-store.ts", "reserveGoldenLaunchPreparationOwnerV1"],
  ["src/internal-production/golden-run-phase-store.ts", "reserveGoldenPreparedLaunchOwnerV1"],
  ["src/internal-production/golden-run-phase-store.ts", "reserveGoldenLaunchOutboxOwnerV1"],
  ["src/internal-production/golden-matrix-runner.ts", "reserveGoldenStagedCaseOwnerV1"],
  ["src/internal-production/golden-run-harness.ts", "reserveGoldenFixtureAttemptOwnerV1"],
  ["src/internal-production/existing-repository-fixture-catalog.ts", "reserveGoldenExistingRepositoryFixtureAttemptOwnerV1"],
  ["src/internal-production/golden-run-report.ts", "reserveGoldenDocsSessionOwnerV1"],
  ["src/internal-production/golden-run-report.ts", "reserveGoldenDocsLeaseOwnerV1"],
  ["src/internal-production/golden-fleet-scheduler.ts", "reserveGoldenFleetStageOwnerV1"],
  ["src/internal-production/golden-fleet-status-store.ts", "reserveGoldenFleetInflightOwnerV1"],
  ["src/internal-production/golden-fleet-scheduler.ts", "reserveGoldenFleetReviewOwnerV1"],
  ["src/internal-production/golden-matrix-inflight-status-v1.ts", "reserveGoldenMatrixInflightOwnerV1"],
  ["src/internal-production/cold-rehearsal-v1.ts", "reserveColdRehearsalOwnerV1"],
  ["src/internal-production/golden-verifier-runtime.ts", "reserveGoldenCompilationLeaseOwnerV1"],
  ["src/internal-production/golden-verifier-runtime.ts", "reserveGoldenExecutionLeaseOwnerV1"],
] as const);

function requireAbsentPhasePathV1(target: string, label: string): void {
  try {
    lstatSync(target);
  } catch (error) {
    if (isEnoent(error)) return;
    currentEntryFail(`${label} absence is ambiguous`);
  }
  currentEntryFail(`${label} is present before its producer phase`);
}

function requireAbsentProducerLiteralV1(source: string, producer: string): void {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(producer) || source.includes(producer)) {
    currentEntryFail("future producer export is already active");
  }
}

function assertPhaseSourceEqualV1(expected: unknown, observed: unknown): void {
  if (canonicalComparable(expected) !== canonicalComparable(observed)) currentEntryFail("phase-closed source changed or crossed");
}

async function observePhaseClosedZeroV1(
  expectedSource: InternalProductionCleanSetfarmSourceBuildV1,
): Promise<Readonly<{
  ordinaryStartingCount: 0; restartReservationCount: 0; serviceRestartOperationCount: 0;
  launchPreparationCount: 0; preparedLaunchCount: 0; stagedCaseCount: 0; fixtureAttemptCount: 0;
  docsSessionCount: 0; docsLeaseCount: 0; fleetStageCount: 0; fleetInflightCount: 0;
  fleetPendingReviewCount: 0; matrixInflightCount: 0; launchOutboxCount: 0;
  sourceRunOwnerCount: 0; coldRehearsalOwnerCount: 0; compilationLeaseCount: 0; executionLeaseCount: 0;
}>> {
  const codeRoot = fixedRepositoryRoot();
  const before = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  assertPhaseSourceEqualV1(expectedSource, before);
  for (const [locator, producer] of PHASE_CLOSED_FUTURE_PRODUCERS_V1) {
    requireAbsentPhasePathV1(path.join(codeRoot, locator), `${producer} module`);
  }
  const ownBytes = strictUtf8(
    readStableRegular(fileURLToPath(import.meta.url), CURRENT_ENTRY_MAX_BYTES, lstatSync(fileURLToPath(import.meta.url), { bigint: true }).dev, 1).bytes,
    "phase-closed receipt source",
  );
  const sourceRunProducer = ["reserveRecovery", "SourceRunOwnerV1"].join("");
  requireAbsentProducerLiteralV1(ownBytes, sourceRunProducer);
  const runtime = await import("../runtime-config.js") as Readonly<{ runtimeConfig?: Readonly<{ setfarmDir?: unknown }> }>;
  const setfarmDir = runtime.runtimeConfig?.setfarmDir;
  if (typeof setfarmDir !== "string" || !path.isAbsolute(setfarmDir)) currentEntryFail("phase-closed Setfarm authority base is invalid");
  const authorityRoot = path.join(setfarmDir, "internal-production");
  requireAbsentPhasePathV1(authorityRoot, "future producer authority root");
  for (const child of ["golden-results", "fixtures", "recovery", "golden-fleet"]) {
    requireAbsentPhasePathV1(path.join(authorityRoot, child), `future producer authority child ${child}`);
  }
  const after = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  assertPhaseSourceEqualV1(before, after);
  return recursivelyFreeze({
    ordinaryStartingCount: 0, restartReservationCount: 0, serviceRestartOperationCount: 0,
    launchPreparationCount: 0, preparedLaunchCount: 0, stagedCaseCount: 0, fixtureAttemptCount: 0,
    docsSessionCount: 0, docsLeaseCount: 0, fleetStageCount: 0, fleetInflightCount: 0,
    fleetPendingReviewCount: 0, matrixInflightCount: 0, launchOutboxCount: 0,
    sourceRunOwnerCount: 0, coldRehearsalOwnerCount: 0, compilationLeaseCount: 0, executionLeaseCount: 0,
  });
}

function observeServiceProcessV1(
  label: "com.setrox.setfarm-spawner" | "com.setrox.setfarm-dashboard" | "com.setrox.mission-control" | "ai.openclaw.gateway",
  port: null | 3333 | 3080 | 18789,
  source: Readonly<{ sha: string; treeHash: string; buildHash: string }> | null,
): InternalProductionServiceCensusSpawnerV1 | InternalProductionListeningServiceCensusV1 {
  const uid = process.getuid?.();
  if (!Number.isSafeInteger(uid) || (uid ?? -1) < 0) currentEntryFail("service census UID is invalid");
  const launchctl = boundedChildText("/bin/launchctl", ["print", `gui/${uid}/${label}`], `${label} launchctl`);
  const pidMatches = [...launchctl.matchAll(/^\s*pid = ([0-9]+)\s*$/gm)];
  if (pidMatches.length !== 1) currentEntryFail(`${label} PID is ambiguous`);
  const pid = Number(pidMatches[0]![1]);
  if (!Number.isSafeInteger(pid) || pid < 1) currentEntryFail(`${label} PID is invalid`);
  const ps = boundedChildText("/bin/ps", ["-p", String(pid), "-o", "lstart="], `${label} process`);
  if (!ps.endsWith("\n") || ps.trim().length === 0) currentEntryFail(`${label} process start is invalid`);
  const processStartTimeEpochMs = Date.parse(ps.trim());
  if (!Number.isSafeInteger(processStartTimeEpochMs) || processStartTimeEpochMs < 1) currentEntryFail(`${label} process start is invalid`);
  const processIdentityHash = sha256(`${pid}\n${ps}`);
  const command = boundedChildText("/bin/ps", ["-p", String(pid), "-o", "command="], `${label} command`);
  if (!command.endsWith("\n") || command.slice(0, -1).includes("\n")) currentEntryFail(`${label} command is ambiguous`);
  const allCommands = boundedChildText("/bin/ps", ["-axo", "command="], `${label} global process census`).split("\n");
  const processOwnerCount = allCommands.filter((candidate) => candidate === command.slice(0, -1)).length;
  if (processOwnerCount !== 1) currentEntryFail(`${label} process owner count is not exactly one`);
  if (source !== null) {
    const expectedRoot = label === "com.setrox.mission-control"
      ? path.resolve(fixedRepositoryRoot(), "../mission-control")
      : fixedRepositoryRoot();
    const expectedPrefixes = label === "com.setrox.mission-control"
      ? [`${expectedRoot}/dist-server/`, `${expectedRoot}/dist/`]
      : [`${expectedRoot}/dist/`];
    if (!expectedPrefixes.some((prefix) => command.includes(prefix))) currentEntryFail(`${label} loaded entrypoint is outside its authenticated build root`);
  }
  const serviceIdentityHash = hashCanonicalJson({ schema: "setfarm.internal-production-service-identity.v1", label, command: command.slice(0, -1) });
  const generationHash = hashCanonicalJson({ schema: "setfarm.internal-production-loaded-service-generation.v1", label, serviceIdentityHash, source });
  const common = { pid, processStartTimeEpochMs, processIdentityHash, serviceIdentityHash, generationHash };
  if (port === null) {
    if (!source) currentEntryFail("spawner source is absent");
    return recursivelyFreeze({ ...common, loadedSourceSha: source.sha, loadedTreeHash: source.treeHash, loadedBuildHash: source.buildHash, processOwnerCount: processOwnerCount as 1, listener: null });
  }
  const lsof = boundedChildText("/usr/sbin/lsof", ["-nP", "-a", "-p", String(pid), `-iTCP@127.0.0.1:${port}`, "-sTCP:LISTEN", "-F0pcfn"], `${label} listener`);
  const listenerPids = [...lsof.matchAll(/(?:^|\0\n?)p([0-9]+)\0/g)].map((match) => Number(match[1]));
  const listenerNames = [...lsof.matchAll(/(?:^|\0\n?)n(?:TCP )?127\.0\.0\.1:([0-9]+)\0/g)].map((match) => Number(match[1]));
  if (listenerPids.length !== 1 || listenerPids[0] !== pid || listenerNames.length !== 1 || listenerNames[0] !== port) currentEntryFail(`${label} listener owner count is not exactly one`);
  return recursivelyFreeze({
    ...common,
    loadedSourceSha: source?.sha ?? null,
    loadedTreeHash: source?.treeHash ?? null,
    loadedBuildHash: source?.buildHash ?? null,
    processOwnerCount: processOwnerCount as 1,
    listenerOwnerCount: listenerPids.length as 1,
    listener: { host: "127.0.0.1" as const, port, listenerIdentityHash: sha256(lsof) },
  });
}

export async function observeInternalProductionServiceCensusV1(): Promise<InternalProductionServiceCensusV1> {
  const setfarm = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  const source = Object.freeze({ sha: setfarm.sha, treeHash: setfarm.treeHash, buildHash: setfarm.buildHash });
  const body = {
    schema: "setfarm.internal-production-service-census.v1" as const,
    spawner: observeServiceProcessV1("com.setrox.setfarm-spawner", null, source) as InternalProductionServiceCensusSpawnerV1,
    dashboard: observeServiceProcessV1("com.setrox.setfarm-dashboard", 3333, source) as InternalProductionListeningServiceCensusV1,
    missionControl: observeServiceProcessV1("com.setrox.mission-control", 3080, loadedMissionControlSourceV1()) as InternalProductionListeningServiceCensusV1,
    openClaw: observeServiceProcessV1("ai.openclaw.gateway", 18789, null) as InternalProductionListeningServiceCensusV1,
  };
  return recursivelyFreeze({ ...body, censusHash: hashCanonicalJson(body) });
}

async function observeLegacyDatabaseCensusV1(): Promise<Readonly<{
  activeRunCount: number; openClaimCount: number; executionAttemptCount: number;
  activeRuntimeSessionCount: number; activeCompletionOwnerCount: number; unsettledMandatoryEffectCount: number;
  artifactReservationCount: number; publicationBatchCount: number; artifactPublicationCount: number;
  terminationOwnerCount: number; findingOwnerCount: number; recoveryOwnerCount: number; operationalDeliveryCount: number;
}>> {
  const postgresModule = await import("postgres");
  const databaseUrl = process.env.SETFARM_PG_URL;
  if (!databaseUrl) currentEntryFail("legacy zero-owner database is unavailable");
  const sql = postgresModule.default(databaseUrl, { max: 1, idle_timeout: 1, connect_timeout: 5 });
  try {
    return await sql.begin("isolation level repeatable read read only", async (tx) => {
      const connection = tx as unknown as typeof sql;
      await connection`SET LOCAL statement_timeout = '5s'`;
      await connection`SET LOCAL lock_timeout = '1s'`;
      const rows = await connection<Array<Record<string, unknown>>>`
        WITH required_columns(table_name,column_name,type_name,required_not_null) AS (
          VALUES
            ('runs','status','text',TRUE),
            ('claim_log','outcome','text',FALSE),
            ('execution_attempts','disposition','text',TRUE),
            ('runtime_sessions','state','text',TRUE),
            ('runtime_completion_requests','state','text',TRUE),
            ('runtime_completion_effects','mandatory','boolean',TRUE),
            ('runtime_completion_effects','state','text',TRUE),
            ('artifact_publication_reservations','reservation_id','text',TRUE),
            ('artifact_publication_reservations','artifact_hash','text',TRUE),
            ('artifact_publication_reservations','state','text',TRUE),
            ('artifact_publication_reservations','owner_instance_id','text',FALSE),
            ('artifact_publication_reservations','lease_token','text',FALSE),
            ('artifact_publication_reservations','lease_expires_at','timestamp with time zone',FALSE),
            ('artifact_publication_batches','batch_reservation_id','text',TRUE),
            ('artifact_publication_batches','state','text',TRUE),
            ('artifact_publication_batches','owner_instance_id','text',FALSE),
            ('artifact_publication_batches','lease_token','text',FALSE),
            ('artifact_publication_batches','lease_expires_at','timestamp with time zone',FALSE),
            ('artifact_publication_batch_items','batch_reservation_id','text',TRUE),
            ('artifact_publication_batch_items','artifact_hash','text',TRUE),
            ('artifact_publication_batch_items','reservation_id','text',FALSE),
            ('run_termination_requests','state','text',TRUE),
            ('findings','status','text',TRUE),
            ('recovery_cases','status','text',TRUE),
            ('recovery_dispatch_deliveries','state','text',TRUE),
            ('operational_event_deliveries','state','text',TRUE)
        ), catalog_violations AS (
          SELECT COUNT(*) AS count
          FROM required_columns expected
          LEFT JOIN pg_catalog.pg_class relation
            ON relation.relname=expected.table_name AND relation.relnamespace='public'::regnamespace
          LEFT JOIN pg_catalog.pg_attribute attribute
            ON attribute.attrelid=relation.oid AND attribute.attname=expected.column_name
              AND attribute.attnum>0 AND NOT attribute.attisdropped
          LEFT JOIN pg_catalog.pg_type data_type ON data_type.oid=attribute.atttypid
          WHERE relation.oid IS NULL OR attribute.attname IS NULL
             OR pg_catalog.format_type(data_type.oid,attribute.atttypmod)<>expected.type_name
             OR attribute.attnotnull<>expected.required_not_null
        ), aprb_child_violations AS (
          SELECT COUNT(*) AS count
          FROM public.artifact_publication_reservations reservation
          WHERE reservation.state='reserved' AND left(reservation.reservation_id,5)='APRB_'
            AND (SELECT COUNT(*)
                 FROM public.artifact_publication_batch_items item
                 JOIN public.artifact_publication_batches batch
                   ON batch.batch_reservation_id=item.batch_reservation_id AND batch.state='active'
                 WHERE (item.reservation_id,item.artifact_hash)=(reservation.reservation_id,reservation.artifact_hash)
                   AND reservation.owner_instance_id IS NOT DISTINCT FROM batch.owner_instance_id
                   AND reservation.lease_token IS NOT DISTINCT FROM batch.lease_token
                   AND reservation.lease_expires_at IS NOT DISTINCT FROM batch.lease_expires_at)<>1
        ), ordinary_batch_violations AS (
          SELECT COUNT(*) AS count
          FROM public.artifact_publication_reservations reservation
          JOIN public.artifact_publication_batch_items item
            ON (item.reservation_id,item.artifact_hash)=(reservation.reservation_id,reservation.artifact_hash)
          WHERE reservation.state='reserved' AND left(reservation.reservation_id,5)<>'APRB_'
        ), active_header_violations AS (
          SELECT COUNT(*) AS count
          FROM public.artifact_publication_batches batch
          WHERE batch.state='active' AND NOT EXISTS (
            SELECT 1 FROM public.artifact_publication_batch_items item
            JOIN public.artifact_publication_reservations reservation
              ON (reservation.reservation_id,reservation.artifact_hash)=(item.reservation_id,item.artifact_hash)
            WHERE item.batch_reservation_id=batch.batch_reservation_id
              AND reservation.state='reserved' AND left(reservation.reservation_id,5)='APRB_'
              AND reservation.owner_instance_id IS NOT DISTINCT FROM batch.owner_instance_id
              AND reservation.lease_token IS NOT DISTINCT FROM batch.lease_token
              AND reservation.lease_expires_at IS NOT DISTINCT FROM batch.lease_expires_at)
        )
        SELECT
          (SELECT count FROM catalog_violations)::text AS "catalogViolationCount",
          (SELECT count FROM aprb_child_violations)::text AS "aprbChildViolationCount",
          (SELECT count FROM ordinary_batch_violations)::text AS "ordinaryBatchViolationCount",
          (SELECT count FROM active_header_violations)::text AS "activeHeaderViolationCount",
          to_regclass('public.internal_production_owner_reservations_v1')::text AS "ownerReservationsRelation",
          to_regclass('public.internal_production_owner_admission_head_v1')::text AS "ownerAdmissionHeadRelation",
          to_regclass('public.internal_production_owner_producer_source_build_authorities_v1')::text AS "producerSourceRelation",
          to_regclass('public.internal_production_owner_producer_manifest_set_activations_v1')::text AS "producerActivationRelation",
          to_regclass('public.internal_production_owner_producer_manifest_activation_heads_v1')::text AS "producerActivationHeadRelation",
          to_regclass('public.internal_production_owner_producer_manifest_set_current_v1')::text AS "producerCurrentRelation",
          (SELECT COUNT(*) FROM public.runs WHERE status IN ('running','resuming','cancelling','failing'))::text AS "activeRunCount",
          (SELECT COUNT(*) FROM public.claim_log WHERE outcome IS NULL)::text AS "openClaimCount",
          (SELECT COUNT(*) FROM public.execution_attempts WHERE disposition IN ('claimed','running'))::text AS "executionAttemptCount",
          (SELECT COUNT(*) FROM public.runtime_sessions WHERE state NOT IN ('released','quarantined'))::text AS "activeRuntimeSessionCount",
          (SELECT COUNT(*) FROM public.runtime_completion_requests WHERE state NOT IN ('accepted','rejected','quarantined'))::text AS "activeCompletionOwnerCount",
          (SELECT COUNT(*) FROM public.runtime_completion_effects WHERE mandatory IS TRUE AND state NOT IN ('applied','reconciled'))::text AS "unsettledMandatoryEffectCount",
          (SELECT COUNT(*) FROM public.artifact_publication_reservations reservation WHERE reservation.state='reserved' AND left(reservation.reservation_id,5)<>'APRB_')::text AS "artifactReservationCount",
          (SELECT COUNT(*) FROM public.artifact_publication_batches WHERE state='active')::text AS "publicationBatchCount",
          (SELECT COUNT(*) FROM public.artifact_publication_batch_items item
             JOIN public.artifact_publication_reservations reservation
               ON (reservation.reservation_id,reservation.artifact_hash)=(item.reservation_id,item.artifact_hash)
             JOIN public.artifact_publication_batches batch
               ON batch.batch_reservation_id=item.batch_reservation_id
            WHERE reservation.state='reserved' AND left(reservation.reservation_id,5)='APRB_' AND batch.state='active')::text AS "artifactPublicationCount",
          (SELECT COUNT(*) FROM public.run_termination_requests WHERE state<>'terminalized')::text AS "terminationOwnerCount",
          (SELECT COUNT(*) FROM public.findings WHERE status='open')::text AS "findingOwnerCount",
          ((SELECT COUNT(*) FROM public.recovery_cases WHERE status IN ('open','repairing','evidencing'))
            +(SELECT COUNT(*) FROM public.recovery_dispatch_deliveries WHERE state IN ('authorized','leased','attempt_reserved','running')))::text AS "recoveryOwnerCount",
          (SELECT COUNT(*) FROM public.operational_event_deliveries WHERE state IN ('pending','leased'))::text AS "operationalDeliveryCount"
      `;
      if (rows.length !== 1 || !isPlainRecord(rows[0])) currentEntryFail("legacy zero-owner database aggregate must return exactly one row");
      const row = rows[0]!;
      for (const relationKey of [
        "ownerReservationsRelation", "ownerAdmissionHeadRelation", "producerSourceRelation",
        "producerActivationRelation", "producerActivationHeadRelation", "producerCurrentRelation",
      ]) if (row[relationKey] !== null) currentEntryFail(`legacy zero-owner database ${relationKey} is present`);
      const parseCount = (key: string): number => {
        const raw = row[key];
        if (typeof raw !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(raw)) currentEntryFail(`${key} is not a canonical nonnegative integer`);
        const count = Number(raw);
        if (!Number.isSafeInteger(count)) currentEntryFail(`${key} exceeds the safe-integer boundary`);
        return count;
      };
      for (const key of ["catalogViolationCount", "aprbChildViolationCount", "ordinaryBatchViolationCount", "activeHeaderViolationCount"]) {
        if (parseCount(key) !== 0) currentEntryFail(`${key} is nonzero`);
      }
      const observed = Object.freeze({
        activeRunCount: parseCount("activeRunCount"),
        openClaimCount: parseCount("openClaimCount"),
        executionAttemptCount: parseCount("executionAttemptCount"),
        activeRuntimeSessionCount: parseCount("activeRuntimeSessionCount"),
        activeCompletionOwnerCount: parseCount("activeCompletionOwnerCount"),
        unsettledMandatoryEffectCount: parseCount("unsettledMandatoryEffectCount"),
        artifactReservationCount: parseCount("artifactReservationCount"),
        publicationBatchCount: parseCount("publicationBatchCount"),
        artifactPublicationCount: parseCount("artifactPublicationCount"),
        terminationOwnerCount: parseCount("terminationOwnerCount"),
        findingOwnerCount: parseCount("findingOwnerCount"),
        recoveryOwnerCount: parseCount("recoveryOwnerCount"),
        operationalDeliveryCount: parseCount("operationalDeliveryCount"),
      });
      for (const [key, count] of Object.entries(observed)) if (count !== 0) currentEntryFail(`${key} is nonzero`);
      return recursivelyFreeze(observed);
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function reobserveStoredMigration31AuditV1(audit: InternalProductionAuthorityV3Migration31AuditV1): Promise<void> {
  const ports = await import("../db-pg.js") as Readonly<{
    auditCurrentInternalProductionAuthorityV3Migration31V1?: () => Promise<Readonly<{ authorityV3ContractSpineThroughMigration31: Migration31AuditDataV1; currentAuthorityAudit: CurrentAuthorityAuditV1 }>>;
  }>;
  if (typeof ports.auditCurrentInternalProductionAuthorityV3Migration31V1 !== "function") currentEntryFail("legacy zero-owner current v31 audit port is unavailable");
  const observed = await ports.auditCurrentInternalProductionAuthorityV3Migration31V1();
  requireAuthorityV3Migration31Audit(observed.authorityV3ContractSpineThroughMigration31);
  requireCurrentAuthorityAudit(observed.currentAuthorityAudit);
  if (canonicalComparable(observed.authorityV3ContractSpineThroughMigration31) !== canonicalComparable(audit.authorityV3ContractSpineThroughMigration31) || canonicalComparable(observed.currentAuthorityAudit) !== canonicalComparable(audit.currentAuthorityAudit) || hashCanonicalJson(observed.currentAuthorityAudit) !== audit.currentAuthorityAuditHash) currentEntryFail("legacy zero-owner current v31 audit drifted");
}

function legacyZeroPathV1(hash: string): string {
  return path.join(fixedRepositoryRoot(), LEGACY_ZERO_STORE_V1, "records", "sha256", hash.slice(0, 2), `${hash}.json`);
}

function publishLegacyZeroRecordV1(target: string, bytes: Buffer): void {
  const codeRoot = fixedRepositoryRoot();
  const relativeDirectory = path.relative(codeRoot, path.dirname(target));
  if (!relativeDirectory || relativeDirectory.startsWith("..") || path.isAbsolute(relativeDirectory)) currentEntryFail("legacy zero-owner store escaped the repository");
  const repository = directorySnapshot(codeRoot, "legacy zero-owner repository");
  let directory = codeRoot;
  for (const segment of relativeDirectory.split(path.sep)) {
    directory = path.join(directory, segment);
    try { mkdirSync(directory, { mode: 0o700 }); } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
    }
    const observed = directorySnapshot(directory, `legacy zero-owner store ${segment}`, repository.device);
    if (observed.identity.mode !== 0o700) currentEntryFail("legacy zero-owner store mode is invalid");
  }
  const basename = path.basename(target);
  const adoptFinal = (expectedLinkCount = 1): boolean => {
    try {
      const observed = readStableRegular(target, CURRENT_ENTRY_MAX_BYTES, repository.device, expectedLinkCount);
      if (observed.mode !== 0o600 || !observed.bytes.equals(bytes)) currentEntryFail("legacy zero-owner final collision is crossed");
      return true;
    } catch (error) {
      if (isEnoent(error)) return false;
      throw error;
    }
  };
  if (adoptFinal()) return;
  const familyPrefix = `.${basename}.`;
  const family = readdirSync(directory).filter((name) => name.startsWith(familyPrefix));
  if (family.length > 1) currentEntryFail("legacy zero-owner publication recovery is ambiguous");
  let temp: string;
  if (family.length === 1) {
    temp = path.join(directory, family[0]!);
    const observed = readStableRegular(temp, CURRENT_ENTRY_MAX_BYTES, repository.device, 1);
    if (observed.mode !== 0o600 || !observed.bytes.equals(bytes)) currentEntryFail("legacy zero-owner recovery temp is crossed");
  } else {
    temp = path.join(directory, `${familyPrefix}${randomUUID()}.tmp`);
    const descriptor = openSync(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
      fchmodSync(descriptor, 0o600);
      writeFileSync(descriptor, bytes);
      fsyncSync(descriptor);
    } finally { closeSync(descriptor); }
  }
  let linked = true;
  try { linkSync(temp, target); } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
    linked = false;
  }
  fsyncCurrentEntryDirectory(directory);
  if (!adoptFinal(linked ? 2 : 1)) currentEntryFail("legacy zero-owner final publication is absent");
  const tempStats = lstatSync(temp, { bigint: true });
  const finalStats = lstatSync(target, { bigint: true });
  if (linked) {
    if (tempStats.dev !== finalStats.dev || tempStats.ino !== finalStats.ino || tempStats.nlink !== 2n || finalStats.nlink !== 2n) currentEntryFail("legacy zero-owner publication inode proof failed");
  } else if (tempStats.nlink !== 1n || finalStats.nlink !== 1n) currentEntryFail("legacy zero-owner contention proof failed");
  unlinkSync(temp);
  fsyncCurrentEntryDirectory(directory);
  if (!adoptFinal()) currentEntryFail("legacy zero-owner final adoption failed");
}

async function parseLegacyZeroV1(value: Record<string, unknown>, pair: InternalProductionLegacyPreManifestZeroOwnerObservationPairV1): Promise<InternalProductionLegacyPreManifestZeroOwnerObservationV1> {
  if (!hasExactKeys(value, ["schema", "observationKind", "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "cleanSetfarmSourceSha", "cleanSetfarmTreeHash", "cleanSetfarmBuildHash", "observedSpawnerGenerationHash", "census", "allThirtySixScalarCountsZero", "ownerReservationSidecarState", "ownerAdmissionHeadState", "manifestActivationState", "observationRef", "observationHash"])) currentEntryFail("legacy zero-owner fields are invalid");
  const projection = { ...value };
  delete projection.observationRef;
  delete projection.observationHash;
  const hash = requireSha256(value.observationHash, "legacy zero-owner hash");
  if (hashCanonicalJson(projection) !== hash || value.observationRef !== `${LEGACY_ZERO_PREFIX_V1}${hash}` || pair.observationRef !== value.observationRef || pair.observationHash !== hash) currentEntryFail("legacy zero-owner pair/hash is invalid");
  const census = value.census;
  if (value.schema !== "setfarm.internal-production-legacy-pre-manifest-zero-owner-observation.v1" || value.observationKind !== "legacy-pre-manifest-existing-live-truth" || value.allThirtySixScalarCountsZero !== true || value.ownerReservationSidecarState !== "absent-before-migration-32" || value.ownerAdmissionHeadState !== "absent-before-migration-32" || value.manifestActivationState !== "absent-before-initial-a-activation" || !isPlainRecord(census) || !hasExactKeys(census, COMPLETE_ZERO_CENSUS_KEYS_V1) || COMPLETE_ZERO_CENSUS_KEYS_V1.some((key) => census[key] !== 0)) currentEntryFail("legacy zero-owner body is invalid");
  const auditPair = requirePair(
    { authorityV3Migration31AuditRef: value.authorityV3Migration31AuditRef, authorityV3Migration31AuditHash: value.authorityV3Migration31AuditHash },
    "authorityV3Migration31AuditRef",
    "authorityV3Migration31AuditHash",
    "setfarm://internal-production/authority-v3-migration31-audit/sha256/",
  ) as InternalProductionAuthorityV3Migration31AuditPairV1;
  const audit = await resolveInternalProductionAuthorityV3Migration31AuditV1(auditPair);
  const cleanSource = requireSource({
    branch: "main",
    clean: true,
    sha: value.cleanSetfarmSourceSha,
    treeHash: value.cleanSetfarmTreeHash,
    buildHash: value.cleanSetfarmBuildHash,
    originMainSha: value.cleanSetfarmSourceSha,
  });
  if (canonicalComparable(audit.controllerSource) !== canonicalComparable(cleanSource)) currentEntryFail("legacy zero-owner audit/source is crossed");
  requireSha256(value.observedSpawnerGenerationHash, "legacy zero-owner spawner generation");
  return recursivelyFreeze(value as unknown as InternalProductionLegacyPreManifestZeroOwnerObservationV1);
}

export async function observeInternalProductionLegacyPreManifestZeroOwnerV1(): Promise<InternalProductionLegacyPreManifestZeroOwnerObservationV1> {
  const operation = await observePreparedInternalProductionCurrentEntryOperationV1();
  if (operation === null) currentEntryFail("legacy zero-owner observation requires the prepared current-entry operation");
  const auditPair = requirePair(operation.authorityV3Migration31Audit, "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "setfarm://internal-production/authority-v3-migration31-audit/sha256/") as InternalProductionAuthorityV3Migration31AuditPairV1;
  const audit = await resolveInternalProductionAuthorityV3Migration31AuditV1(auditPair);
  const source = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  if (canonicalComparable(source) !== canonicalComparable(operation.controllerSource) || canonicalComparable(source) !== canonicalComparable(audit.controllerSource)) currentEntryFail("legacy zero-owner controller source is crossed");
  await reobserveStoredMigration31AuditV1(audit);
  const phaseA = await observePhaseClosedZeroV1(source);
  const servicesA = await observeInternalProductionServiceCensusV1();
  const physicalA = observePhysicalInventoryV1(servicesA, 0);
  const database = await observeLegacyDatabaseCensusV1();
  const servicesB = await observeInternalProductionServiceCensusV1();
  const physicalB = observePhysicalInventoryV1(servicesB, database.activeRunCount);
  const phaseB = await observePhaseClosedZeroV1(source);
  const auditAgain = await resolveInternalProductionAuthorityV3Migration31AuditV1(auditPair);
  await reobserveStoredMigration31AuditV1(auditAgain);
  if (
    canonicalComparable(servicesA) !== canonicalComparable(servicesB)
    || canonicalComparable(phaseA) !== canonicalComparable(phaseB)
    || canonicalComparable(audit) !== canonicalComparable(auditAgain)
  ) currentEntryFail("legacy zero-owner observation changed across its database snapshot");
  assertPhysicalInventoryPassStableV1(physicalA, physicalB);
  const census = recursivelyFreeze({
    activeRunCount: database.activeRunCount,
    openClaimCount: database.openClaimCount,
    executionAttemptCount: database.executionAttemptCount,
    activeRuntimeSessionCount: database.activeRuntimeSessionCount,
    activeCompletionOwnerCount: database.activeCompletionOwnerCount,
    unsettledMandatoryEffectCount: database.unsettledMandatoryEffectCount,
    ordinaryStartingCount: phaseA.ordinaryStartingCount,
    restartReservationCount: phaseA.restartReservationCount,
    serviceRestartOperationCount: phaseA.serviceRestartOperationCount,
    launchPreparationCount: phaseA.launchPreparationCount,
    preparedLaunchCount: phaseA.preparedLaunchCount,
    stagedCaseCount: phaseA.stagedCaseCount,
    fixtureAttemptCount: phaseA.fixtureAttemptCount,
    artifactReservationCount: database.artifactReservationCount,
    publicationBatchCount: database.publicationBatchCount,
    artifactPublicationCount: database.artifactPublicationCount,
    docsSessionCount: phaseA.docsSessionCount,
    docsLeaseCount: phaseA.docsLeaseCount,
    fleetStageCount: phaseA.fleetStageCount,
    fleetInflightCount: phaseA.fleetInflightCount,
    fleetPendingReviewCount: phaseA.fleetPendingReviewCount,
    matrixInflightCount: phaseA.matrixInflightCount,
    launchOutboxCount: phaseA.launchOutboxCount,
    terminationOwnerCount: database.terminationOwnerCount,
    findingOwnerCount: database.findingOwnerCount,
    recoveryOwnerCount: database.recoveryOwnerCount,
    operationalDeliveryCount: database.operationalDeliveryCount,
    sourceRunOwnerCount: phaseA.sourceRunOwnerCount,
    coldRehearsalOwnerCount: phaseA.coldRehearsalOwnerCount,
    compilationLeaseCount: phaseA.compilationLeaseCount,
    executionLeaseCount: phaseA.executionLeaseCount,
    ownedProcessCount: physicalA.ownedProcessCount,
    ownedListenerCount: physicalA.ownedListenerCount,
    ownedWorktreeCount: physicalA.ownedWorktreeCount,
    dirtyWorktreeCount: physicalA.dirtyWorktreeCount,
    staleChildCount: physicalA.staleChildCount,
  } satisfies InternalProductionCompleteZeroOwnerCensusV1);
  for (const key of COMPLETE_ZERO_CENSUS_KEYS_V1) if (census[key] !== 0) currentEntryFail(`${key} is nonzero`);
  const body = {
    schema: "setfarm.internal-production-legacy-pre-manifest-zero-owner-observation.v1" as const,
    observationKind: "legacy-pre-manifest-existing-live-truth" as const,
    authorityV3Migration31AuditRef: audit.authorityV3Migration31AuditRef,
    authorityV3Migration31AuditHash: audit.authorityV3Migration31AuditHash,
    cleanSetfarmSourceSha: audit.controllerSource.sha,
    cleanSetfarmTreeHash: audit.controllerSource.treeHash,
    cleanSetfarmBuildHash: audit.controllerSource.buildHash,
    observedSpawnerGenerationHash: servicesA.spawner.generationHash,
    census,
    allThirtySixScalarCountsZero: true as const,
    ownerReservationSidecarState: "absent-before-migration-32" as const,
    ownerAdmissionHeadState: "absent-before-migration-32" as const,
    manifestActivationState: "absent-before-initial-a-activation" as const,
  };
  const observationHash = hashCanonicalJson(body);
  const value = recursivelyFreeze({ ...body, observationRef: `${LEGACY_ZERO_PREFIX_V1}${observationHash}`, observationHash });
  const bytes = await canonicalRecordBytes(value);
  const target = legacyZeroPathV1(observationHash);
  publishLegacyZeroRecordV1(target, bytes);
  return resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1({ observationRef: value.observationRef, observationHash });
}

export async function resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1(
  pair: InternalProductionLegacyPreManifestZeroOwnerObservationPairV1,
): Promise<InternalProductionLegacyPreManifestZeroOwnerObservationV1> {
  const expected = requirePair(pair, "observationRef", "observationHash", LEGACY_ZERO_PREFIX_V1) as InternalProductionLegacyPreManifestZeroOwnerObservationPairV1;
  const target = legacyZeroPathV1(expected.observationHash);
  const bytes = readStableRegular(target, CURRENT_ENTRY_MAX_BYTES, lstatSync(path.dirname(target), { bigint: true }).dev, 1).bytes;
  return await parseLegacyZeroV1(strictCanonicalRecord(bytes, "legacy zero-owner observation"), expected);
}
