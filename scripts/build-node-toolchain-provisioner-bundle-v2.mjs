#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build, version as esbuildVersion } from "esbuild";

const EXPECTED_ESBUILD_VERSION = "0.28.1";
const MAX_BUNDLE_BYTES = 32 * 1024 * 1024;
const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = realpathSync(path.resolve(path.dirname(scriptPath), ".."));
const entrypoint = path.join(
  repositoryRoot,
  "src/product-compiler/node-toolchain-provisioner-bootstrap-entry-v2.ts",
);

function fail(message) {
  throw new Error(message.slice(0, 1_000));
}

function parseArgv(argv) {
  if (
    argv.length !== 2
    || argv[0] !== "--out-file"
    || typeof argv[1] !== "string"
    || argv[1].length < 1
    || argv[1].length > 4_096
    || argv[1].includes("\0")
    || !path.isAbsolute(argv[1])
    || path.normalize(argv[1]) !== argv[1]
  ) {
    fail("Usage: build-node-toolchain-provisioner-bundle-v2.mjs --out-file ABSOLUTE_PATH");
  }
  return argv[1];
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function writeExclusive(filePath, bytes) {
  const parent = path.dirname(filePath);
  const parentStat = lstatSync(parent);
  if (
    parentStat.isSymbolicLink()
    || !parentStat.isDirectory()
    || realpathSync(parent) !== parent
    || (parentStat.mode & 0o7777) !== 0o700
    || parentStat.uid !== process.getuid()
    || parentStat.gid !== process.getgid()
  ) {
    fail("Bundle output parent must be one real process-owned mode-0700 directory");
  }
  let descriptor;
  try {
    descriptor = openSync(
      filePath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = writeSync(descriptor, bytes, offset, bytes.byteLength - offset);
      if (count < 1) fail("Bundle output write ended before its exact byte length");
      offset += count;
    }
    fsyncSync(descriptor);
    const stat = fstatSync(descriptor);
    if (
      !stat.isFile()
      || stat.nlink !== 1
      || stat.size !== bytes.byteLength
      || stat.uid !== process.getuid()
      || stat.gid !== process.getgid()
      || (stat.mode & 0o7777) !== 0o600
    ) {
      fail("Bundle output metadata changed before publication");
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  const parentDescriptor = openSync(parent, constants.O_RDONLY);
  try {
    fsyncSync(parentDescriptor);
  } finally {
    closeSync(parentDescriptor);
  }

  let readDescriptor;
  const observed = Buffer.allocUnsafeSlow(bytes.byteLength);
  try {
    readDescriptor = openSync(
      filePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(readDescriptor);
    let offset = 0;
    while (offset < observed.byteLength) {
      const count = readSync(
        readDescriptor,
        observed,
        offset,
        observed.byteLength - offset,
        null,
      );
      if (count < 1) fail("Bundle output ended before fresh verification completed");
      offset += count;
    }
    const eof = Buffer.allocUnsafe(1);
    if (readSync(readDescriptor, eof, 0, 1, null) !== 0) {
      fail("Bundle output exceeded its published byte length");
    }
    const after = fstatSync(readDescriptor);
    if (
      before.dev !== after.dev
      || before.ino !== after.ino
      || before.mode !== after.mode
      || before.uid !== after.uid
      || before.gid !== after.gid
      || before.nlink !== after.nlink
      || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs
      || before.ctimeMs !== after.ctimeMs
      || !observed.equals(bytes)
    ) {
      fail("Bundle output changed before fresh byte verification completed");
    }
  } finally {
    observed.fill(0);
    if (readDescriptor !== undefined) closeSync(readDescriptor);
  }
}

export async function buildNodeToolchainProvisionerBundleV2(outFile) {
  if (Object.keys(process.env).some((key) => key.toUpperCase().startsWith("ESBUILD_"))) {
    fail("Ambient ESBUILD_* overrides are forbidden");
  }
  if (esbuildVersion !== EXPECTED_ESBUILD_VERSION) {
    fail(`Expected esbuild ${EXPECTED_ESBUILD_VERSION}, received ${esbuildVersion}`);
  }
  const result = await build({
    absWorkingDir: repositoryRoot,
    entryPoints: [entrypoint],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    treeShaking: true,
    sourcemap: false,
    legalComments: "none",
    charset: "utf8",
    logLevel: "silent",
    metafile: true,
    write: false,
  });
  if (result.outputFiles.length !== 1) fail("Provisioner bundler must produce exactly one file");
  const externalImports = Object.values(result.metafile.outputs)
    .flatMap((output) => output.imports)
    .filter((entry) => entry.external)
    .map((entry) => entry.path)
    .sort();
  if (externalImports.some((locator) => !locator.startsWith("node:"))) {
    fail("Provisioner bundle retained a non-Node external dependency");
  }
  const bytes = Buffer.from(result.outputFiles[0].contents);
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_BUNDLE_BYTES) {
    fail("Provisioner bundle is outside its exact byte bound");
  }
  writeExclusive(outFile, bytes);
  return Object.freeze({
    schema: "setfarm.node-toolchain-provisioner-bundle-build-receipt.v2",
    bundler: Object.freeze({
      packageName: "esbuild",
      version: EXPECTED_ESBUILD_VERSION,
      format: "cjs",
      platform: "node",
      target: "node22",
    }),
    externalNodeBuiltins: Object.freeze([...new Set(externalImports)]),
    bundle: Object.freeze({
      byteLength: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }),
  });
}

async function main() {
  const receipt = await buildNodeToolchainProvisionerBundleV2(parseArgv(process.argv.slice(2)));
  process.stdout.write(Buffer.from(canonicalJson(receipt), "utf8"));
}

if (process.argv[1] && realpathSync(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(
      `[build-node-toolchain-provisioner-bundle-v2] ${error instanceof Error ? error.message : "failed"}\n`,
    );
    process.exitCode = 1;
  });
}
