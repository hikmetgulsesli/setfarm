import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import {
  chmodSync,
  closeSync,
  copyFileSync,
  createReadStream,
  existsSync,
  fsyncSync,
  lstatSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
  type Stats,
} from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import {
  withV3SealCapacityAdmission,
  type V3SealCapacityLimits,
  type V3SealCapacityReservation,
} from "./v3-seal-capacity.js";
import { captureShadowSourceRevision } from "./shadow-attempt-recorder.js";
import { captureV3BuildArtifact, exactV3BuildArtifactMatch } from "./v3-build-artifact.js";
import type { SourceRevisionV1 } from "./schemas/execution-attempt-v1.js";
import type { V3BuildArtifactV1 } from "./schemas/v3-deploy-receipt-v1.js";
import {
  createV3SealAuthorityV1,
  createV3SealedRuntimeManifestV1,
  V3_SEALED_RUNTIME_MAX_DIRECTORIES,
  V3_SEALED_RUNTIME_MAX_FILES,
  V3_SEALED_RUNTIME_MAX_FILE_BYTES,
  V3_SEALED_RUNTIME_MAX_TOTAL_BYTES,
  V3SealAuthorityV1Schema,
  V3SealedRuntimeManifestV1Schema,
  type V3SealAuthorityV1,
  type V3SealedRuntimeFileV1,
  type V3SealedRuntimeManifestV1,
} from "./schemas/v3-sealed-runtime-manifest-v1.js";

const execFileAsync = promisify(execFile);
const MAX_SEALED_SOURCE_FILES = 100_000;
const MAX_SEALED_SOURCE_FILE_BYTES = 1_073_741_824;
const MAX_SEALED_SOURCE_TOTAL_BYTES = 4_294_967_296;
const SEALED_RUNTIME_MANIFEST_FILE = ".setfarm-sealed-runtime-manifest.json";

function fail(code: string, detail: string): never {
  throw new Error(`${code}:${detail.slice(0, 500)}`);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertInside(root: string, target: string, label: string): void {
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    fail("V3_DEPLOY_SEALED_RUNTIME_ESCAPE", label);
  }
}

function pathComponents(absolutePath: string): readonly string[] {
  const parsed = path.parse(absolutePath);
  const suffix = absolutePath.slice(parsed.root.length);
  return [parsed.root, ...suffix.split(path.sep).filter(Boolean)];
}

function lstatOrUndefined(filePath: string): Stats | undefined {
  try {
    return lstatSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function assertNoSymlinkAncestors(absolutePath: string, allowMissingLeaf = false): void {
  const resolved = path.resolve(absolutePath);
  const [filesystemRoot, ...segments] = pathComponents(resolved);
  let current = filesystemRoot!;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]!);
    const stats = lstatOrUndefined(current);
    if (!stats) {
      if (allowMissingLeaf && index === segments.length - 1) return;
      fail("V3_DEPLOY_STATE_PATH_MISSING", current);
    }
    if (stats.isSymbolicLink()) fail("V3_DEPLOY_STATE_PATH_SYMLINK", current);
    if (index < segments.length - 1 && !stats.isDirectory()) {
      fail("V3_DEPLOY_STATE_PATH_ANCESTOR_INVALID", current);
    }
  }
}

export function ensureCanonicalV3StateRoot(requestedRoot: string): string {
  const resolved = path.resolve(requestedRoot);
  const [filesystemRoot, ...segments] = pathComponents(resolved);
  let current = filesystemRoot!;
  for (const segment of segments) {
    current = path.join(current, segment);
    const existing = lstatOrUndefined(current);
    if (existing) {
      if (existing.isSymbolicLink()) fail("V3_DEPLOY_STATE_PATH_SYMLINK", current);
      if (!existing.isDirectory()) fail("V3_DEPLOY_STATE_PATH_ANCESTOR_INVALID", current);
      continue;
    }
    mkdirSync(current, { recursive: false, mode: 0o700 });
    const created = lstatSync(current);
    if (!created.isDirectory() || created.isSymbolicLink()) {
      fail("V3_DEPLOY_STATE_PATH_ANCESTOR_INVALID", current);
    }
    fsyncDirectory(current);
    fsyncDirectory(path.dirname(current));
  }
  assertNoSymlinkAncestors(resolved);
  if (realpathSync(resolved) !== resolved) fail("V3_DEPLOY_STATE_ROOT_NONCANONICAL", resolved);
  return resolved;
}

function assertCanonicalStatePath(
  stateRoot: string,
  target: string,
  options: Readonly<{ allowMissingLeaf?: boolean }> = {},
): void {
  const resolvedTarget = path.resolve(target);
  assertInside(stateRoot, resolvedTarget, resolvedTarget);
  assertNoSymlinkAncestors(stateRoot);
  assertNoSymlinkAncestors(resolvedTarget, options.allowMissingLeaf ?? false);
}

function ensureCanonicalStateDirectory(stateRoot: string, directoryPath: string): void {
  const resolved = path.resolve(directoryPath);
  assertInside(stateRoot, resolved, resolved);
  const relative = path.relative(stateRoot, resolved);
  let current = stateRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const existing = lstatOrUndefined(current);
    if (existing) {
      if (existing.isSymbolicLink()) fail("V3_DEPLOY_STATE_PATH_SYMLINK", current);
      if (!existing.isDirectory()) fail("V3_DEPLOY_STATE_PATH_ANCESTOR_INVALID", current);
      continue;
    }
    assertCanonicalStatePath(stateRoot, current, { allowMissingLeaf: true });
    mkdirSync(current, { recursive: false, mode: 0o700 });
    const created = lstatSync(current);
    if (!created.isDirectory() || created.isSymbolicLink()) {
      fail("V3_DEPLOY_STATE_PATH_ANCESTOR_INVALID", current);
    }
    fsyncDirectory(current);
    fsyncDirectory(path.dirname(current));
  }
  assertCanonicalStatePath(stateRoot, resolved);
}

