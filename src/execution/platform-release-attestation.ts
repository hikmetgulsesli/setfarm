import { createHash } from "node:crypto";
import { lstatSync, realpathSync, type Stats } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

import { readRegularFileAtMostSync } from "../lib/bounded-file-read.js";
import { GitObjectHashSchema } from "../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_MANIFEST_RELATIVE_PATH,
  PLATFORM_RELEASE_STITCH_CONVERTER_LOCATOR,
  PLATFORM_RELEASE_STITCH_CONVERTER_MAX_BYTES,
  PlatformReleaseManifestV1Schema,
  type PlatformReleaseConverterSourceV1,
  type PlatformReleaseManifestV1,
} from "./schemas/platform-release-manifest-v1.js";

const PLATFORM_RELEASE_MANIFEST_FILE = path.basename(PLATFORM_RELEASE_MANIFEST_RELATIVE_PATH);
const PLATFORM_RELEASE_CONVERTER_FILE = path.basename(PLATFORM_RELEASE_STITCH_CONVERTER_LOCATOR);
const PLATFORM_RELEASE_MANIFEST_MAX_BYTES = 64 * 1024;

export type PlatformReleaseAttestationErrorCode =
  | "PLATFORM_RELEASE_MANIFEST_MISSING_OR_INVALID"
  | "PLATFORM_RELEASE_SHA_MISMATCH"
  | "PLATFORM_RELEASE_CONVERTER_MISSING_OR_INVALID"
  | "PLATFORM_RELEASE_CONVERTER_MISMATCH";

export class PlatformReleaseAttestationError extends Error {
  constructor(
    readonly code: PlatformReleaseAttestationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PlatformReleaseAttestationError";
  }
}

export type PlatformReleaseAttestationV1 = Readonly<{
  manifest: PlatformReleaseManifestV1;
  converterSourceRef: PlatformReleaseConverterSourceV1;
  converterSource: string;
}>;

type AnchoredDirectory = Readonly<{
  path: string;
  dev: number;
  ino: number;
}>;

function fail(
  code: PlatformReleaseAttestationErrorCode,
  message: string,
): never {
  throw new PlatformReleaseAttestationError(code, message);
}

function immutableManifest(manifest: PlatformReleaseManifestV1): PlatformReleaseManifestV1 {
  const source = Object.freeze({ ...manifest.stitchConverter.source });
  const stitchConverter = Object.freeze({ ...manifest.stitchConverter, source });
  return Object.freeze({ ...manifest, stitchConverter });
}

