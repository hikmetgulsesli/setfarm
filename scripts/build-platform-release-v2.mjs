#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const MAX_SOURCE_FILES = 20_000;
const MAX_SOURCE_DIRECTORIES = 4_000;
const MAX_SOURCE_FILE_BYTES = 64 * 1024 * 1024;
const MAX_SOURCE_TOTAL_BYTES = 512 * 1024 * 1024;
const MAX_OUTPUT_FILES = 20_000;
const MAX_OUTPUT_DIRECTORIES = 4_000;
const MAX_OUTPUT_TOTAL_BYTES = 512 * 1024 * 1024;
const MAX_PROCESS_OUTPUT_BYTES = 1024 * 1024;
const FULL_GIT_HASH = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const CANONICAL_EPOCH = /^(?:0|[1-9][0-9]*)$/;
const PORTABLE_RELATIVE_PATH =
  /^(?:[A-Za-z0-9._@+-]+)(?:\/[A-Za-z0-9._@+-]+)*$/;

class PlatformReleaseBuildCommandV2Error extends Error {
  constructor(code, message, options) {
    super(`${code}: ${message}`, options);
    this.name = "PlatformReleaseBuildCommandV2Error";
    this.code = code;
  }
}

function fail(code, message, cause) {
  throw new PlatformReleaseBuildCommandV2Error(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function canonicalJson(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("RESULT_INVALID", "Non-finite result number");
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (
    typeof value === "object"
    && Object.getPrototypeOf(value) === Object.prototype
  ) {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
    ).join(",")}}`;
  }
  fail("RESULT_INVALID", "Unsupported canonical result value");
}

function parseArguments(argv) {
  if (argv.length !== 10) {
    fail(
      "ARGUMENTS_INVALID",
      "Expected source root, output root, TypeScript entry, source SHA and source epoch",
    );
  }
  const expectedNames = [
    "--source-root",
    "--output-root",
    "--typescript-entry",
    "--source-sha",
    "--source-date-epoch",
  ];
  const values = {};
  for (let index = 0; index < expectedNames.length; index += 1) {
    const name = expectedNames[index];
    if (argv[index * 2] !== name) {
      fail("ARGUMENTS_INVALID", `Expected ${name} in canonical argument order`);
    }
    values[name] = argv[(index * 2) + 1];
  }
  if (
    !FULL_GIT_HASH.test(values["--source-sha"])
    || !CANONICAL_EPOCH.test(values["--source-date-epoch"])
  ) {
    fail("ARGUMENTS_INVALID", "Source SHA or epoch is invalid");
  }
  return Object.freeze({
    sourceRoot: anchorDirectory(
      values["--source-root"],
      0o555,
      "SOURCE_ROOT_INVALID",
    ),
    outputRoot: anchorDirectory(
      values["--output-root"],
      0o700,
      "OUTPUT_ROOT_INVALID",
    ),
    typescriptEntry: anchorFile(
      values["--typescript-entry"],
      "TYPESCRIPT_ENTRY_INVALID",
    ),
    sourceSha: values["--source-sha"],
    sourceDateEpoch: values["--source-date-epoch"],
  });
}

function normalizedAbsolute(value) {
  return typeof value === "string"
    && value.length > 0
    && Buffer.byteLength(value, "utf8") <= 4_096
    && path.isAbsolute(value)
    && path.normalize(value) === value
    && value !== path.parse(value).root;
}

function anchorDirectory(value, mode, code) {
  if (!normalizedAbsolute(value)) {
    fail(code, "Expected one normalized absolute directory path");
  }
  let stat;
  let real;
  try {
    stat = lstatSync(value);
    real = realpathSync(value);
  } catch (error) {
    fail(code, "Directory cannot be inspected", error);
  }
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || real !== value
    || (stat.mode & 0o7777) !== mode
  ) {
    fail(code, `Expected one real ${mode.toString(8)} directory`);
  }
  return Object.freeze({
    path: value,
    dev: stat.dev,
    ino: stat.ino,
    mode,
  });
}

function anchorFile(value, code) {
  if (!normalizedAbsolute(value)) {
    fail(code, "Expected one normalized absolute file path");
  }
  let descriptor;
  try {
    descriptor = openSync(
      value,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const stat = fstatSync(descriptor);
    const real = realpathSync(value);
    if (
      !stat.isFile()
      || stat.nlink !== 1
      || stat.size < 1
      || stat.size > MAX_SOURCE_FILE_BYTES
      || real !== value
    ) {
      fail(
        code,
        "TypeScript entry must be one real bounded regular file",
      );
    }
    return Object.freeze({
      path: real,
      dev: stat.dev,
      ino: stat.ino,
      size: stat.size,
      hash: hashDescriptor(descriptor),
    });
  } catch (error) {
    if (error instanceof PlatformReleaseBuildCommandV2Error) throw error;
    return fail(code, "TypeScript entry cannot be inspected", error);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function assertDirectoryAnchor(anchor, code) {
  const stat = lstatSync(anchor.path);
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || stat.dev !== anchor.dev
    || stat.ino !== anchor.ino
    || realpathSync(anchor.path) !== anchor.path
    || (stat.mode & 0o7777) !== anchor.mode
  ) {
    fail(code, "Directory identity changed during build");
  }
}

function assertFileAnchor(anchor) {
  let descriptor;
  try {
    descriptor = openSync(
      anchor.path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const stat = fstatSync(descriptor);
    if (
      !stat.isFile()
      || stat.dev !== anchor.dev
      || stat.ino !== anchor.ino
      || stat.size !== anchor.size
      || hashDescriptor(descriptor) !== anchor.hash
    ) {
      fail("TYPESCRIPT_ENTRY_CHANGED", "TypeScript entry changed during build");
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function hashDescriptor(descriptor) {
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(64 * 1024);
  let total = 0;
  while (true) {
    const bytesRead = readSync(
      descriptor,
      buffer,
      0,
      buffer.length,
      null,
    );
    if (bytesRead === 0) break;
    total += bytesRead;
    if (total > MAX_SOURCE_FILE_BYTES) {
      fail("FILE_TOO_LARGE", "File exceeds command byte limit");
    }
    hash.update(buffer.subarray(0, bytesRead));
  }
  return hash.digest("hex");
}

function readStableFile(absolute, expectedStat, code) {
  let descriptor;
  try {
    descriptor = openSync(
      absolute,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (
      !before.isFile()
      || before.nlink !== 1
      || before.dev !== expectedStat.dev
      || before.ino !== expectedStat.ino
      || before.size !== expectedStat.size
      || before.mode !== expectedStat.mode
      || before.mtimeMs !== expectedStat.mtimeMs
      || before.ctimeMs !== expectedStat.ctimeMs
      || before.size > MAX_SOURCE_FILE_BYTES
    ) {
      fail(code, `${absolute} changed before stable read`);
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    if (
      bytes.byteLength !== before.size
      || after.dev !== before.dev
      || after.ino !== before.ino
      || after.size !== before.size
      || after.mode !== before.mode
      || after.mtimeMs !== before.mtimeMs
      || after.ctimeMs !== before.ctimeMs
    ) {
      fail(code, `${absolute} changed during stable read`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof PlatformReleaseBuildCommandV2Error) throw error;
    return fail(code, `${absolute} cannot be read safely`, error);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function assertEmptyOutput(anchor) {
  assertDirectoryAnchor(anchor, "OUTPUT_ROOT_CHANGED");
  if (readdirSync(anchor.path).length !== 0) {
    fail("OUTPUT_ROOT_NOT_EMPTY", "Output root must be empty");
  }
}

function portableRelative(relative) {
  return relative.length > 0
    && relative.length <= 1_024
    && PORTABLE_RELATIVE_PATH.test(relative)
    && relative.split("/").length <= 64;
}

function sourceFingerprint(root) {
  const entries = [];
  let fileCount = 0;
  let directoryCount = 0;
  let totalBytes = 0;

  function visit(absolute, relative) {
    const before = lstatSync(absolute);
    if (before.isSymbolicLink() || !before.isDirectory()) {
      fail("SOURCE_TREE_INVALID", `${relative || "."} is not a real directory`);
    }
    if ((before.mode & 0o7777) !== 0o555) {
      fail("SOURCE_TREE_INVALID", `${relative || "."} is not mode 0555`);
    }
    const names = readdirSync(absolute).sort();
    for (const name of names) {
      const childRelative = relative ? `${relative}/${name}` : name;
      if (!portableRelative(childRelative)) {
        fail("SOURCE_TREE_INVALID", `${childRelative} is not portable`);
      }
      const child = path.join(absolute, name);
      const stat = lstatSync(child);
      if (stat.isSymbolicLink()) {
        fail("SOURCE_TREE_INVALID", `${childRelative} is a symbolic link`);
      }
      if (stat.isDirectory()) {
        directoryCount += 1;
        if (directoryCount > MAX_SOURCE_DIRECTORIES) {
          fail("SOURCE_TREE_INVALID", "Source directory limit exceeded");
        }
        entries.push({
          path: childRelative,
          type: "directory",
          mode: (stat.mode & 0o7777).toString(8).padStart(4, "0"),
        });
        visit(child, childRelative);
        continue;
      }
      if (
        !stat.isFile()
        || stat.nlink !== 1
        || ![0o444, 0o555].includes(stat.mode & 0o7777)
        || stat.size < 0
        || stat.size > MAX_SOURCE_FILE_BYTES
      ) {
        fail("SOURCE_TREE_INVALID", `${childRelative} is not a canonical file`);
      }
      fileCount += 1;
      totalBytes += stat.size;
      if (
        fileCount > MAX_SOURCE_FILES
        || totalBytes > MAX_SOURCE_TOTAL_BYTES
      ) {
        fail("SOURCE_TREE_INVALID", "Source file or byte limit exceeded");
      }
      const bytes = readStableFile(
        child,
        stat,
        "SOURCE_TREE_CHANGED",
      );
      const after = lstatSync(child);
      if (
        after.dev !== stat.dev
        || after.ino !== stat.ino
        || after.size !== stat.size
        || after.mode !== stat.mode
        || after.mtimeMs !== stat.mtimeMs
        || after.ctimeMs !== stat.ctimeMs
      ) {
        fail("SOURCE_TREE_CHANGED", `${childRelative} changed during hashing`);
      }
      entries.push({
        path: childRelative,
        type: "file",
        mode: (stat.mode & 0o7777).toString(8).padStart(4, "0"),
        byteLength: bytes.byteLength,
        contentHash: createHash("sha256").update(bytes).digest("hex"),
      });
    }
    const afterNames = readdirSync(absolute).sort();
    const after = lstatSync(absolute);
    if (
      JSON.stringify(names) !== JSON.stringify(afterNames)
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.mode !== after.mode
      || before.mtimeMs !== after.mtimeMs
      || before.ctimeMs !== after.ctimeMs
    ) {
      fail("SOURCE_TREE_CHANGED", `${relative || "."} changed during traversal`);
    }
  }

  visit(root.path, "");
  return Object.freeze({
    fileCount,
    directoryCount,
    totalBytes,
    fingerprintHash: createHash("sha256")
      .update(canonicalJson({
        schema: "setfarm.platform-release-build-source-fingerprint.v2",
        entries,
        fileCount,
        directoryCount,
        totalBytes,
      }))
      .digest("hex"),
  });
}

function createDirectory(absolute) {
  mkdirSync(absolute, { mode: 0o700 });
}

function ensurePrivateDirectory(root, relative) {
  if (relative === "") return;
  if (!portableRelative(relative)) {
    fail("ASSET_DESTINATION_INVALID", `${relative} is not portable`);
  }
  let current = root;
  for (const component of relative.split("/")) {
    current = path.join(current, component);
    try {
      createDirectory(current);
    } catch (error) {
      if (error?.code !== "EEXIST") {
        fail(
          "ASSET_DESTINATION_INVALID",
          `${relative} cannot be created`,
          error,
        );
      }
    }
    const stat = lstatSync(current);
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(current) !== current
    ) {
      fail(
        "ASSET_DESTINATION_INVALID",
        `${relative} contains a non-real directory`,
      );
    }
  }
}

function copyExclusive(source, destination, destinationRoot) {
  const destinationRelative = path.relative(destinationRoot, destination);
  if (
    !portableRelative(destinationRelative)
    || destinationRelative.startsWith("..")
  ) {
    fail(
      "ASSET_DESTINATION_INVALID",
      "Asset destination escaped its private root",
    );
  }
  ensurePrivateDirectory(
    destinationRoot,
    path.posix.dirname(destinationRelative) === "."
      ? ""
      : path.posix.dirname(destinationRelative),
  );
  const sourceStat = lstatSync(source);
  if (
    sourceStat.isSymbolicLink()
    || !sourceStat.isFile()
    || sourceStat.nlink !== 1
    || ![0o444, 0o555].includes(sourceStat.mode & 0o7777)
    || sourceStat.size > MAX_SOURCE_FILE_BYTES
  ) {
    fail("ASSET_SOURCE_INVALID", `${source} is not a canonical source file`);
  }
  const bytes = readStableFile(source, sourceStat, "ASSET_SOURCE_CHANGED");
  writeFileSync(destination, bytes, { flag: "wx", mode: 0o600 });
}

function walkMarkdownFiles(root) {
  const out = [];
  function visit(absolute, relative) {
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      fail("ASSET_SOURCE_INVALID", `${relative || "."} is not a directory`);
    }
    for (const name of readdirSync(absolute).sort()) {
      const childRelative = relative ? `${relative}/${name}` : name;
      if (!portableRelative(childRelative)) {
        fail("ASSET_SOURCE_INVALID", `${childRelative} is not portable`);
      }
      const child = path.join(absolute, name);
      const childStat = lstatSync(child);
      if (childStat.isSymbolicLink()) {
        fail("ASSET_SOURCE_INVALID", `${childRelative} is a symbolic link`);
      }
      if (childStat.isDirectory()) visit(child, childRelative);
      else if (
        childStat.isFile()
        && childStat.nlink === 1
        && [0o444, 0o555].includes(childStat.mode & 0o7777)
        && childStat.size <= MAX_SOURCE_FILE_BYTES
        && name.endsWith(".md")
      ) {
        out.push({ absolute: child, relative: childRelative });
      } else if (!childStat.isFile()) {
        fail("ASSET_SOURCE_INVALID", `${childRelative} is not a regular file`);
      }
    }
  }
  visit(root, "");
  return out;
}

function copyRuntimeAssets(sourceRoot, distRoot) {
  copyExclusive(
    path.join(sourceRoot, "src", "server", "index.html"),
    path.join(distRoot, "server", "index.html"),
    distRoot,
  );
  copyExclusive(
    path.join(sourceRoot, "src", "installer", "compat-rules.json"),
    path.join(distRoot, "installer", "compat-rules.json"),
    distRoot,
  );
  const promptRoot = path.join(sourceRoot, "src", "installer", "prompts");
  for (const entry of walkMarkdownFiles(promptRoot)) {
    copyExclusive(
      entry.absolute,
      path.join(distRoot, "installer", "prompts", entry.relative),
      distRoot,
    );
  }
  const stepRoot = path.join(sourceRoot, "src", "installer", "steps");
  for (const entry of walkMarkdownFiles(stepRoot)) {
    copyExclusive(
      entry.absolute,
      path.join(distRoot, "installer", "steps", entry.relative),
      distRoot,
    );
  }
  copyExclusive(
    path.join(sourceRoot, "scripts", "stitch-to-jsx.mjs"),
    path.join(distRoot, "legacy-assets", "stitch-to-jsx.mjs"),
    distRoot,
  );
}

function deterministicBuildInfo(sourceRoot, sourceSha, epoch) {
  let packageJson;
  try {
    const packagePath = path.join(sourceRoot, "package.json");
    const packageStat = lstatSync(packagePath);
    packageJson = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        readStableFile(
          packagePath,
          packageStat,
          "PACKAGE_JSON_CHANGED",
        ),
      ),
    );
  } catch (error) {
    return fail("PACKAGE_JSON_INVALID", "Source package.json is invalid", error);
  }
  if (
    !packageJson
    || typeof packageJson !== "object"
    || packageJson.name !== "setfarm"
    || typeof packageJson.version !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(packageJson.version)
  ) {
    fail("PACKAGE_JSON_INVALID", "Source package identity is invalid");
  }
  const builtAt = new Date(Number(epoch) * 1_000);
  if (!Number.isFinite(builtAt.valueOf())) {
    fail("ARGUMENTS_INVALID", "Source epoch is outside JavaScript date range");
  }
  return {
    branch: "main",
    builtAt: builtAt.toISOString(),
    dirty: false,
    displayVersion: `${packageJson.version}+${sourceSha.slice(0, 8)}`,
    packageVersion: packageJson.version,
    sha: sourceSha,
    shortSha: sourceSha.slice(0, 8),
  };
}

function runTypeScript(input, distRoot) {
  assertFileAnchor(input.typescriptEntry);
  const result = spawnSync(
    process.execPath,
    [
      input.typescriptEntry.path,
      "-p",
      path.join(input.sourceRoot.path, "tsconfig.json"),
      "--outDir",
      distRoot,
      "--rootDir",
      path.join(input.sourceRoot.path, "src"),
    ],
    {
      cwd: input.sourceRoot.path,
      env: {
        CI: "true",
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
        NO_COLOR: "1",
        SOURCE_DATE_EPOCH: input.sourceDateEpoch,
        TZ: "UTC",
      },
      encoding: "utf8",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
      maxBuffer: MAX_PROCESS_OUTPUT_BYTES,
    },
  );
  if (
    result.error
    || result.signal !== null
    || result.status !== 0
  ) {
    const detail = String(result.stderr || result.error || "")
      .slice(0, 1_000)
      .replaceAll(input.sourceRoot.path, "<SOURCE_ROOT>")
      .replaceAll(input.outputRoot.path, "<OUTPUT_ROOT>")
      .replaceAll(input.typescriptEntry.path, "<TYPESCRIPT_ENTRY>");
    fail(
      "TYPESCRIPT_BUILD_FAILED",
      `TypeScript exited status=${String(result.status)} signal=${String(result.signal)} detail=${detail}`,
      result.error,
    );
  }
  if (result.stdout.length !== 0 || result.stderr.length !== 0) {
    fail(
      "TYPESCRIPT_BUILD_OUTPUT_UNEXPECTED",
      "Successful TypeScript execution must produce empty stdout and stderr",
    );
  }
  assertFileAnchor(input.typescriptEntry);
}

function normalizeAndFsyncTree(root, executableRelativePaths) {
  const executableSet = new Set(executableRelativePaths);
  const directoryPaths = [];
  let fileCount = 0;
  let directoryCount = 0;
  let totalBytes = 0;

  function visit(absolute, relative) {
    directoryPaths.push(absolute);
    for (const name of readdirSync(absolute).sort()) {
      const child = path.join(absolute, name);
      const childRelative = relative ? `${relative}/${name}` : name;
      if (!portableRelative(childRelative)) {
        fail("OUTPUT_TREE_INVALID", `${childRelative} is not portable`);
      }
      const stat = lstatSync(child);
      if (stat.isSymbolicLink()) {
        fail("OUTPUT_TREE_INVALID", `${childRelative} is a symbolic link`);
      }
      if (stat.isDirectory()) {
        directoryCount += 1;
        if (directoryCount > MAX_OUTPUT_DIRECTORIES) {
          fail("OUTPUT_TREE_INVALID", "Output directory limit exceeded");
        }
        visit(child, childRelative);
        continue;
      }
      if (!stat.isFile() || stat.nlink !== 1) {
        fail("OUTPUT_TREE_INVALID", `${childRelative} is not a regular file`);
      }
      chmodSync(child, executableSet.has(childRelative) ? 0o555 : 0o444);
      const descriptor = openSync(
        child,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
      fileCount += 1;
      totalBytes += stat.size;
      if (
        fileCount > MAX_OUTPUT_FILES
        || stat.size > MAX_SOURCE_FILE_BYTES
        || totalBytes > MAX_OUTPUT_TOTAL_BYTES
      ) {
        fail("OUTPUT_TREE_INVALID", "Output file or byte limit exceeded");
      }
    }
  }
  visit(root, "");
  for (const directory of directoryPaths.reverse()) {
    chmodSync(directory, 0o555);
    const descriptor = openSync(
      directory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  }
  return Object.freeze({ fileCount, directoryCount, totalBytes });
}

function fsyncDirectory(absolute) {
  const descriptor = openSync(
    absolute,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function execute() {
  const input = parseArguments(process.argv.slice(2));
  if (
    input.sourceRoot.path === input.outputRoot.path
    || (
      input.sourceRoot.dev === input.outputRoot.dev
      && input.sourceRoot.ino === input.outputRoot.ino
    )
    || input.outputRoot.path.startsWith(`${input.sourceRoot.path}${path.sep}`)
    || input.sourceRoot.path.startsWith(`${input.outputRoot.path}${path.sep}`)
  ) {
    fail("ROOTS_OVERLAP", "Source and output roots must be disjoint");
  }
  assertEmptyOutput(input.outputRoot);
  const sourceBefore = sourceFingerprint(input.sourceRoot);
  const payloadRoot = path.join(input.outputRoot.path, "payload");
  const distRoot = path.join(payloadRoot, "dist");
  mkdirSync(payloadRoot, { mode: 0o700 });
  mkdirSync(distRoot, { mode: 0o700 });
  const payloadAnchor = anchorDirectory(
    payloadRoot,
    0o700,
    "OUTPUT_TREE_INVALID",
  );
  const distAnchor = anchorDirectory(
    distRoot,
    0o700,
    "OUTPUT_TREE_INVALID",
  );
  runTypeScript(input, distRoot);
  assertDirectoryAnchor(input.outputRoot, "OUTPUT_ROOT_CHANGED");
  assertDirectoryAnchor(payloadAnchor, "OUTPUT_TREE_CHANGED");
  assertDirectoryAnchor(distAnchor, "OUTPUT_TREE_CHANGED");
  copyRuntimeAssets(input.sourceRoot.path, distRoot);
  copyExclusive(
    path.join(input.sourceRoot.path, "package.json"),
    path.join(payloadRoot, "package.json"),
    payloadRoot,
  );
  const buildInfo = deterministicBuildInfo(
    input.sourceRoot.path,
    input.sourceSha,
    input.sourceDateEpoch,
  );
  writeFileSync(
    path.join(distRoot, "BUILD_INFO.json"),
    `${canonicalJson(buildInfo)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  const output = normalizeAndFsyncTree(
    distRoot,
    ["cli/cli.js"],
  );
  chmodSync(path.join(payloadRoot, "package.json"), 0o444);
  const packageDescriptor = openSync(
    path.join(payloadRoot, "package.json"),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    fsyncSync(packageDescriptor);
  } finally {
    closeSync(packageDescriptor);
  }
  fsyncDirectory(payloadRoot);
  fsyncDirectory(input.outputRoot.path);
  assertDirectoryAnchor(input.sourceRoot, "SOURCE_ROOT_CHANGED");
  assertDirectoryAnchor(input.outputRoot, "OUTPUT_ROOT_CHANGED");
  assertDirectoryAnchor(payloadAnchor, "OUTPUT_TREE_CHANGED");
  const sourceAfter = sourceFingerprint(input.sourceRoot);
  assertFileAnchor(input.typescriptEntry);
  if (
    canonicalJson(sourceBefore) !== canonicalJson(sourceAfter)
    || readdirSync(input.outputRoot.path).join("\0") !== "payload"
    || readdirSync(payloadRoot).sort().join("\0") !== "dist\0package.json"
  ) {
    fail(
      "SOURCE_OR_OUTPUT_CHANGED",
      "Source changed or output escaped the exact pre-dependency layout",
    );
  }
  const result = {
    schema: "setfarm.build-platform-release-command-result.v2",
    version: "2.0.0",
    sourceFingerprintHash: sourceAfter.fingerprintHash,
    sourceFileCount: sourceAfter.fileCount,
    sourceDirectoryCount: sourceAfter.directoryCount,
    sourceTotalBytes: sourceAfter.totalBytes,
    sourceSha: input.sourceSha,
    sourceDateEpoch: input.sourceDateEpoch,
    compilerEntryHash: input.typescriptEntry.hash,
    platformFileCount: output.fileCount,
    platformDirectoryCount: output.directoryCount,
    platformTotalBytes: output.totalBytes,
    outputLayout: "payload_dist_and_package_json_only",
    productionUse: "forbidden_until_dependency_materialization_and_manifest_verification",
  };
  process.stdout.write(`${canonicalJson(result)}\n`);
}

try {
  execute();
} catch (error) {
  const code = error instanceof PlatformReleaseBuildCommandV2Error
    ? error.code
    : "BUILD_PLATFORM_RELEASE_V2_FAILED";
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${code}: ${message.slice(0, 2_000)}\n`);
  process.exitCode = 1;
}