function fsyncDirectory(directoryPath: string): void {
  const descriptor = openSync(directoryPath, "r");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function fsyncTree(root: string): void {
  const visit = (absolutePath: string): void => {
    const stats = lstatSync(absolutePath);
    if (stats.isSymbolicLink()) fail("V3_DEPLOY_SEALED_RUNTIME_SYMLINK", absolutePath);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(absolutePath).sort(compareCodeUnits)) {
        visit(path.join(absolutePath, entry));
      }
      fsyncDirectory(absolutePath);
      return;
    }
    if (!stats.isFile()) fail("V3_DEPLOY_SEALED_RUNTIME_SPECIAL_FILE", absolutePath);
    const descriptor = openSync(absolutePath, "r");
    try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
  };
  visit(root);
}

function writeDurableFile(
  filePath: string,
  value: string,
  capacity?: V3SealCapacityReservation,
): void {
  capacity?.admitWrite(Buffer.byteLength(value));
  const descriptor = openSync(filePath, "wx", 0o600);
  try {
    writeFileSync(descriptor, value, "utf8");
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  fsyncDirectory(path.dirname(filePath));
}

async function listAcceptedSourcePaths(worktree: string): Promise<string[]> {
  const result = await execFileAsync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: worktree, timeout: 30_000, maxBuffer: 32 * 1024 * 1024 },
  );
  const entries = result.stdout.split("\0").filter(Boolean).sort(compareCodeUnits);
  if (entries.length > MAX_SEALED_SOURCE_FILES) {
    fail("V3_DEPLOY_SEALED_SOURCE_FILE_LIMIT", String(entries.length));
  }
  return entries;
}

function outputOwnsPath(outputPaths: readonly string[], locator: string): boolean {
  return outputPaths.some((outputPath) => locator === outputPath || locator.startsWith(`${outputPath}/`));
}

function copyAcceptedSource(input: Readonly<{
  worktree: string;
  destination: string;
  sourcePaths: readonly string[];
  artifact: V3BuildArtifactV1;
  capacity: V3SealCapacityReservation;
}>): ReadonlySet<string> {
  const artifactPaths = new Set(input.artifact.files.map((file) => file.path));
  const sourceArtifactOverlapPaths = new Set<string>();
  let totalBytes = 0;
  for (const locator of input.sourcePaths) {
    if (outputOwnsPath(input.artifact.outputPaths, locator)) {
      if (!artifactPaths.has(locator)) {
        fail("V3_DEPLOY_BUILD_OUTPUT_TRACKED_SOURCE_CONFLICT", locator);
      }
      sourceArtifactOverlapPaths.add(locator);
    }
    const source = path.resolve(input.worktree, locator);
    const destination = path.resolve(input.destination, locator);
    assertInside(input.worktree, source, locator);
    assertInside(input.destination, destination, locator);
    const stats = lstatSync(source);
    if (stats.isSymbolicLink()) fail("V3_DEPLOY_SEALED_SOURCE_SYMLINK_UNSUPPORTED", locator);
    if (!stats.isFile()) fail("V3_DEPLOY_SEALED_SOURCE_SPECIAL_FILE", locator);
    if (stats.size > MAX_SEALED_SOURCE_FILE_BYTES) {
      fail("V3_DEPLOY_SEALED_SOURCE_FILE_SIZE_LIMIT", locator);
    }
    totalBytes += stats.size;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > MAX_SEALED_SOURCE_TOTAL_BYTES) {
      fail("V3_DEPLOY_SEALED_SOURCE_TOTAL_SIZE_LIMIT", String(totalBytes));
    }
    mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    input.capacity.admitWrite(stats.size);
    copyFileSync(source, destination);
    chmodSync(destination, (stats.mode & 0o111) !== 0 ? 0o500 : 0o400);
  }
  return sourceArtifactOverlapPaths;
}

function copyBuildArtifact(input: Readonly<{
  worktree: string;
  destination: string;
  artifact: V3BuildArtifactV1;
  sourceArtifactOverlapPaths: ReadonlySet<string>;
  capacity: V3SealCapacityReservation;
}>): void {
  for (const file of input.artifact.files) {
    const source = path.resolve(input.worktree, file.path);
    const destination = path.resolve(input.destination, file.path);
    assertInside(input.worktree, source, file.path);
    assertInside(input.destination, destination, file.path);
    const stats = lstatSync(source);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size !== file.byteLength) {
      fail("V3_DEPLOY_BUILD_OUTPUT_DRIFT", file.path);
    }
    if (existsSync(destination)) {
      if (!input.sourceArtifactOverlapPaths.has(file.path)) {
        fail("V3_DEPLOY_BUILD_OUTPUT_DESTINATION_CONFLICT", file.path);
      }
      continue;
    }
    mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    input.capacity.admitWrite(stats.size);
    copyFileSync(source, destination);
    chmodSync(destination, file.executable ? 0o500 : 0o400);
  }
}