function isStrictDescendant(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative.length > 0
    && relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

function snapshotDirectory(
  directoryPath: string,
  errorCode: PlatformReleaseAttestationErrorCode,
  message: string,
): AnchoredDirectory {
  try {
    const stats = lstatSync(directoryPath);
    if (stats.isSymbolicLink() || !stats.isDirectory()) fail(errorCode, message);
    if (realpathSync(directoryPath) !== directoryPath) fail(errorCode, message);
    return Object.freeze({ path: directoryPath, dev: stats.dev, ino: stats.ino });
  } catch (error) {
    if (error instanceof PlatformReleaseAttestationError) throw error;
    fail(errorCode, message);
  }
}

function anchorPlatformRoot(platformRoot: string): AnchoredDirectory {
  if (!platformRoot.trim()) {
    fail(
      "PLATFORM_RELEASE_MANIFEST_MISSING_OR_INVALID",
      "Platform root must resolve to one real directory",
    );
  }
  try {
    const realRoot = realpathSync(path.resolve(platformRoot));
    return snapshotDirectory(
      realRoot,
      "PLATFORM_RELEASE_MANIFEST_MISSING_OR_INVALID",
      "Platform root must resolve to one real directory",
    );
  } catch (error) {
    if (error instanceof PlatformReleaseAttestationError) throw error;
    fail(
      "PLATFORM_RELEASE_MANIFEST_MISSING_OR_INVALID",
      "Platform root must resolve to one real directory",
    );
  }
}

function anchorChildDirectory(
  root: AnchoredDirectory,
  childName: "dist" | "scripts",
  errorCode: PlatformReleaseAttestationErrorCode,
  message: string,
): AnchoredDirectory {
  const candidate = path.resolve(root.path, childName);
  if (!isStrictDescendant(root.path, candidate)) fail(errorCode, message);
  return snapshotDirectory(candidate, errorCode, message);
}

function assertDirectoryUnchanged(
  snapshot: AnchoredDirectory,
  errorCode: PlatformReleaseAttestationErrorCode,
  message: string,
): void {
  let stats: Stats;
  try {
    stats = lstatSync(snapshot.path);
    if (
      stats.isSymbolicLink()
      || !stats.isDirectory()
      || stats.dev !== snapshot.dev
      || stats.ino !== snapshot.ino
      || realpathSync(snapshot.path) !== snapshot.path
    ) {
      fail(errorCode, message);
    }
  } catch (error) {
    if (error instanceof PlatformReleaseAttestationError) throw error;
    fail(errorCode, message);
  }
}

function readManifest(dist: AnchoredDirectory): PlatformReleaseManifestV1 {
  try {
    const manifestPath = path.join(dist.path, PLATFORM_RELEASE_MANIFEST_FILE);
    const exact = readRegularFileAtMostSync(manifestPath, PLATFORM_RELEASE_MANIFEST_MAX_BYTES);
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(exact.bytes);
    return immutableManifest(PlatformReleaseManifestV1Schema.parse(JSON.parse(text)));
  } catch {
    fail(
      "PLATFORM_RELEASE_MANIFEST_MISSING_OR_INVALID",
      `${PLATFORM_RELEASE_MANIFEST_RELATIVE_PATH} must be one strict, stable, bounded release manifest`,
    );
  }
}

function readConverterSource(scripts: AnchoredDirectory): Readonly<{
  text: string;
  hash: string;
  byteLength: number;
}> {
  try {
    const converterPath = path.join(scripts.path, PLATFORM_RELEASE_CONVERTER_FILE);
    const exact = readRegularFileAtMostSync(
      converterPath,
      PLATFORM_RELEASE_STITCH_CONVERTER_MAX_BYTES,
    );
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(exact.bytes);
    if (!Buffer.from(text, "utf8").equals(exact.bytes)) {
      fail(
        "PLATFORM_RELEASE_CONVERTER_MISSING_OR_INVALID",
        `${PLATFORM_RELEASE_STITCH_CONVERTER_LOCATOR} must round-trip as exact UTF-8 bytes`,
      );
    }
    return Object.freeze({
      text,
      hash: createHash("sha256").update(exact.bytes).digest("hex"),
      byteLength: exact.byteLength,
    });
  } catch (error) {
    if (error instanceof PlatformReleaseAttestationError) throw error;
    fail(
      "PLATFORM_RELEASE_CONVERTER_MISSING_OR_INVALID",
      `${PLATFORM_RELEASE_STITCH_CONVERTER_LOCATOR} must be one stable, bounded UTF-8 regular file`,
    );
  }
}

export function verifyPlatformReleaseManifestV1(input: Readonly<{
  platformRoot: string;
  expectedReleaseSha: string;
}>): PlatformReleaseAttestationV1 {
  const expectedReleaseSha = input.expectedReleaseSha.trim().toLowerCase();
  if (!GitObjectHashSchema.safeParse(expectedReleaseSha).success) {
    fail(
      "PLATFORM_RELEASE_SHA_MISMATCH",
      "Expected compiler release SHA must be one full lowercase Git object hash",
    );
  }

  const root = anchorPlatformRoot(input.platformRoot);
  const dist = anchorChildDirectory(
    root,
    "dist",
    "PLATFORM_RELEASE_MANIFEST_MISSING_OR_INVALID",
    "Platform dist parent must be one real in-root directory",
  );
  const manifest = readManifest(dist);
  if (manifest.releaseSha !== expectedReleaseSha) {
    fail(
      "PLATFORM_RELEASE_SHA_MISMATCH",
      "Platform release manifest does not match the expected compiler release SHA",
    );
  }

  const scripts = anchorChildDirectory(
    root,
    "scripts",
    "PLATFORM_RELEASE_CONVERTER_MISSING_OR_INVALID",
    "Platform scripts parent must be one real in-root directory",
  );
  const converter = readConverterSource(scripts);
  assertDirectoryUnchanged(
    root,
    "PLATFORM_RELEASE_MANIFEST_MISSING_OR_INVALID",
    "Platform root changed while release authority was being verified",
  );
  assertDirectoryUnchanged(
    dist,
    "PLATFORM_RELEASE_MANIFEST_MISSING_OR_INVALID",
    "Platform dist parent changed while release authority was being verified",
  );
  assertDirectoryUnchanged(
    scripts,
    "PLATFORM_RELEASE_CONVERTER_MISSING_OR_INVALID",
    "Platform scripts parent changed while release authority was being verified",
  );

  if (
    converter.hash !== manifest.stitchConverter.source.hash
    || converter.byteLength !== manifest.stitchConverter.source.byteLength
  ) {
    fail(
      "PLATFORM_RELEASE_CONVERTER_MISMATCH",
      "Platform Stitch converter bytes do not match the release manifest",
    );
  }

  return Object.freeze({
    manifest,
    converterSourceRef: manifest.stitchConverter.source,
    converterSource: converter.text,
  });
}
