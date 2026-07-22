import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  openSync,
  realpathSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EXPECTED_ESBUILD_VERSION = "0.28.1";
const ENTRYPOINT = "src/product-compiler/node-toolchain-provisioner-bootstrap-entry-v2.ts";
const MAX_BUNDLE_BYTES = 32 * 1024 * 1024;
const MAX_METADATA_BYTES = 4 * 1024 * 1024;

function fail(message) {
  throw new Error(message.slice(0, 1_000));
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function parseArgv(argv) {
  if (
    argv.length !== 8
    || argv[0] !== "--runtime"
    || argv[2] !== "--source-root"
    || argv[4] !== "--out-file"
    || argv[6] !== "--metadata-file"
  ) {
    return fail("Provisioner bundle builder received non-canonical argv");
  }
  const values = [argv[1], argv[3], argv[5], argv[7]];
  if (values.some((value) => (
    typeof value !== "string"
    || value.length < 1
    || value.length > 4_096
    || value.includes("\0")
    || !path.isAbsolute(value)
    || path.normalize(value) !== value
  ))) {
    return fail("Provisioner bundle builder paths must be normalized absolute locators");
  }
  return Object.freeze({
    runtime: argv[1],
    sourceRoot: argv[3],
    outFile: argv[5],
    metadataFile: argv[7],
  });
}

function writeExclusive(locator, bytes, maxBytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > maxBytes) {
    return fail("Provisioner bundle builder output is outside its exact byte bound");
  }
  let descriptor;
  try {
    descriptor = openSync(
      locator,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = writeSync(descriptor, bytes, offset, bytes.byteLength - offset);
      if (count < 1) return fail("Provisioner bundle builder write made no forward progress");
      offset += count;
    }
    fchmodSync(descriptor, 0o600);
    fsyncSync(descriptor);
    const stat = fstatSync(descriptor);
    if (
      !stat.isFile()
      || stat.nlink !== 1
      || stat.size !== bytes.byteLength
      || (stat.mode & 0o7777) !== 0o600
    ) {
      return fail("Provisioner bundle builder output metadata changed before publication");
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

async function main() {
  const input = parseArgv(process.argv.slice(2));
  if (
    realpathSync(process.execPath) !== realpathSync(input.runtime)
    || Object.keys(process.env).some((key) => (
      key.toUpperCase().startsWith("ESBUILD_")
      || key === "NODE_OPTIONS"
      || key === "NODE_PATH"
    ))
  ) {
    return fail("Provisioner bundle builder runtime or environment is outside its authority");
  }
  const esbuildMain = path.join(input.sourceRoot, "node_modules/esbuild/lib/main.js");
  const esbuild = await import(pathToFileURL(esbuildMain).href);
  if (esbuild.version !== EXPECTED_ESBUILD_VERSION) {
    return fail("Provisioner bundle builder loaded an unexpected esbuild version");
  }
  const result = await esbuild.build({
    absWorkingDir: input.sourceRoot,
    entryPoints: [ENTRYPOINT],
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
  if (result.outputFiles.length !== 1) {
    return fail("Provisioner bundle builder must produce exactly one output");
  }
  const bundleBytes = Buffer.from(result.outputFiles[0].contents);
  const inputLocators = Object.keys(result.metafile.inputs).sort();
  const externalNodeBuiltins = [...new Set(Object.values(result.metafile.outputs)
    .flatMap((output) => output.imports)
    .filter((entry) => entry.external)
    .map((entry) => entry.path))].sort();
  if (
    inputLocators.length < 1
    || inputLocators.some((locator) => (
      path.isAbsolute(locator)
      || locator.includes("\\")
      || locator.includes("\0")
      || locator.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
    ))
    || externalNodeBuiltins.length < 1
    || externalNodeBuiltins.some((locator) => !/^node:[a-z0-9_./-]+$/.test(locator))
  ) {
    return fail("Provisioner bundle builder emitted a non-canonical dependency set");
  }
  const metadata = Buffer.from(canonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bundle-build-metadata.v2",
    esbuildVersion: esbuild.version,
    inputLocators,
    externalNodeBuiltins,
    bundle: {
      sha256: createHash("sha256").update(bundleBytes).digest("hex"),
      byteLength: bundleBytes.byteLength,
    },
  }), "utf8");
  writeExclusive(input.outFile, bundleBytes, MAX_BUNDLE_BYTES);
  writeExclusive(input.metadataFile, metadata, MAX_METADATA_BYTES);
}

main().catch((error) => {
  process.stderr.write(
    `[node-toolchain-provisioner-bundle-builder-v2] ${error instanceof Error ? error.message : "failed"}\n`,
  );
  process.exitCode = 1;
});