function dependencyDirectoryNames(packageManager: string): readonly string[] {
  if (["npm", "pnpm", "yarn", "bun"].includes(packageManager)) return ["node_modules"];
  if (["pip", "poetry"].includes(packageManager)) return [".venv", "venv"];
  if (packageManager === "gradle") return [".gradle"];
  return [];
}

function dependencyLocators(previewCwd: string, packageManager: string): readonly string[] {
  const names = dependencyDirectoryNames(packageManager);
  const cwdSegments = previewCwd === "." ? [] : previewCwd.split("/");
  const locators: string[] = [];
  for (let depth = 0; depth <= cwdSegments.length; depth += 1) {
    const parentLocator = cwdSegments.slice(0, depth).join("/");
    for (const name of names) locators.push(parentLocator ? `${parentLocator}/${name}` : name);
  }
  return [...new Set(locators)].sort(compareCodeUnits);
}

type StableStat = Readonly<{
  dev: number;
  ino: number;
  mode: number;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
}>;

function stableStat(stats: Stats): StableStat {
  return {
    dev: stats.dev,
    ino: stats.ino,
    mode: stats.mode,
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    ctimeMs: stats.ctimeMs,
  };
}

function sameStableStat(left: StableStat, right: StableStat): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

type DependencyCopyBudget = {
  files: number;
  directories: number;
  totalBytes: number;
};

function copyRuntimeDependencyEntry(input: Readonly<{
  source: string;
  destination: string;
  locator: string;
  budget: DependencyCopyBudget;
  activeDirectoryTargets: Set<string>;
  allowedCanonicalRoot: string;
  capacity: V3SealCapacityReservation;
}>): void {
  const canonicalSource = realpathSync(input.source);
  if (
    canonicalSource !== input.allowedCanonicalRoot
    && !canonicalSource.startsWith(`${input.allowedCanonicalRoot}${path.sep}`)
  ) {
    fail("V3_DEPLOY_RUNTIME_DEPENDENCY_ESCAPE", input.locator);
  }
  const beforeStats = statSync(input.source);
  const before = stableStat(beforeStats);
  if (beforeStats.isDirectory()) {
    if (input.activeDirectoryTargets.has(canonicalSource)) {
      fail("V3_DEPLOY_RUNTIME_DEPENDENCY_CYCLE", input.locator);
    }
    input.budget.directories += 1;
    if (input.budget.directories > V3_SEALED_RUNTIME_MAX_DIRECTORIES) {
      fail("V3_DEPLOY_RUNTIME_DEPENDENCY_DIRECTORY_LIMIT", String(input.budget.directories));
    }
    input.activeDirectoryTargets.add(canonicalSource);
    mkdirSync(input.destination, { recursive: false, mode: 0o700 });
    const entries = readdirSync(input.source).sort(compareCodeUnits);
    for (const entry of entries) {
      copyRuntimeDependencyEntry({
        source: path.join(input.source, entry),
        destination: path.join(input.destination, entry),
        locator: `${input.locator}/${entry}`,
        budget: input.budget,
        activeDirectoryTargets: input.activeDirectoryTargets,
        allowedCanonicalRoot: input.allowedCanonicalRoot,
        capacity: input.capacity,
      });
    }
    input.activeDirectoryTargets.delete(canonicalSource);
    const afterStats = statSync(input.source);
    const afterEntries = readdirSync(input.source).sort(compareCodeUnits);
    if (
      realpathSync(input.source) !== canonicalSource
      || !afterStats.isDirectory()
      || !sameStableStat(before, stableStat(afterStats))
      || canonicalJsonStringify(entries) !== canonicalJsonStringify(afterEntries)
    ) {
      fail("V3_DEPLOY_RUNTIME_DEPENDENCY_DRIFT", input.locator);
    }
    return;
  }
  if (!beforeStats.isFile()) fail("V3_DEPLOY_RUNTIME_DEPENDENCY_SPECIAL_FILE", input.locator);
  if (beforeStats.size > V3_SEALED_RUNTIME_MAX_FILE_BYTES) {
    fail("V3_DEPLOY_RUNTIME_DEPENDENCY_FILE_SIZE_LIMIT", input.locator);
  }
  input.budget.files += 1;
  input.budget.totalBytes += beforeStats.size;
  if (input.budget.files > V3_SEALED_RUNTIME_MAX_FILES) {
    fail("V3_DEPLOY_RUNTIME_DEPENDENCY_FILE_LIMIT", String(input.budget.files));
  }
  if (
    !Number.isSafeInteger(input.budget.totalBytes)
    || input.budget.totalBytes > V3_SEALED_RUNTIME_MAX_TOTAL_BYTES
  ) {
    fail("V3_DEPLOY_RUNTIME_DEPENDENCY_TOTAL_SIZE_LIMIT", String(input.budget.totalBytes));
  }
  input.capacity.admitWrite(beforeStats.size);
  copyFileSync(canonicalSource, input.destination);
  chmodSync(input.destination, (beforeStats.mode & 0o111) !== 0 ? 0o500 : 0o400);
  const afterStats = statSync(input.source);
  if (
    realpathSync(input.source) !== canonicalSource
    || !afterStats.isFile()
    || !sameStableStat(before, stableStat(afterStats))
  ) {
    fail("V3_DEPLOY_RUNTIME_DEPENDENCY_DRIFT", input.locator);
  }
}

