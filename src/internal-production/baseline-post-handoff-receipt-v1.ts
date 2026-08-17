import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import type { BigIntStats } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

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
