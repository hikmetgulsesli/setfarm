#!/usr/bin/env node
/**
 * Prepare/finalize runtime build identity.
 *
 * `--prepare` removes stale release authority and writes one durable receipt
 * for the exact Git state. `--finalize` consumes that receipt only after all
 * build outputs are complete and may issue the clean-main manifest last.
 */
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const buildInfoFile = "BUILD_INFO.json";
const releaseManifestFile = "PLATFORM_RELEASE_MANIFEST.json";
const prepareReceiptFile = "PLATFORM_BUILD_PREPARE.json";
const stitchConverterLocator = "scripts/stitch-to-jsx.mjs";
const maxStitchConverterBytes = 16 * 1024 * 1024;
const maxPrepareReceiptBytes = 16 * 1024;
const fullGitObjectHash = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const sha256Hash = /^[a-f0-9]{64}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function isStrictDescendant(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative.length > 0
    && relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

function snapshotDirectory(directoryPath, label) {
  const stats = lstatSync(directoryPath);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`${label} must be one real directory`);
  }
  if (realpathSync(directoryPath) !== directoryPath) {
    throw new Error(`${label} must not escape through a symlink`);
  }
  return Object.freeze({ path: directoryPath, dev: stats.dev, ino: stats.ino, label });
}

function assertDirectoryUnchanged(snapshot) {
  const stats = lstatSync(snapshot.path);
  if (
    stats.isSymbolicLink()
    || !stats.isDirectory()
    || stats.dev !== snapshot.dev
    || stats.ino !== snapshot.ino
    || realpathSync(snapshot.path) !== snapshot.path
  ) {
    throw new Error(`${snapshot.label} changed during build identity processing`);
  }
}

function fsyncDirectory(directoryPath) {
  const descriptor = openSync(directoryPath, constants.O_RDONLY);
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function anchorChildDirectory(root, name, create) {
  assertDirectoryUnchanged(root);
  const candidate = path.resolve(root.path, name);
  if (!isStrictDescendant(root.path, candidate)) {
    throw new Error(`Platform ${name} parent escapes the real repository root`);
  }
  if (create) {
    try {
      lstatSync(candidate);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        mkdirSync(candidate);
        fsyncDirectory(root.path);
      } else {
        throw error;
      }
    }
  }
  const child = snapshotDirectory(candidate, `Platform ${name} parent`);
  assertDirectoryUnchanged(root);
  return child;
}

function anchorRepositoryLayout() {
  const realRoot = realpathSync(path.resolve(process.cwd()));
  const root = snapshotDirectory(realRoot, "Platform repository root");
  const gitTopLevel = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: root.path,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  }).trim();
  if (realpathSync(gitTopLevel) !== root.path) {
    throw new Error("Current directory must be the real Git repository root");
  }
  assertDirectoryUnchanged(root);
  const scripts = anchorChildDirectory(root, "scripts", false);
  const dist = anchorChildDirectory(root, "dist", true);
  return Object.freeze({
    root,
    scripts,
    dist,
    buildInfoPath: path.join(dist.path, buildInfoFile),
    releaseManifestPath: path.join(dist.path, releaseManifestFile),
    prepareReceiptPath: path.join(dist.path, prepareReceiptFile),
    stitchConverterPath: path.join(scripts.path, path.basename(stitchConverterLocator)),
  });
}

function assertLayoutUnchanged(layout) {
  assertDirectoryUnchanged(layout.root);
  assertDirectoryUnchanged(layout.scripts);
  assertDirectoryUnchanged(layout.dist);
}

function removeFilesDurably(layout, filePaths) {
  assertDirectoryUnchanged(layout.dist);
  for (const filePath of filePaths) rmSync(filePath, { force: true });
  fsyncDirectory(layout.dist.path);
  assertDirectoryUnchanged(layout.dist);
}

function bestEffortAuthorityCleanup(layout) {
  if (!layout) return;
  try {
    removeFilesDurably(layout, [layout.releaseManifestPath, layout.prepareReceiptPath]);
  } catch {
    // An invalid/replaced parent must not be followed merely to clean up.
  }
}