function copyRuntimeDependencies(input: Readonly<{
  worktree: string;
  destination: string;
  previewCwd: string;
  packageManager: string;
  capacity: V3SealCapacityReservation;
}>): readonly string[] {
  const roots: string[] = [];
  const budget: DependencyCopyBudget = { files: 0, directories: 0, totalBytes: 0 };
  for (const locator of dependencyLocators(input.previewCwd, input.packageManager)) {
    const source = path.resolve(input.worktree, locator);
    const destination = path.resolve(input.destination, locator);
    assertInside(input.worktree, source, locator);
    assertInside(input.destination, destination, locator);
    if (!existsSync(source)) continue;
    if (existsSync(destination)) fail("V3_DEPLOY_RUNTIME_DEPENDENCY_DESTINATION_CONFLICT", locator);
    if (!statSync(source).isDirectory()) fail("V3_DEPLOY_RUNTIME_DEPENDENCY_INVALID", locator);
    mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    const filesBefore = budget.files;
    copyRuntimeDependencyEntry({
      source,
      destination,
      locator,
      budget,
      activeDirectoryTargets: new Set<string>(),
      allowedCanonicalRoot: input.worktree,
      capacity: input.capacity,
    });
    if (budget.files === filesBefore) fail("V3_DEPLOY_RUNTIME_DEPENDENCY_EMPTY", locator);
    roots.push(locator);
  }
  return roots;
}

async function hashFile(filePath: string): Promise<string> {
  const digest = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return digest.digest("hex");
}

type DirectorySnapshot = Readonly<{
  absolutePath: string;
  locator: string;
  stat: StableStat;
  entries: readonly string[];
}>;

async function captureSealedRuntimeManifest(input: Readonly<{
  root: string;
  runId: string;
  candidateHash: string;
  sourceRevision: SourceRevisionV1;
  buildArtifactHash: string;
  runtimeDataContractHash: string;
  dependencyRoots: readonly string[];
  requireReadOnlyModes?: boolean;
}>): Promise<V3SealedRuntimeManifestV1> {
  const resolvedRoot = path.resolve(input.root);
  const rootStats = lstatSync(resolvedRoot);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    fail("V3_DEPLOY_SEALED_RUNTIME_INVALID", resolvedRoot);
  }
  const root = realpathSync(resolvedRoot);
  const files: V3SealedRuntimeFileV1[] = [];
  const directories: DirectorySnapshot[] = [];
  const directoryLocators: string[] = [];
  let totalBytes = 0;

  const visit = async (absolutePath: string, locator: string): Promise<void> => {
    const stats = lstatSync(absolutePath);
    if (stats.isSymbolicLink()) fail("V3_DEPLOY_SEALED_RUNTIME_SYMLINK", locator);
    if (stats.isDirectory()) {
      if (input.requireReadOnlyModes && (stats.mode & 0o777) !== 0o500) {
        fail("V3_DEPLOY_SEALED_RUNTIME_DRIFT", `mode:${locator}`);
      }
      if (directories.length >= V3_SEALED_RUNTIME_MAX_DIRECTORIES) {
        fail("V3_DEPLOY_SEALED_RUNTIME_DIRECTORY_LIMIT", String(directories.length + 1));
      }
      const entries = readdirSync(absolutePath)
        .filter((entry) => locator !== "." || entry !== SEALED_RUNTIME_MANIFEST_FILE)
        .sort(compareCodeUnits);
      directories.push({ absolutePath, locator, stat: stableStat(stats), entries });
      if (locator !== ".") directoryLocators.push(locator);
      for (const entry of entries) {
        const childLocator = locator === "." ? entry : `${locator}/${entry}`;
        await visit(path.join(absolutePath, entry), childLocator);
      }
      return;
    }
    if (!stats.isFile()) fail("V3_DEPLOY_SEALED_RUNTIME_SPECIAL_FILE", locator);
    if (files.length >= V3_SEALED_RUNTIME_MAX_FILES) {
      fail("V3_DEPLOY_SEALED_RUNTIME_FILE_LIMIT", String(files.length + 1));
    }
    if (stats.size > V3_SEALED_RUNTIME_MAX_FILE_BYTES) {
      fail("V3_DEPLOY_SEALED_RUNTIME_FILE_SIZE_LIMIT", locator);
    }
    const expectedMode = (stats.mode & 0o111) !== 0 ? 0o500 : 0o400;
    if ((stats.mode & 0o777) !== expectedMode) {
      fail("V3_DEPLOY_SEALED_RUNTIME_DRIFT", `mode:${locator}`);
    }
    totalBytes += stats.size;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > V3_SEALED_RUNTIME_MAX_TOTAL_BYTES) {
      fail("V3_DEPLOY_SEALED_RUNTIME_TOTAL_SIZE_LIMIT", String(totalBytes));
    }
    const before = stableStat(stats);
    const contentHash = await hashFile(absolutePath);
    const afterStats = lstatSync(absolutePath);
    if (!afterStats.isFile() || !sameStableStat(before, stableStat(afterStats))) {
      fail("V3_DEPLOY_SEALED_RUNTIME_DRIFT", locator);
    }
    files.push({
      path: locator,
      byteLength: stats.size,
      contentHash,
      executable: (stats.mode & 0o111) !== 0,
    });
  };

  await visit(root, ".");
  for (const directory of directories) {
    const afterStats = lstatSync(directory.absolutePath);
    const afterEntries = readdirSync(directory.absolutePath)
      .filter((entry) => directory.locator !== "." || entry !== SEALED_RUNTIME_MANIFEST_FILE)
      .sort(compareCodeUnits);
    if (
      !afterStats.isDirectory()
      || !sameStableStat(directory.stat, stableStat(afterStats))
      || canonicalJsonStringify(afterEntries) !== canonicalJsonStringify(directory.entries)
    ) {
      fail("V3_DEPLOY_SEALED_RUNTIME_DRIFT", directory.locator);
    }
  }
  return createV3SealedRuntimeManifestV1({
    schema: "setfarm.v3-sealed-runtime-manifest.v1",
    runId: input.runId,
    candidateHash: input.candidateHash,
    sourceRevision: input.sourceRevision,
    buildArtifactHash: input.buildArtifactHash,
    runtimeDataContractHash: input.runtimeDataContractHash,
    dependencyRoots: [...input.dependencyRoots].sort(compareCodeUnits),
    directories: directoryLocators.sort(compareCodeUnits),
    files: files.sort((left, right) => compareCodeUnits(left.path, right.path)),
    totalBytes,
  });
}

