import { createHash } from "node:crypto";
import { createReadStream, lstatSync, realpathSync, readdirSync, type Stats } from "node:fs";
import path from "node:path";

import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import { NormalizedRelativeLocatorSchema } from "../product-compiler/schemas/common-v1.js";
import {
  createV3BuildArtifactV1,
  V3_BUILD_ARTIFACT_MAX_FILE_BYTES,
  V3_BUILD_ARTIFACT_MAX_FILES,
  V3_BUILD_ARTIFACT_MAX_TOTAL_BYTES,
  type V3BuildArtifactFileV1,
  type V3BuildArtifactV1,
} from "./schemas/v3-deploy-receipt-v1.js";

const MAX_BUILD_ARTIFACT_DIRECTORIES = 50_000;

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code: string, detail: string): never {
  throw new Error(`${code}:${detail.slice(0, 500)}`);
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

function assertWithinRoot(root: string, target: string, locator: string): void {
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    fail("V3_DEPLOY_BUILD_OUTPUT_ESCAPE", locator);
  }
}

function assertNoSymlinkPath(root: string, locator: string): string {
  const target = path.resolve(root, locator);
  assertWithinRoot(root, target, locator);
  let current = root;
  for (const segment of locator.split("/")) {
    current = path.join(current, segment);
    let stats: Stats;
    try {
      stats = lstatSync(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        fail("V3_DEPLOY_BUILD_OUTPUT_MISSING", locator);
      }
      throw error;
    }
    if (stats.isSymbolicLink()) fail("V3_DEPLOY_BUILD_OUTPUT_SYMLINK", locator);
  }
  const canonicalTarget = realpathSync(target);
  assertWithinRoot(root, canonicalTarget, locator);
  if (canonicalTarget !== target) fail("V3_DEPLOY_BUILD_OUTPUT_ESCAPE", locator);
  return target;
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

/**
 * Captures the exact bytes launched by v3 deploy. The manifest is deliberately
 * derived only from the versioned BuildTopology output contract: no stack or
 * generated-project heuristics are allowed here.
 */
export async function captureV3BuildArtifact(input: Readonly<{
  runId: string;
  worktree: string;
  outputPaths: readonly string[];
  limits?: Readonly<{
    maxFiles?: number;
    maxFileBytes?: number;
    maxTotalBytes?: number;
    maxDirectories?: number;
  }>;
  afterFileHashed?: (locator: string) => void | Promise<void>;
}>): Promise<V3BuildArtifactV1> {
  const maxFiles = Math.min(input.limits?.maxFiles ?? V3_BUILD_ARTIFACT_MAX_FILES, V3_BUILD_ARTIFACT_MAX_FILES);
  const maxFileBytes = Math.min(
    input.limits?.maxFileBytes ?? V3_BUILD_ARTIFACT_MAX_FILE_BYTES,
    V3_BUILD_ARTIFACT_MAX_FILE_BYTES,
  );
  const maxTotalBytes = Math.min(
    input.limits?.maxTotalBytes ?? V3_BUILD_ARTIFACT_MAX_TOTAL_BYTES,
    V3_BUILD_ARTIFACT_MAX_TOTAL_BYTES,
  );
  const maxDirectories = Math.min(
    input.limits?.maxDirectories ?? MAX_BUILD_ARTIFACT_DIRECTORIES,
    MAX_BUILD_ARTIFACT_DIRECTORIES,
  );
  if ([maxFiles, maxFileBytes, maxTotalBytes, maxDirectories].some((limit) =>
    !Number.isInteger(limit) || limit < 1)) {
    fail("V3_DEPLOY_BUILD_OUTPUT_LIMIT_INVALID", input.runId);
  }
  const outputPaths = input.outputPaths.map((entry) => NormalizedRelativeLocatorSchema.parse(entry))
    .sort(compareCodeUnits);
  if (outputPaths.length === 0) fail("V3_DEPLOY_BUILD_OUTPUT_CONTRACT_EMPTY", input.runId);
  if (new Set(outputPaths).size !== outputPaths.length) {
    fail("V3_DEPLOY_BUILD_OUTPUT_CONTRACT_DUPLICATE", input.runId);
  }
  outputPaths.forEach((entry, index) => {
    if (outputPaths.some((candidate, candidateIndex) =>
      candidateIndex !== index && entry.startsWith(`${candidate}/`))) {
      fail("V3_DEPLOY_BUILD_OUTPUT_CONTRACT_OVERLAP", entry);
    }
  });

  const root = realpathSync(path.resolve(input.worktree));
  const rootBefore = stableStat(lstatSync(root));
  if (!lstatSync(root).isDirectory()) fail("V3_DEPLOY_WORKTREE_INVALID", root);

  const files: V3BuildArtifactFileV1[] = [];
  const directories: DirectorySnapshot[] = [];
  let directoryCount = 0;
  let totalBytes = 0;

  const captureFile = async (absolutePath: string, locator: string): Promise<void> => {
    if (files.length >= maxFiles) {
      fail("V3_DEPLOY_BUILD_OUTPUT_FILE_LIMIT", String(maxFiles));
    }
    const beforeStats = lstatSync(absolutePath);
    if (beforeStats.isSymbolicLink()) fail("V3_DEPLOY_BUILD_OUTPUT_SYMLINK", locator);
    if (!beforeStats.isFile()) fail("V3_DEPLOY_BUILD_OUTPUT_SPECIAL_FILE", locator);
    if (beforeStats.size > maxFileBytes) {
      fail("V3_DEPLOY_BUILD_OUTPUT_FILE_SIZE_LIMIT", locator);
    }
    totalBytes += beforeStats.size;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > maxTotalBytes) {
      fail("V3_DEPLOY_BUILD_OUTPUT_TOTAL_SIZE_LIMIT", String(maxTotalBytes));
    }
    const before = stableStat(beforeStats);
    const contentHash = await hashFile(absolutePath);
    await input.afterFileHashed?.(locator);
    const afterStats = lstatSync(absolutePath);
    if (!afterStats.isFile() || !sameStableStat(before, stableStat(afterStats))) {
      fail("V3_DEPLOY_BUILD_OUTPUT_DRIFT", locator);
    }
    files.push({
      path: NormalizedRelativeLocatorSchema.parse(locator),
      byteLength: beforeStats.size,
      contentHash,
      executable: (beforeStats.mode & 0o111) !== 0,
    });
  };

  const visit = async (absolutePath: string, locator: string): Promise<void> => {
    const stats = lstatSync(absolutePath);
    if (stats.isSymbolicLink()) fail("V3_DEPLOY_BUILD_OUTPUT_SYMLINK", locator);
    if (stats.isFile()) {
      await captureFile(absolutePath, locator);
      return;
    }
    if (!stats.isDirectory()) fail("V3_DEPLOY_BUILD_OUTPUT_SPECIAL_FILE", locator);
    directoryCount += 1;
    if (directoryCount > maxDirectories) {
      fail("V3_DEPLOY_BUILD_OUTPUT_DIRECTORY_LIMIT", String(maxDirectories));
    }
    const entries = readdirSync(absolutePath).sort(compareCodeUnits);
    directories.push({ absolutePath, locator, stat: stableStat(stats), entries });
    for (const entry of entries) {
      const childLocator = NormalizedRelativeLocatorSchema.parse(`${locator}/${entry}`);
      await visit(path.join(absolutePath, entry), childLocator);
    }
  };

  for (const outputPath of outputPaths) {
    const beforeCount = files.length;
    const absolutePath = assertNoSymlinkPath(root, outputPath);
    await visit(absolutePath, outputPath);
    if (files.length === beforeCount) fail("V3_DEPLOY_BUILD_OUTPUT_EMPTY", outputPath);
  }

  for (const directory of directories) {
    const afterStats = lstatSync(directory.absolutePath);
    const afterEntries = readdirSync(directory.absolutePath).sort(compareCodeUnits);
    if (
      !afterStats.isDirectory()
      || !sameStableStat(directory.stat, stableStat(afterStats))
      || canonicalJsonStringify(afterEntries) !== canonicalJsonStringify(directory.entries)
    ) {
      fail("V3_DEPLOY_BUILD_OUTPUT_DRIFT", directory.locator);
    }
  }
  if (realpathSync(path.resolve(input.worktree)) !== root) {
    fail("V3_DEPLOY_WORKTREE_DRIFT", input.worktree);
  }
  const rootAfter = stableStat(lstatSync(root));
  if (rootBefore.dev !== rootAfter.dev || rootBefore.ino !== rootAfter.ino) {
    fail("V3_DEPLOY_WORKTREE_DRIFT", input.worktree);
  }

  files.sort((left, right) => compareCodeUnits(left.path, right.path));
  return createV3BuildArtifactV1({
    schema: "setfarm.v3-build-artifact.v1",
    runId: input.runId,
    outputPaths,
    files,
    totalBytes,
  });
}

export function exactV3BuildArtifactMatch(
  expected: V3BuildArtifactV1,
  observed: V3BuildArtifactV1,
): boolean {
  return expected.artifactHash === observed.artifactHash
    && canonicalJsonStringify(expected) === canonicalJsonStringify(observed);
}