function readBoundedRegularFile(filePath, maxBytes) {
  let descriptor;
  try {
    descriptor = openSync(
      filePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (!before.isFile()) throw new Error(`${filePath} is not a regular file`);
    if (before.size > maxBytes) throw new Error(`${filePath} exceeds ${maxBytes} bytes`);

    const buffer = Buffer.allocUnsafe(Math.min(maxBytes + 1, before.size + 1));
    let byteLength = 0;
    while (byteLength < buffer.length) {
      const bytesRead = readSync(
        descriptor,
        buffer,
        byteLength,
        buffer.length - byteLength,
        null,
      );
      if (bytesRead === 0) break;
      byteLength += bytesRead;
    }
    if (byteLength > maxBytes) throw new Error(`${filePath} exceeds ${maxBytes} bytes`);

    const after = fstatSync(descriptor);
    if (
      !after.isFile()
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs
      || before.ctimeMs !== after.ctimeMs
      || after.size !== byteLength
    ) {
      throw new Error(`${filePath} changed while it was being read`);
    }
    return Buffer.from(buffer.subarray(0, byteLength));
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function writeJsonAtomic(layout, filePath, value) {
  assertDirectoryUnchanged(layout.dist);
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  let descriptor;
  let renamed = false;
  try {
    descriptor = openSync(
      temporaryPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
      0o644,
    );
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporaryPath, filePath);
    renamed = true;
    try {
      fsyncDirectory(layout.dist.path);
      assertDirectoryUnchanged(layout.dist);
    } catch (error) {
      rmSync(filePath, { force: true });
      fsyncDirectory(layout.dist.path);
      throw error;
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (!renamed) {
      rmSync(temporaryPath, { force: true });
      fsyncDirectory(layout.dist.path);
    }
  }
}

function gitText(layout, args) {
  return execFileSync("git", args, {
    cwd: layout.root.path,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  }).trim();
}

function gitRawText(layout, args) {
  return execFileSync("git", args, {
    cwd: layout.root.path,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

function gitBytes(layout, args) {
  return execFileSync("git", args, {
    cwd: layout.root.path,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: maxStitchConverterBytes + 1,
  });
}

function readGitState(layout) {
  assertDirectoryUnchanged(layout.root);
  const sha = gitText(layout, ["rev-parse", "HEAD"]).toLowerCase();
  const branch = gitText(layout, ["branch", "--show-current"]);
  const porcelain = gitRawText(layout, ["status", "--porcelain"]);
  assertDirectoryUnchanged(layout.root);
  if (!fullGitObjectHash.test(sha)) throw new Error("git HEAD is not one full object hash");
  return Object.freeze({
    sha,
    branch,
    porcelain,
    dirty: porcelain.length > 0,
    porcelainFingerprint: createHash("sha256").update(porcelain, "utf8").digest("hex"),
  });
}

function sameGitState(left, right) {
  return left.sha === right.sha
    && left.branch === right.branch
    && left.dirty === right.dirty
    && left.porcelainFingerprint === right.porcelainFingerprint;
}

function assertBuildStateAllowed(state, allowDirty) {
  if (allowDirty) return;
  if (state.branch !== "main") {
    throw new Error(`REFUSING to build: branch='${state.branch}' (expected 'main')`);
  }
  if (state.dirty) {
    throw new Error(
      `REFUSING to build: working tree is dirty\n${state.porcelain.split("\n").slice(0, 10).join("\n")}`,
    );
  }
}

function packageVersion(layout) {
  try {
    return JSON.parse(readFileSync(path.join(layout.root.path, "package.json"), "utf8")).version
      || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function buildInfo(layout, state) {
  const version = packageVersion(layout);
  const shortSha = state.sha.slice(0, 8);
  return Object.freeze({
    sha: state.sha,
    shortSha,
    branch: state.branch,
    dirty: state.dirty,
    packageVersion: version,
    displayVersion: `${version}+${shortSha}${state.dirty ? ".dirty" : ""}`,
    builtAt: new Date().toISOString(),
  });
}

function prepareReceipt(state) {
  return Object.freeze({
    schema: "setfarm.platform-build-prepare.v1",
    buildId: randomUUID(),
    sha: state.sha,
    branch: state.branch,
    dirty: state.dirty,
    porcelainFingerprint: state.porcelainFingerprint,
  });
}

function parsePrepareReceipt(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Build prepare receipt must be one strict object");
  }
  const expectedKeys = [
    "branch",
    "buildId",
    "dirty",
    "porcelainFingerprint",
    "schema",
    "sha",
  ];
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(expectedKeys)) {
    throw new Error("Build prepare receipt has unknown or missing fields");
  }
  if (
    value.schema !== "setfarm.platform-build-prepare.v1"
    || typeof value.buildId !== "string"
    || !uuid.test(value.buildId)
    || typeof value.sha !== "string"
    || !fullGitObjectHash.test(value.sha)
    || typeof value.branch !== "string"
    || value.branch.length > 1_024
    || typeof value.dirty !== "boolean"
    || typeof value.porcelainFingerprint !== "string"
    || !sha256Hash.test(value.porcelainFingerprint)
  ) {
    throw new Error("Build prepare receipt fields are invalid");
  }
  return Object.freeze({
    schema: value.schema,
    buildId: value.buildId,
    sha: value.sha,
    branch: value.branch,
    dirty: value.dirty,
    porcelainFingerprint: value.porcelainFingerprint,
  });
}

function readPrepareReceipt(layout) {
  assertDirectoryUnchanged(layout.dist);
  const bytes = readBoundedRegularFile(layout.prepareReceiptPath, maxPrepareReceiptBytes);
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  const receipt = parsePrepareReceipt(JSON.parse(text));
  assertDirectoryUnchanged(layout.dist);
  return receipt;
}

function captureCommittedConverter(layout, stateBefore) {
  assertLayoutUnchanged(layout);
  const committedBytes = gitBytes(layout, [
    "show",
    `${stateBefore.sha}:${stitchConverterLocator}`,
  ]);
  if (committedBytes.byteLength < 1) {
    throw new Error("Committed Stitch converter must not be empty");
  }
  if (committedBytes.byteLength > maxStitchConverterBytes) {
    throw new Error(`Committed Stitch converter exceeds ${maxStitchConverterBytes} bytes`);
  }
  new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(committedBytes);

  const liveBytes = readBoundedRegularFile(layout.stitchConverterPath, maxStitchConverterBytes);
  if (liveBytes.byteLength < 1) throw new Error("Live Stitch converter must not be empty");
  new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(liveBytes);
  assertLayoutUnchanged(layout);

  const stateAfter = readGitState(layout);
  if (!sameGitState(stateBefore, stateAfter)) {
    throw new Error("Platform Git state changed while release source was being captured");
  }
  if (!liveBytes.equals(committedBytes)) {
    throw new Error("Live Stitch converter bytes do not match the committed release blob");
  }
  return Object.freeze({ committedBytes, stateAfter });
}

function selectedPhase() {
  const phases = process.argv.slice(2).filter((value) => value === "--prepare" || value === "--finalize");
  if (phases.length !== 1) {
    throw new Error("exactly one explicit phase is required: --prepare or --finalize");
  }
  return phases[0];
}

let activeLayout;

function main() {
  activeLayout = anchorRepositoryLayout();
  const phase = selectedPhase();
  const allowDirty = process.argv.includes("--allow-dirty-build")
    || process.env.SETFARM_ALLOW_DIRTY_BUILD === "1";

  if (phase === "--prepare") {
    removeFilesDurably(activeLayout, [
      activeLayout.releaseManifestPath,
      activeLayout.prepareReceiptPath,
    ]);
    const state = readGitState(activeLayout);
    assertBuildStateAllowed(state, allowDirty);
    assertLayoutUnchanged(activeLayout);
    const info = buildInfo(activeLayout, state);
    const receipt = prepareReceipt(state);
    writeJsonAtomic(activeLayout, activeLayout.buildInfoPath, info);
    writeJsonAtomic(activeLayout, activeLayout.prepareReceiptPath, receipt);
    assertLayoutUnchanged(activeLayout);
    console.log(`[write-build-info] prepared ${info.displayVersion} build=${receipt.buildId}`);
    return;
  }

  removeFilesDurably(activeLayout, [activeLayout.releaseManifestPath]);
  const receipt = readPrepareReceipt(activeLayout);
  const stateBefore = readGitState(activeLayout);
  if (!sameGitState(receipt, stateBefore)) {
    throw new Error("Current Git state does not match the exact build prepare receipt");
  }
  assertBuildStateAllowed(stateBefore, allowDirty);
  assertLayoutUnchanged(activeLayout);

  const releasable = stateBefore.branch === "main" && !stateBefore.dirty;
  if (!releasable) {
    const info = buildInfo(activeLayout, stateBefore);
    writeJsonAtomic(activeLayout, activeLayout.buildInfoPath, info);
    removeFilesDurably(activeLayout, [activeLayout.prepareReceiptPath]);
    assertLayoutUnchanged(activeLayout);
    console.log(`[write-build-info] finalized compatibility ${info.displayVersion}; manifest withheld`);
    return;
  }

  const capture = captureCommittedConverter(activeLayout, stateBefore);
  if (!sameGitState(receipt, capture.stateAfter)) {
    throw new Error("Final Git state no longer matches the exact build prepare receipt");
  }
  const info = buildInfo(activeLayout, capture.stateAfter);
  const releaseManifest = {
    schema: "setfarm.platform-release-manifest.v1",
    releaseSha: capture.stateAfter.sha,
    branch: "main",
    dirty: false,
    stitchConverter: {
      converterId: "setfarm.stitch-to-jsx",
      source: {
        schema: "setfarm.source-artifact-ref.v1",
        hash: createHash("sha256").update(capture.committedBytes).digest("hex"),
        mediaType: "text/javascript",
        locator: stitchConverterLocator,
        byteLength: capture.committedBytes.byteLength,
      },
    },
  };

  writeJsonAtomic(activeLayout, activeLayout.buildInfoPath, info);
  removeFilesDurably(activeLayout, [activeLayout.prepareReceiptPath]);
  assertLayoutUnchanged(activeLayout);
  console.log(`[write-build-info] finalizing ${info.displayVersion}; manifest is the terminal write`);
  writeJsonAtomic(activeLayout, activeLayout.releaseManifestPath, releaseManifest);
  return;
}

try {
  main();
} catch (error) {
  bestEffortAuthorityCleanup(activeLayout);
  console.error(`[write-build-info] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