function readSealedRuntimeManifest(root: string): V3SealedRuntimeManifestV1 {
  const manifestPath = path.join(root, SEALED_RUNTIME_MANIFEST_FILE);
  const stats = lstatSync(manifestPath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    fail("V3_DEPLOY_SEALED_RUNTIME_MANIFEST_INVALID", manifestPath);
  }
  if ((stats.mode & 0o777) !== 0o400) {
    fail("V3_DEPLOY_SEALED_RUNTIME_DRIFT", `mode:${SEALED_RUNTIME_MANIFEST_FILE}`);
  }
  return V3SealedRuntimeManifestV1Schema.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
}

export async function verifyV3SealedRuntime(input: Readonly<{
  root: string;
  runId: string;
  candidateHash: string;
  expectedSource: SourceRevisionV1;
  artifact: V3BuildArtifactV1;
  expectedRuntimeDataContractHash: string;
  previewCwd: string;
  packageManager: string;
  expectedManifestHash?: string;
  expectedManifestEvidenceRef?: string;
}>): Promise<V3SealedRuntimeManifestV1> {
  let stored: V3SealedRuntimeManifestV1;
  try {
    stored = readSealedRuntimeManifest(input.root);
  } catch (error) {
    fail("V3_DEPLOY_SEALED_RUNTIME_MANIFEST_INVALID", String(error));
  }
  const allowedRoots = new Set(dependencyLocators(input.previewCwd, input.packageManager));
  if (
    stored.runId !== input.runId
    || stored.candidateHash !== input.candidateHash
    || stored.buildArtifactHash !== input.artifact.artifactHash
    || stored.runtimeDataContractHash !== input.expectedRuntimeDataContractHash
    || canonicalJsonStringify(stored.sourceRevision) !== canonicalJsonStringify(input.expectedSource)
    || stored.dependencyRoots.some((root) => !allowedRoots.has(root))
    || (input.expectedManifestHash !== undefined && stored.manifestHash !== input.expectedManifestHash)
    || (
      input.expectedManifestEvidenceRef !== undefined
      && stored.evidenceRef !== input.expectedManifestEvidenceRef
    )
  ) {
    fail("V3_DEPLOY_SEALED_RUNTIME_IDENTITY_CONFLICT", input.runId);
  }
  const observed = await captureSealedRuntimeManifest({
    root: input.root,
    runId: input.runId,
    candidateHash: input.candidateHash,
    sourceRevision: input.expectedSource,
    buildArtifactHash: input.artifact.artifactHash,
    runtimeDataContractHash: input.expectedRuntimeDataContractHash,
    dependencyRoots: stored.dependencyRoots,
    requireReadOnlyModes: true,
  });
  if (observed.manifestHash !== stored.manifestHash || observed.evidenceRef !== stored.evidenceRef) {
    fail("V3_DEPLOY_SEALED_RUNTIME_DRIFT", input.runId);
  }
  const observedArtifact = await captureV3BuildArtifact({
    runId: input.runId,
    worktree: input.root,
    outputPaths: input.artifact.outputPaths,
  });
  if (!exactV3BuildArtifactMatch(input.artifact, observedArtifact)) {
    fail("V3_DEPLOY_BUILD_OUTPUT_DRIFT", input.artifact.artifactHash);
  }
  return stored;
}

function makeTreeReadOnly(root: string): void {
  const visit = (absolute: string): void => {
    const stats = lstatSync(absolute);
    if (stats.isSymbolicLink()) fail("V3_DEPLOY_SEALED_RUNTIME_SYMLINK", absolute);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(absolute).sort(compareCodeUnits)) visit(path.join(absolute, entry));
      chmodSync(absolute, 0o500);
      return;
    }
    if (stats.isFile()) chmodSync(absolute, (stats.mode & 0o111) !== 0 ? 0o500 : 0o400);
  };
  visit(root);
}

function makeTreeWritable(root: string): void {
  if (!existsSync(root)) return;
  const visit = (absolute: string): void => {
    const stats = lstatSync(absolute);
    if (stats.isSymbolicLink()) return;
    if (stats.isDirectory()) {
      chmodSync(absolute, 0o700);
      for (const entry of readdirSync(absolute)) visit(path.join(absolute, entry));
      return;
    }
    if (stats.isFile()) chmodSync(absolute, 0o600);
  };
  visit(root);
}

function removeTemporary(pathname: string): void {
  try { rmSync(pathname, { recursive: true, force: true }); } catch { /* primary failure remains canonical */ }
}

export function v3SealAuthorityFilePath(input: Readonly<{
  stateRoot: string;
  candidateHash: string;
  artifactHash: string;
}>): string {
  return path.join(
    input.stateRoot,
    "sealed",
    input.candidateHash,
    `.${input.artifactHash}.authority.json`,
  );
}

function readSealAuthority(filePath: string): Readonly<{
  authority: V3SealAuthorityV1;
  bytes: string;
}> {
  let stats: Stats;
  try {
    stats = lstatSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      fail("V3_DEPLOY_SEAL_AUTHORITY_MISSING", filePath);
    }
    throw error;
  }
  if (!stats.isFile() || stats.isSymbolicLink() || (stats.mode & 0o777) !== 0o400) {
    fail("V3_DEPLOY_SEAL_AUTHORITY_INVALID", filePath);
  }
  const bytes = readFileSync(filePath, "utf8");
  let authority: V3SealAuthorityV1;
  try {
    authority = V3SealAuthorityV1Schema.parse(JSON.parse(bytes));
  } catch (error) {
    fail("V3_DEPLOY_SEAL_AUTHORITY_INVALID", String(error));
  }
  if (bytes !== `${canonicalJsonStringify(authority)}\n`) {
    fail("V3_DEPLOY_SEAL_AUTHORITY_NONCANONICAL", filePath);
  }
  return { authority, bytes };
}

function persistSealAuthority(
  stateRoot: string,
  filePath: string,
  expected: V3SealAuthorityV1,
  capacity: V3SealCapacityReservation,
): V3SealAuthorityV1 {
  const expectedBytes = `${canonicalJsonStringify(expected)}\n`;
  assertCanonicalStatePath(stateRoot, filePath, { allowMissingLeaf: !existsSync(filePath) });
  if (existsSync(filePath)) {
    const observed = readSealAuthority(filePath);
    if (observed.bytes !== expectedBytes) fail("V3_DEPLOY_SEAL_AUTHORITY_CONFLICT", filePath);
    return observed.authority;
  }
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );
  try {
    assertCanonicalStatePath(stateRoot, temporaryPath, { allowMissingLeaf: true });
    writeDurableFile(temporaryPath, expectedBytes, capacity);
    assertCanonicalStatePath(stateRoot, temporaryPath);
    chmodSync(temporaryPath, 0o400);
    const descriptor = openSync(temporaryPath, "r");
    try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
    try {
      linkSync(temporaryPath, filePath);
      assertCanonicalStatePath(stateRoot, filePath);
      fsyncDirectory(path.dirname(filePath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  } finally {
    if (existsSync(temporaryPath)) {
      unlinkSync(temporaryPath);
      fsyncDirectory(path.dirname(temporaryPath));
    }
  }
  const observed = readSealAuthority(filePath);
  if (observed.bytes !== expectedBytes) fail("V3_DEPLOY_SEAL_AUTHORITY_CONFLICT", filePath);
  return observed.authority;
}

function assertSealAuthorityRequestIdentity(input: Readonly<{
  authority: V3SealAuthorityV1;
  runId: string;
  candidateHash: string;
  expectedSource: SourceRevisionV1;
  artifact: V3BuildArtifactV1;
  runtimeDataContractHash: string;
  sealedRuntimeRef: string;
}>): void {
  if (
    input.authority.runId !== input.runId
    || input.authority.candidateHash !== input.candidateHash
    || canonicalJsonStringify(input.authority.sourceRevision) !== canonicalJsonStringify(input.expectedSource)
    || input.authority.buildArtifactHash !== input.artifact.artifactHash
    || input.authority.buildArtifactEvidenceRef !== input.artifact.evidenceRef
    || input.authority.runtimeDataContractHash !== input.runtimeDataContractHash
    || input.authority.sealedRuntimeRef !== input.sealedRuntimeRef
  ) {
    fail("V3_DEPLOY_SEAL_AUTHORITY_IDENTITY_CONFLICT", input.runId);
  }
}

type MaterializedV3SealedRuntime = Readonly<{
  root: string;
  evidenceRef: string;
  manifestHash: string;
  manifestEvidenceRef: string;
  sealAuthorityHash: string;
  sealAuthorityEvidenceRef: string;
}>;

async function adoptExistingSealedRuntime(input: Readonly<{
  stateRoot: string;
  finalRoot: string;
  authorityPath: string;
  evidenceRef: string;
  runId: string;
  candidateHash: string;
  expectedSource: SourceRevisionV1;
  artifact: V3BuildArtifactV1;
  runtimeDataContractHash: string;
  previewCwd: string;
  packageManager: string;
}>): Promise<MaterializedV3SealedRuntime> {
  assertCanonicalStatePath(input.stateRoot, input.finalRoot);
  assertCanonicalStatePath(input.stateRoot, input.authorityPath, { allowMissingLeaf: true });
  const { authority } = readSealAuthority(input.authorityPath);
  assertSealAuthorityRequestIdentity({
    authority,
    runId: input.runId,
    candidateHash: input.candidateHash,
    expectedSource: input.expectedSource,
    artifact: input.artifact,
    runtimeDataContractHash: input.runtimeDataContractHash,
    sealedRuntimeRef: input.evidenceRef,
  });
  const manifest = await verifyV3SealedRuntime({
    root: input.finalRoot,
    runId: input.runId,
    candidateHash: input.candidateHash,
    expectedSource: input.expectedSource,
    artifact: input.artifact,
    expectedRuntimeDataContractHash: input.runtimeDataContractHash,
    previewCwd: input.previewCwd,
    packageManager: input.packageManager,
    expectedManifestHash: authority.manifestHash,
    expectedManifestEvidenceRef: authority.manifestEvidenceRef,
  });
  return {
    root: input.finalRoot,
    evidenceRef: input.evidenceRef,
    manifestHash: manifest.manifestHash,
    manifestEvidenceRef: manifest.evidenceRef,
    sealAuthorityHash: authority.authorityHash,
    sealAuthorityEvidenceRef: authority.evidenceRef,
  };
}

export function sealedRuntimeEvidenceRef(input: Readonly<{
  runId: string;
  candidateHash: string;
  artifactHash: string;
}>): string {
  return `setfarm://deploy/sealed-runtime/${input.runId}/${input.candidateHash}/${input.artifactHash}`;
}

export type V3SealDurabilityBoundary =
  | "tree_durable"
  | "authority_durable"
  | "root_renamed";

export type V3SealMaterializationInput = Readonly<{
  stateRoot: string;
  runId: string;
  candidateHash: string;
  expectedSource: SourceRevisionV1;
  worktree: string;
  artifact: V3BuildArtifactV1;
  runtimeDataContractHash: string;
  previewCwd: string;
  packageManager: string;
  capacityLimits?: V3SealCapacityLimits;
  onDurabilityBoundary?: (boundary: V3SealDurabilityBoundary) => void;
}>;

export async function materializeV3SealedRuntime(
  input: V3SealMaterializationInput,
): Promise<MaterializedV3SealedRuntime> {
  if (!/^[a-f0-9]{64}$/.test(input.candidateHash)) {
    fail("V3_DEPLOY_SEALED_RUNTIME_IDENTITY_INVALID", input.candidateHash);
  }
  if (!/^[a-f0-9]{64}$/.test(input.artifact.artifactHash)) {
    fail("V3_DEPLOY_SEALED_RUNTIME_IDENTITY_INVALID", input.artifact.artifactHash);
  }
  const stateRoot = ensureCanonicalV3StateRoot(input.stateRoot);
  const sealedRoot = path.join(stateRoot, "sealed");
  ensureCanonicalStateDirectory(stateRoot, sealedRoot);
  const candidateRoot = path.join(sealedRoot, input.candidateHash);
  ensureCanonicalStateDirectory(stateRoot, candidateRoot);
  const finalRoot = path.join(candidateRoot, input.artifact.artifactHash);
  assertCanonicalStatePath(stateRoot, finalRoot, { allowMissingLeaf: !existsSync(finalRoot) });
  return withV3SealCapacityAdmission({
    sealedRoot,
    createsSeal: !existsSync(finalRoot),
    limits: input.capacityLimits,
    operation: (capacity) => materializeV3SealedRuntimeUnderAdmission(
      { ...input, stateRoot },
      capacity,
    ),
  });
}

async function materializeV3SealedRuntimeUnderAdmission(
  input: Omit<V3SealMaterializationInput, "capacityLimits">,
  capacity: V3SealCapacityReservation,
): Promise<MaterializedV3SealedRuntime> {
  const stateRoot = input.stateRoot;
  const worktree = realpathSync(path.resolve(input.worktree));
  const sealedBase = path.join(stateRoot, "sealed", input.candidateHash);
  const finalRoot = path.join(sealedBase, input.artifact.artifactHash);
  const evidenceRef = sealedRuntimeEvidenceRef({
    runId: input.runId,
    candidateHash: input.candidateHash,
    artifactHash: input.artifact.artifactHash,
  });
  const authorityPath = v3SealAuthorityFilePath({
    stateRoot,
    candidateHash: input.candidateHash,
    artifactHash: input.artifact.artifactHash,
  });
  ensureCanonicalStateDirectory(stateRoot, sealedBase);
  assertCanonicalStatePath(stateRoot, finalRoot, { allowMissingLeaf: !existsSync(finalRoot) });
  assertCanonicalStatePath(stateRoot, authorityPath, { allowMissingLeaf: !existsSync(authorityPath) });
  if (existsSync(finalRoot)) {
    return adoptExistingSealedRuntime({
      stateRoot,
      finalRoot,
      authorityPath,
      evidenceRef,
      runId: input.runId,
      candidateHash: input.candidateHash,
      expectedSource: input.expectedSource,
      artifact: input.artifact,
      runtimeDataContractHash: input.runtimeDataContractHash,
      previewCwd: input.previewCwd,
      packageManager: input.packageManager,
    });
  }

  const temporaryRoot = path.join(sealedBase, `.${input.artifact.artifactHash}.${randomUUID()}.tmp`);
  assertCanonicalStatePath(stateRoot, temporaryRoot, { allowMissingLeaf: true });
  mkdirSync(temporaryRoot, { recursive: false, mode: 0o700 });
  assertCanonicalStatePath(stateRoot, temporaryRoot);
  try {
    if (input.artifact.files.some((file) => file.path === SEALED_RUNTIME_MANIFEST_FILE)) {
      fail("V3_DEPLOY_SEALED_RUNTIME_MANIFEST_PATH_CONFLICT", SEALED_RUNTIME_MANIFEST_FILE);
    }
    const sourcePaths = await listAcceptedSourcePaths(worktree);
    const sourceArtifactOverlapPaths = copyAcceptedSource({
      worktree,
      destination: temporaryRoot,
      sourcePaths,
      artifact: input.artifact,
      capacity,
    });
    if (existsSync(path.join(temporaryRoot, SEALED_RUNTIME_MANIFEST_FILE))) {
      fail("V3_DEPLOY_SEALED_RUNTIME_MANIFEST_PATH_CONFLICT", SEALED_RUNTIME_MANIFEST_FILE);
    }
    const gitDirectory = (await execFileAsync(
      "git",
      ["rev-parse", "--absolute-git-dir"],
      { cwd: worktree, timeout: 10_000, maxBuffer: 1_000_000 },
    )).stdout.trim();
    writeDurableFile(
      path.join(temporaryRoot, ".git"),
      `gitdir: ${gitDirectory}\n`,
      capacity,
    );
    const sealedSource = await captureShadowSourceRevision(temporaryRoot);
    if (
      sealedSource.sha !== input.expectedSource.sha
      || sealedSource.treeHash !== input.expectedSource.treeHash
    ) {
      fail("V3_DEPLOY_SEALED_SOURCE_REVISION_MISMATCH", input.runId);
    }
    unlinkSync(path.join(temporaryRoot, ".git"));

    copyBuildArtifact({
      worktree,
      destination: temporaryRoot,
      artifact: input.artifact,
      sourceArtifactOverlapPaths,
      capacity,
    });
    const observedArtifact = await captureV3BuildArtifact({
      runId: input.runId,
      worktree: temporaryRoot,
      outputPaths: input.artifact.outputPaths,
    });
    if (!exactV3BuildArtifactMatch(input.artifact, observedArtifact)) {
      fail("V3_DEPLOY_BUILD_OUTPUT_DRIFT", input.artifact.artifactHash);
    }
    const dependencyRoots = copyRuntimeDependencies({
      worktree,
      destination: temporaryRoot,
      previewCwd: input.previewCwd,
      packageManager: input.packageManager,
      capacity,
    });
    const manifest = await captureSealedRuntimeManifest({
      root: temporaryRoot,
      runId: input.runId,
      candidateHash: input.candidateHash,
      sourceRevision: input.expectedSource,
      buildArtifactHash: input.artifact.artifactHash,
      runtimeDataContractHash: input.runtimeDataContractHash,
      dependencyRoots,
    });
    const manifestBytes = `${canonicalJsonStringify(manifest)}\n`;
    writeDurableFile(
      path.join(temporaryRoot, SEALED_RUNTIME_MANIFEST_FILE),
      manifestBytes,
      capacity,
    );
    makeTreeReadOnly(temporaryRoot);
    fsyncTree(temporaryRoot);
    input.onDurabilityBoundary?.("tree_durable");
    const sealAuthority = persistSealAuthority(stateRoot, authorityPath, createV3SealAuthorityV1({
      schema: "setfarm.v3-seal-authority.v1",
      runId: input.runId,
      candidateHash: input.candidateHash,
      sourceRevision: input.expectedSource,
      buildArtifactHash: input.artifact.artifactHash,
      buildArtifactEvidenceRef: input.artifact.evidenceRef,
      runtimeDataContractHash: input.runtimeDataContractHash,
      sealedRuntimeRef: evidenceRef,
      manifestHash: manifest.manifestHash,
      manifestEvidenceRef: manifest.evidenceRef,
      fileCount: manifest.files.length + 1,
      totalBytes: manifest.totalBytes + Buffer.byteLength(manifestBytes),
    }), capacity);
    input.onDurabilityBoundary?.("authority_durable");
    assertCanonicalStatePath(stateRoot, finalRoot, { allowMissingLeaf: !existsSync(finalRoot) });
    if (existsSync(finalRoot)) {
      makeTreeWritable(temporaryRoot);
      removeTemporary(temporaryRoot);
      return adoptExistingSealedRuntime({
        stateRoot,
        finalRoot,
        authorityPath,
        evidenceRef,
        runId: input.runId,
        candidateHash: input.candidateHash,
        expectedSource: input.expectedSource,
        artifact: input.artifact,
        runtimeDataContractHash: input.runtimeDataContractHash,
        previewCwd: input.previewCwd,
        packageManager: input.packageManager,
      });
    }
    try {
      renameSync(temporaryRoot, finalRoot);
      assertCanonicalStatePath(stateRoot, finalRoot);
    } catch (error) {
      if (!existsSync(finalRoot)) throw error;
      makeTreeWritable(temporaryRoot);
      removeTemporary(temporaryRoot);
      return adoptExistingSealedRuntime({
        stateRoot,
        finalRoot,
        authorityPath,
        evidenceRef,
        runId: input.runId,
        candidateHash: input.candidateHash,
        expectedSource: input.expectedSource,
        artifact: input.artifact,
        runtimeDataContractHash: input.runtimeDataContractHash,
        previewCwd: input.previewCwd,
        packageManager: input.packageManager,
      });
    }
    fsyncDirectory(sealedBase);
    input.onDurabilityBoundary?.("root_renamed");
    return {
      root: finalRoot,
      evidenceRef,
      manifestHash: manifest.manifestHash,
      manifestEvidenceRef: manifest.evidenceRef,
      sealAuthorityHash: sealAuthority.authorityHash,
      sealAuthorityEvidenceRef: sealAuthority.evidenceRef,
    };
  } catch (error) {
    // Restore permissions before best-effort removal if read-only sealing had
    // already started.
    try { makeTreeWritable(temporaryRoot); } catch { /* no temporary root */ }
    removeTemporary(temporaryRoot);
    throw error;
  }
}
