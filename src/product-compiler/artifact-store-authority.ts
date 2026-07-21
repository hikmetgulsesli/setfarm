import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { constants, type Stats } from "node:fs";
import {
  lstat,
  link,
  mkdir,
  open,
  opendir,
  readdir,
  rmdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import type postgres from "postgres";
import { z } from "zod";

import { canonicalJsonBytes } from "./canonical-json.js";

export const ARTIFACT_STORE_AUTHORITY_SCHEMA_V1 =
  "setfarm.artifact-store-authority.v1" as const;
export const ARTIFACT_STORE_ROOT_AUTHORITY_SCHEMA_V1 =
  "setfarm.artifact-store-root-authority.v1" as const;
export const ARTIFACT_STORE_ROOT_BINDING_CLAIM_SCHEMA_V1 =
  "setfarm.artifact-store-root-binding-claim.v1" as const;
export const ARTIFACT_STORE_ROOT_LOCATOR_SCHEMA_V1 =
  "setfarm.artifact-store-root-locator.v1" as const;
export const ARTIFACT_STORE_KERNEL_LOCK_SCHEMA_V1 =
  "setfarm.artifact-store-kernel-lock.v1" as const;
export const ARTIFACT_STORE_ROOT_AUTHORITY_FILENAME_V1 =
  ".setfarm-artifact-root-authority.json" as const;
export const ARTIFACT_STORE_KERNEL_LOCK_FILENAME_V1 =
  ".setfarm-artifact-root-kernel-lock.json" as const;
export const ARTIFACT_STORE_CAPACITY_LOCK_DOMAIN_V1 =
  "setfarm.semantic-artifact-filesystem-publication.v1" as const;
export const ARTIFACT_STORE_CAPACITY_LEASE_AUTHORITY_V1 =
  "postgres-transaction+filesystem-kernel-v1" as const;
export const ARTIFACT_STORE_STAGING_DIRECTORY_V1 = ".staging" as const;
export const ARTIFACT_STORE_STAGING_MAX_ATTEMPTS_V1 = 64;
export const ARTIFACT_STORE_STAGING_MAX_FILES_PER_ATTEMPT_V1 = 9;
export const ARTIFACT_STORE_STAGING_MAX_ENTRIES_V1 = 640;
export const MAX_ARTIFACT_INVENTORY_FINAL_FILES_V1 = 100_000;

const AUTHORITY_KEY = "semantic-artifacts" as const;
const MAX_AUTHORITY_FILE_BYTES = 1_024;
const DEFAULT_LOCK_TIMEOUT_MS = 30_000;
const DEFAULT_WORK_TIMEOUT_MS = 5 * 60_000;
const MAX_DIAGNOSTIC_BYTES = 4_000;
const LOCKF_PATH = "/usr/bin/lockf" as const;
const KERNEL_LOCK_RETRY_MS = 5;
const LOCKF_TEMPFAIL_EXIT = 75;
const LOCK_HELPER_SOURCE = [
  "'use strict';",
  "const token = process.argv[1];",
  "if (!token) process.exit(64);",
  "process.stdout.write(token + '\\n');",
  "process.stdin.resume();",
  "process.stdin.on('end', () => process.exit(0));",
  "process.stdin.on('error', () => process.exit(74));",
].join("");

const LowerUuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const ArtifactStoreRootAuthorityV1Schema = z.object({
  schema: z.literal(ARTIFACT_STORE_ROOT_AUTHORITY_SCHEMA_V1),
  authorityId: LowerUuidSchema,
  rootLocatorHash: Sha256Schema,
}).strict();

export type ArtifactStoreRootAuthorityV1 = z.infer<
  typeof ArtifactStoreRootAuthorityV1Schema
>;

export const ArtifactStoreRootBindingClaimV1Schema = z.object({
  schema: z.literal(ARTIFACT_STORE_ROOT_BINDING_CLAIM_SCHEMA_V1),
  authorityId: LowerUuidSchema,
  rootLocatorHash: Sha256Schema,
  rootBasenameHash: Sha256Schema,
}).strict();

export type ArtifactStoreRootBindingClaimV1 = z.infer<
  typeof ArtifactStoreRootBindingClaimV1Schema
>;

export const ArtifactStoreKernelLockV1Schema = z.object({
  schema: z.literal(ARTIFACT_STORE_KERNEL_LOCK_SCHEMA_V1),
  authorityId: LowerUuidSchema,
  rootLocatorHash: Sha256Schema,
  lockDomain: z.literal(ARTIFACT_STORE_CAPACITY_LOCK_DOMAIN_V1),
}).strict();

export type ArtifactStoreKernelLockV1 = z.infer<
  typeof ArtifactStoreKernelLockV1Schema
>;

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

type AuthorityRow = Readonly<{
  authority_key: string;
  authority_schema: string;
  authority_id: string;
  root_locator_hash: string;
  state: "binding" | "ready" | "quarantined";
  diagnostic: string | null;
}>;

type FileIdentity = Readonly<{ dev: number; ino: number }>;
type MarkerFileIdentity = Readonly<FileIdentity & {
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  nlink: number;
  mode: number;
  uid: number;
}>;
type HeldRootAuthority = Readonly<{
  root: FileIdentity;
  marker: MarkerFileIdentity;
  kernelLock: MarkerFileIdentity;
}>;
type StagingDirectoryIdentity = Readonly<FileIdentity & {
  mode: number;
  uid: number;
}>;
type StagingFileIdentity = Readonly<FileIdentity & {
  mode: number;
  uid: number;
  nlink: number;
}>;
type StagingAttemptInventory = Readonly<{
  name: string;
  path: string;
  identity: StagingDirectoryIdentity;
  files: readonly Readonly<{
    name: string;
    path: string;
    identity: StagingFileIdentity;
    finalAliasPath?: string;
  }>[];
}>;

export type ArtifactStoreAuthorityErrorCode =
  | "ARTIFACT_CAPACITY_AUTHORITY_DATABASE_INVALID"
  | "ARTIFACT_CAPACITY_AUTHORITY_LOCK_TIMEOUT"
  | "ARTIFACT_CAPACITY_AUTHORITY_LOST"
  | "ARTIFACT_CAPACITY_AUTHORITY_NOT_READY"
  | "ARTIFACT_CAPACITY_AUTHORITY_PLATFORM_UNSUPPORTED"
  | "ARTIFACT_CAPACITY_AUTHORITY_QUARANTINED"
  | "ARTIFACT_CAPACITY_AUTHORITY_WORK_TIMEOUT"
  | "ARTIFACT_ROOT_AUTHORITY_CONFLICT"
  | "ARTIFACT_ROOT_AUTHORITY_INVALID"
  | "ARTIFACT_ROOT_AUTHORITY_UNAVAILABLE"
  | "ARTIFACT_ROOT_AUTHORITY_UNMARKED"
  | "ARTIFACT_ROOT_AUTHORITY_WRONG_ROOT"
  | "ARTIFACT_ROOT_INVENTORY_LIMIT_EXCEEDED"
  | "ARTIFACT_ROOT_STAGING_INVALID";

export class ArtifactStoreAuthorityError extends Error {
  readonly code: ArtifactStoreAuthorityErrorCode;
  override readonly cause?: unknown;

  constructor(
    code: ArtifactStoreAuthorityErrorCode,
    message: string,
    options: Readonly<{ cause?: unknown }> = {},
  ) {
    super(message);
    this.name = "ArtifactStoreAuthorityError";
    this.code = code;
    this.cause = options.cause;
  }
}

export type ArtifactStoreCapacityLease = Readonly<{
  authority: typeof ARTIFACT_STORE_CAPACITY_LEASE_AUTHORITY_V1;
  authorityId: string;
  rootLocatorHash: string;
  signal: AbortSignal;
  assertCurrent(): Promise<void>;
}>;

export type ArtifactStoreCapacityLeaseProvider = Readonly<{
  authority: typeof ARTIFACT_STORE_CAPACITY_LEASE_AUTHORITY_V1;
  artifactRoot: string;
  withLease<T>(
    work: (lease: ArtifactStoreCapacityLease) => Promise<T>,
  ): Promise<T>;
}>;

export type ArtifactStoreCapacityLeasePurposeV1 =
  | "writer"
  | "existing-writer"
  | "reader"
  | "inventory-verify"
  | "inventory-adoption";

type AuthorityTestHooks = Readonly<{
  afterBindingCommit?: (
    event: Readonly<{ authorityId: string; rootLocatorHash: string }>,
  ) => void | Promise<void>;
  afterMarkerCreate?: (
    event: Readonly<{ authorityId: string; rootLocatorHash: string }>,
  ) => void | Promise<void>;
  afterRootCreate?: (
    event: Readonly<{ authorityId: string; rootLocatorHash: string }>,
  ) => void | Promise<void>;
  afterReadyCommit?: (
    event: Readonly<{ authorityId: string; rootLocatorHash: string }>,
  ) => void | Promise<void>;
  afterKernelLockAcquired?: (
    event: Readonly<{ pid: number; target: string; token: string }>,
  ) => void | Promise<void>;
  beforeKernelParentHandleClose?: (
    event: Readonly<{ pid: number; target: string; token: string }>,
  ) => void | Promise<void>;
  afterKernelLockReleased?: (
    event: Readonly<{ pid: number; target: string; token: string }>,
  ) => void | Promise<void>;
  afterStagingInventory?: (
    event: Readonly<{ stagingRoot: string; attemptCount: number; entryCount: number }>,
  ) => void | Promise<void>;
  beforeStagingSync?: (
    event: Readonly<{ stagingRoot: string }>,
  ) => void | Promise<void>;
}>;

const hybridProviders = new WeakSet<object>();
const hybridProviderPurposes = new WeakMap<object, ArtifactStoreCapacityLeasePurposeV1>();
const authorityEvidenceErrors = new WeakSet<object>();

function authorityEvidence<T extends ArtifactStoreAuthorityError>(error: T): T {
  authorityEvidenceErrors.add(error);
  return error;
}

function isAuthorityEvidenceError(
  error: unknown,
): error is ArtifactStoreAuthorityError {
  return typeof error === "object"
    && error !== null
    && authorityEvidenceErrors.has(error);
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

function identity(stats: Pick<Stats, "dev" | "ino">): FileIdentity {
  return Object.freeze({ dev: stats.dev, ino: stats.ino });
}

function sameIdentity(
  left: Pick<Stats, "dev" | "ino">,
  right: Pick<Stats, "dev" | "ino">,
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function markerIdentity(stats: Stats): MarkerFileIdentity {
  return Object.freeze({
    dev: stats.dev,
    ino: stats.ino,
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    ctimeMs: stats.ctimeMs,
    nlink: stats.nlink,
    mode: stats.mode & 0o7777,
    uid: stats.uid,
  });
}

function sameMarkerIdentity(
  left: MarkerFileIdentity,
  right: MarkerFileIdentity,
): boolean {
  return sameIdentity(left, right)
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs
    && left.nlink === right.nlink
    && left.mode === right.mode
    && left.uid === right.uid;
}

function expectedUid(): number | undefined {
  return typeof process.getuid === "function" ? process.getuid() : undefined;
}

function isTransientFilesystemError(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && [
      "EACCES",
      "EBUSY",
      "EDQUOT",
      "EIO",
      "EMFILE",
      "ENFILE",
      "ENOSPC",
      "EPERM",
      "EROFS",
      "ESTALE",
      "ETIMEDOUT",
    ].includes(String(error.code));
}

function unavailableFilesystem(message: string, cause: unknown): ArtifactStoreAuthorityError {
  return new ArtifactStoreAuthorityError(
    "ARTIFACT_ROOT_AUTHORITY_UNAVAILABLE",
    message,
    { cause },
  );
}

function assertSecureAuthorityFile(
  stats: Stats,
  allowedLinks: readonly number[] = [1],
): void {
  if (
    !stats.isFile()
    || stats.isSymbolicLink()
    || !allowedLinks.includes(stats.nlink)
    || (stats.mode & 0o7777) !== 0o600
    || (expectedUid() !== undefined && stats.uid !== expectedUid())
  ) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_INVALID",
      "Artifact authority path must be one private owner-controlled ordinary file",
    );
  }
}

function boundedTimeout(value: number | undefined, fallback: number): number {
  const candidate = value ?? fallback;
  if (!Number.isSafeInteger(candidate) || candidate < 1 || candidate > fallback) {
    throw new TypeError(`Authority timeout must be an integer from 1 through ${fallback}`);
  }
  return candidate;
}

function normalizedArtifactRoot(root: string): string {
  if (!root.trim() || root.includes("\0")) {
    throw new TypeError("Artifact authority root must be one non-empty path");
  }
  const resolved = path.resolve(root);
  if (resolved === path.parse(resolved).root) {
    throw new TypeError("Artifact authority root cannot be a filesystem root");
  }
  return resolved;
}

function rootBasenameHash(root: string): string {
  return sha256(Buffer.from(path.basename(root), "utf8"));
}

export function artifactStoreRootLocatorHashV1(rootInput: string): string {
  const root = normalizedArtifactRoot(rootInput);
  return sha256(canonicalJsonBytes({
    schema: ARTIFACT_STORE_ROOT_LOCATOR_SCHEMA_V1,
    authoritySchema: ARTIFACT_STORE_AUTHORITY_SCHEMA_V1,
    configuredRoot: root,
  }));
}

export function artifactStoreBindingClaimPathV1(rootInput: string): string {
  const root = normalizedArtifactRoot(rootInput);
  return path.join(
    path.dirname(root),
    `.setfarm-artifact-root-binding.${rootBasenameHash(root)}.${artifactStoreRootLocatorHashV1(root)}.json`,
  );
}

function markerFor(row: AuthorityRow): ArtifactStoreRootAuthorityV1 {
  return Object.freeze({
    schema: ARTIFACT_STORE_ROOT_AUTHORITY_SCHEMA_V1,
    authorityId: row.authority_id,
    rootLocatorHash: row.root_locator_hash,
  });
}

function claimFor(root: string, row: AuthorityRow): ArtifactStoreRootBindingClaimV1 {
  return Object.freeze({
    schema: ARTIFACT_STORE_ROOT_BINDING_CLAIM_SCHEMA_V1,
    authorityId: row.authority_id,
    rootLocatorHash: row.root_locator_hash,
    rootBasenameHash: rootBasenameHash(root),
  });
}

function kernelLockFor(row: AuthorityRow): ArtifactStoreKernelLockV1 {
  return Object.freeze({
    schema: ARTIFACT_STORE_KERNEL_LOCK_SCHEMA_V1,
    authorityId: row.authority_id,
    rootLocatorHash: row.root_locator_hash,
    lockDomain: ARTIFACT_STORE_CAPACITY_LOCK_DOMAIN_V1,
  });
}

function kernelLockPath(root: string): string {
  return path.join(root, ARTIFACT_STORE_KERNEL_LOCK_FILENAME_V1);
}

async function syncDirectory(directory: string): Promise<void> {
  let handle;
  try {
    handle = await open(
      directory,
      constants.O_RDONLY
        | constants.O_DIRECTORY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    await handle.sync();
  } catch (error) {
    throw unavailableFilesystem(
      `Artifact authority directory ${directory} could not be synchronized`,
      error,
    );
  } finally {
    await handle?.close();
  }
}

const STAGING_ATTEMPT_NAME_V1 =
  /^[a-f0-9]{64}\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STAGING_TEMP_NAME_V1 = /^([a-f0-9]{64})\.tmp$/;

function stagingRootPath(root: string): string {
  return path.join(root, ARTIFACT_STORE_STAGING_DIRECTORY_V1);
}

function stagingInvalid(message: string, cause?: unknown): ArtifactStoreAuthorityError {
  return new ArtifactStoreAuthorityError(
    "ARTIFACT_ROOT_STAGING_INVALID",
    message,
    cause === undefined ? {} : { cause },
  );
}

function stagingUnavailable(message: string, cause: unknown): ArtifactStoreAuthorityError {
  return new ArtifactStoreAuthorityError(
    "ARTIFACT_ROOT_AUTHORITY_UNAVAILABLE",
    message,
    { cause },
  );
}

function stagingFilesystemError(message: string, error: unknown): never {
  if (error instanceof ArtifactStoreAuthorityError) throw error;
  if (isTransientFilesystemError(error)) {
    throw stagingUnavailable(message, error);
  }
  throw stagingInvalid(message, error);
}

function stagingDirectoryIdentity(stats: Stats): StagingDirectoryIdentity {
  return Object.freeze({
    dev: stats.dev,
    ino: stats.ino,
    mode: stats.mode & 0o7777,
    uid: stats.uid,
  });
}

function stagingFileIdentity(stats: Stats): StagingFileIdentity {
  return Object.freeze({
    dev: stats.dev,
    ino: stats.ino,
    mode: stats.mode & 0o7777,
    uid: stats.uid,
    nlink: stats.nlink,
  });
}

function sameStagingDirectoryIdentity(
  left: StagingDirectoryIdentity,
  right: StagingDirectoryIdentity,
): boolean {
  return sameIdentity(left, right)
    && left.mode === right.mode
    && left.uid === right.uid;
}

function sameStagingFileIdentity(
  left: StagingFileIdentity,
  right: StagingFileIdentity,
): boolean {
  return sameIdentity(left, right)
    && left.mode === right.mode
    && left.uid === right.uid
    && left.nlink === right.nlink;
}

function assertSecureStagingDirectory(stats: Stats, label: string): void {
  if (
    !stats.isDirectory()
    || stats.isSymbolicLink()
    || (stats.mode & 0o7777) !== 0o700
    || (expectedUid() !== undefined && stats.uid !== expectedUid())
  ) {
    throw stagingInvalid(`${label} must be one private owner-controlled ordinary directory`);
  }
}

function assertSecureStagingFile(
  stats: Stats,
  label: string,
  allowedLinks: readonly number[] = [1],
): void {
  if (
    !stats.isFile()
    || stats.isSymbolicLink()
    || !allowedLinks.includes(stats.nlink)
    || (stats.mode & 0o7777) !== 0o600
    || (expectedUid() !== undefined && stats.uid !== expectedUid())
  ) {
    throw stagingInvalid(`${label} must have one exact private ordinary-file link topology`);
  }
}

async function boundedDirectoryNames(
  directoryPath: string,
  maximumEntries: number,
  label: string,
): Promise<readonly string[]> {
  let directory;
  try {
    directory = await opendir(directoryPath, { bufferSize: Math.min(32, maximumEntries + 1) });
    const names: string[] = [];
    while (true) {
      const entry = await directory.read();
      if (!entry) break;
      names.push(entry.name);
      if (names.length > maximumEntries) {
        throw stagingInvalid(`${label} exceeds its bounded entry authority`);
      }
    }
    names.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
    return Object.freeze(names);
  } catch (error) {
    return stagingFilesystemError(`${label} could not be enumerated safely`, error);
  } finally {
    if (directory) {
      try {
        await directory.close();
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ERR_DIR_CLOSED")) {
          throw stagingUnavailable(`${label} directory handle could not be closed`, error);
        }
      }
    }
  }
}

async function lstatStagingPath(target: string, label: string): Promise<Stats> {
  try {
    return await lstat(target);
  } catch (error) {
    stagingFilesystemError(`${label} could not be inspected safely`, error);
  }
}

async function openStagingDirectory(
  target: string,
  expected: StagingDirectoryIdentity,
  label: string,
) {
  let handle;
  try {
    handle = await open(
      target,
      constants.O_RDONLY
        | constants.O_DIRECTORY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    const observed = await handle.stat();
    assertSecureStagingDirectory(observed, label);
    if (!sameStagingDirectoryIdentity(stagingDirectoryIdentity(observed), expected)) {
      throw stagingInvalid(`${label} changed physical identity before it was opened`);
    }
    return handle;
  } catch (error) {
    await handle?.close();
    stagingFilesystemError(`${label} could not be opened without following links`, error);
  }
}

async function assertStagingDirectoryCurrent(
  target: string,
  expected: StagingDirectoryIdentity,
  label: string,
): Promise<void> {
  const observed = await lstatStagingPath(target, label);
  assertSecureStagingDirectory(observed, label);
  if (!sameStagingDirectoryIdentity(stagingDirectoryIdentity(observed), expected)) {
    throw stagingInvalid(`${label} changed physical identity during the held lease`);
  }
}

async function ensureStagingRoot(
  root: string,
  assertPhysicalCurrent: () => Promise<void>,
): Promise<Readonly<{
  path: string;
  identity: StagingDirectoryIdentity;
  created: boolean;
}>> {
  const target = stagingRootPath(root);
  await assertPhysicalCurrent();
  let created = false;
  try {
    await mkdir(target, { mode: 0o700 });
    created = true;
  } catch (error) {
    if (!isNodeError(error, "EEXIST")) {
      stagingFilesystemError("Artifact staging root could not be created safely", error);
    }
  }

  let before = await lstatStagingPath(target, "Artifact staging root");
  if (created) {
    let createdHandle;
    try {
      createdHandle = await open(
        target,
        constants.O_RDONLY
          | constants.O_DIRECTORY
          | constants.O_NOFOLLOW
          | constants.O_NONBLOCK,
      );
      await createdHandle.chmod(0o700);
      before = await lstatStagingPath(target, "Artifact staging root");
    } catch (error) {
      stagingFilesystemError("New artifact staging root could not be secured", error);
    } finally {
      await createdHandle?.close();
    }
  }
  assertSecureStagingDirectory(before, "Artifact staging root");
  const expected = stagingDirectoryIdentity(before);
  const handle = await openStagingDirectory(target, expected, "Artifact staging root");
  try {
    await assertPhysicalCurrent();
    await assertStagingDirectoryCurrent(target, expected, "Artifact staging root");
    const held = await handle.stat();
    assertSecureStagingDirectory(held, "Held artifact staging root");
    if (!sameStagingDirectoryIdentity(stagingDirectoryIdentity(held), expected)) {
      throw stagingInvalid("Held artifact staging root changed physical identity");
    }
  } finally {
    await handle.close();
  }
  return Object.freeze({ path: target, identity: expected, created });
}

async function inspectStagingAttempt(
  root: string,
  stagingPath: string,
  name: string,
): Promise<StagingAttemptInventory> {
  if (!STAGING_ATTEMPT_NAME_V1.test(name)) {
    throw stagingInvalid(`Artifact staging contains unexpected attempt entry ${name}`);
  }
  const attemptPath = path.join(stagingPath, name);
  const before = await lstatStagingPath(attemptPath, `Artifact staging attempt ${name}`);
  assertSecureStagingDirectory(before, `Artifact staging attempt ${name}`);
  const expected = stagingDirectoryIdentity(before);
  const handle = await openStagingDirectory(
    attemptPath,
    expected,
    `Artifact staging attempt ${name}`,
  );
  try {
    const names = await boundedDirectoryNames(
      attemptPath,
      ARTIFACT_STORE_STAGING_MAX_FILES_PER_ATTEMPT_V1,
      `Artifact staging attempt ${name}`,
    );
    const files: Array<StagingAttemptInventory["files"][number]> = [];
    for (const fileName of names) {
      const match = STAGING_TEMP_NAME_V1.exec(fileName);
      if (!match) {
        throw stagingInvalid(
          `Artifact staging attempt ${name} contains unexpected temp entry ${fileName}`,
        );
      }
      const filePath = path.join(attemptPath, fileName);
      const stats = await lstatStagingPath(
        filePath,
        `Artifact staging temp ${name}/${fileName}`,
      );
      assertSecureStagingFile(stats, `Artifact staging temp ${name}/${fileName}`, [1, 2]);
      let finalAliasPath: string | undefined;
      if (stats.nlink === 2) {
        finalAliasPath = path.join(root, `${match[1]!}.json`);
        const finalStats = await lstatStagingPath(
          finalAliasPath,
          `Artifact staging final alias ${match[1]}`,
        );
        assertSecureStagingFile(
          finalStats,
          `Artifact staging final alias ${match[1]}`,
          [2],
        );
        if (!sameIdentity(stats, finalStats)) {
          throw stagingInvalid(
            `Artifact staging temp ${name}/${fileName} has a non-canonical second link`,
          );
        }
      }
      files.push(Object.freeze({
        name: fileName,
        path: filePath,
        identity: stagingFileIdentity(stats),
        ...(finalAliasPath ? { finalAliasPath } : {}),
      }));
    }
    const held = await handle.stat();
    assertSecureStagingDirectory(held, `Held artifact staging attempt ${name}`);
    await assertStagingDirectoryCurrent(
      attemptPath,
      expected,
      `Artifact staging attempt ${name}`,
    );
    if (!sameStagingDirectoryIdentity(stagingDirectoryIdentity(held), expected)) {
      throw stagingInvalid(`Held artifact staging attempt ${name} changed identity`);
    }
    return Object.freeze({
      name,
      path: attemptPath,
      identity: expected,
      files: Object.freeze(files),
    });
  } finally {
    await handle.close();
  }
}

async function removeStagingAttempt(
  attempt: StagingAttemptInventory,
  assertPhysicalCurrent: () => Promise<void>,
): Promise<void> {
  await assertPhysicalCurrent();
  await assertStagingDirectoryCurrent(
    attempt.path,
    attempt.identity,
    `Artifact staging attempt ${attempt.name}`,
  );
  const handle = await openStagingDirectory(
    attempt.path,
    attempt.identity,
    `Artifact staging attempt ${attempt.name}`,
  );
  try {
    for (const file of attempt.files) {
      await assertPhysicalCurrent();
      const current = await lstatStagingPath(
        file.path,
        `Artifact staging temp ${attempt.name}/${file.name}`,
      );
      assertSecureStagingFile(
        current,
        `Artifact staging temp ${attempt.name}/${file.name}`,
        [file.identity.nlink],
      );
      if (!sameStagingFileIdentity(stagingFileIdentity(current), file.identity)) {
        throw stagingInvalid(
          `Artifact staging temp ${attempt.name}/${file.name} changed before cleanup`,
        );
      }
      if (file.finalAliasPath) {
        const finalAlias = await lstatStagingPath(
          file.finalAliasPath,
          `Artifact staging final alias for ${attempt.name}/${file.name}`,
        );
        assertSecureStagingFile(
          finalAlias,
          `Artifact staging final alias for ${attempt.name}/${file.name}`,
          [2],
        );
        if (!sameIdentity(current, finalAlias)) {
          throw stagingInvalid(
            `Artifact staging temp ${attempt.name}/${file.name} lost its canonical final alias`,
          );
        }
      }
      try {
        await unlink(file.path);
      } catch (error) {
        stagingFilesystemError(
          `Artifact staging temp ${attempt.name}/${file.name} could not be removed safely`,
          error,
        );
      }
      if (file.finalAliasPath) {
        const finalAlias = await lstatStagingPath(
          file.finalAliasPath,
          `Artifact staging finalized alias for ${attempt.name}/${file.name}`,
        );
        assertSecureStagingFile(
          finalAlias,
          `Artifact staging finalized alias for ${attempt.name}/${file.name}`,
          [1],
        );
        if (!sameIdentity(finalAlias, file.identity)) {
          throw stagingInvalid(
            `Artifact staging final alias for ${attempt.name}/${file.name} changed during cleanup`,
          );
        }
      }
    }
    await syncDirectory(attempt.path);
    await assertPhysicalCurrent();
    await assertStagingDirectoryCurrent(
      attempt.path,
      attempt.identity,
      `Artifact staging attempt ${attempt.name}`,
    );
    const held = await handle.stat();
    assertSecureStagingDirectory(held, `Held artifact staging attempt ${attempt.name}`);
    if (!sameStagingDirectoryIdentity(stagingDirectoryIdentity(held), attempt.identity)) {
      throw stagingInvalid(`Held artifact staging attempt ${attempt.name} changed during cleanup`);
    }
  } finally {
    await handle.close();
  }
  await assertPhysicalCurrent();
  try {
    await rmdir(attempt.path);
  } catch (error) {
    stagingFilesystemError(
      `Artifact staging attempt ${attempt.name} could not be removed safely`,
      error,
    );
  }
  await assertPhysicalCurrent();
}

async function ensureAndCleanOwnedStaging(
  root: string,
  assertPhysicalCurrent: () => Promise<void>,
  hooks: AuthorityTestHooks | undefined,
): Promise<StagingDirectoryIdentity> {
  const staging = await ensureStagingRoot(root, assertPhysicalCurrent);
  const stagingHandle = await openStagingDirectory(
    staging.path,
    staging.identity,
    "Artifact staging root",
  );
  try {
    const attemptNames = await boundedDirectoryNames(
      staging.path,
      ARTIFACT_STORE_STAGING_MAX_ATTEMPTS_V1,
      "Artifact staging root",
    );
    let entryCount = attemptNames.length;
    const attempts: StagingAttemptInventory[] = [];
    for (const name of attemptNames) {
      const attempt = await inspectStagingAttempt(root, staging.path, name);
      entryCount += attempt.files.length;
      if (entryCount > ARTIFACT_STORE_STAGING_MAX_ENTRIES_V1) {
        throw stagingInvalid("Artifact staging tree exceeds its bounded total entry authority");
      }
      attempts.push(attempt);
    }
    await hooks?.afterStagingInventory?.({
      stagingRoot: staging.path,
      attemptCount: attempts.length,
      entryCount,
    });
    await assertPhysicalCurrent();
    await assertStagingDirectoryCurrent(
      staging.path,
      staging.identity,
      "Artifact staging root",
    );
    const heldBeforeCleanup = await stagingHandle.stat();
    assertSecureStagingDirectory(heldBeforeCleanup, "Held artifact staging root");
    if (
      !sameStagingDirectoryIdentity(
        stagingDirectoryIdentity(heldBeforeCleanup),
        staging.identity,
      )
    ) {
      throw stagingInvalid("Held artifact staging root changed before cleanup");
    }

    for (const attempt of attempts) {
      await removeStagingAttempt(attempt, assertPhysicalCurrent);
      await assertStagingDirectoryCurrent(
        staging.path,
        staging.identity,
        "Artifact staging root",
      );
    }
    try {
      await hooks?.beforeStagingSync?.({ stagingRoot: staging.path });
    } catch (error) {
      throw stagingUnavailable("Artifact staging sync hook reported a filesystem failure", error);
    }
    await boundedDirectoryNames(
      staging.path,
      0,
      "Clean artifact staging root",
    );
    await syncDirectory(staging.path);
    await syncDirectory(root);
    await assertPhysicalCurrent();
    await assertStagingDirectoryCurrent(
      staging.path,
      staging.identity,
      "Artifact staging root",
    );
    await boundedDirectoryNames(
      staging.path,
      0,
      "Synchronized artifact staging root",
    );
    const heldAfterCleanup = await stagingHandle.stat();
    assertSecureStagingDirectory(heldAfterCleanup, "Held artifact staging root");
    if (
      !sameStagingDirectoryIdentity(
        stagingDirectoryIdentity(heldAfterCleanup),
        staging.identity,
      )
    ) {
      throw stagingInvalid("Held artifact staging root changed during cleanup");
    }
    return staging.identity;
  } finally {
    await stagingHandle.close();
  }
}

async function verifyOwnedStagingRoot(
  root: string,
  expected: StagingDirectoryIdentity,
): Promise<void> {
  await assertStagingDirectoryCurrent(
    stagingRootPath(root),
    expected,
    "Artifact staging root",
  );
}

async function readStableRegularFile(
  target: string,
  allowedLinks: readonly number[] = [1],
): Promise<Buffer> {
  let handle;
  let pathWasObserved = false;
  try {
    const pathBefore = await lstat(target);
    pathWasObserved = true;
    if (
      !Number.isSafeInteger(pathBefore.size)
      || pathBefore.size < 1
      || pathBefore.size > MAX_AUTHORITY_FILE_BYTES
    ) {
      throw new ArtifactStoreAuthorityError(
        "ARTIFACT_ROOT_AUTHORITY_INVALID",
        "Artifact root authority file is not one bounded ordinary file",
      );
    }
    assertSecureAuthorityFile(pathBefore, allowedLinks);
    handle = await open(
      target,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = await handle.stat();
    assertSecureAuthorityFile(before, allowedLinks);
    if (!sameIdentity(before, pathBefore) || before.size !== pathBefore.size) {
      throw new ArtifactStoreAuthorityError(
        "ARTIFACT_ROOT_AUTHORITY_INVALID",
        "Artifact root authority file identity changed before read",
      );
    }
    const bytes = Buffer.allocUnsafe(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const read = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (read.bytesRead === 0) break;
      offset += read.bytesRead;
    }
    const probe = Buffer.allocUnsafe(1);
    const beyond = await handle.read(probe, 0, 1, before.size);
    const after = await handle.stat();
    const pathAfter = await lstat(target);
    if (
      offset !== before.size
      || beyond.bytesRead !== 0
      || !after.isFile()
      || !pathAfter.isFile()
      || pathAfter.isSymbolicLink()
      || !sameIdentity(before, after)
      || !sameIdentity(after, pathAfter)
      || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs
      || before.ctimeMs !== after.ctimeMs
      || before.nlink !== after.nlink
      || before.nlink !== pathAfter.nlink
      || (before.mode & 0o7777) !== (after.mode & 0o7777)
      || (before.mode & 0o7777) !== (pathAfter.mode & 0o7777)
      || before.uid !== after.uid
      || before.uid !== pathAfter.uid
    ) {
      throw new ArtifactStoreAuthorityError(
        "ARTIFACT_ROOT_AUTHORITY_INVALID",
        "Artifact root authority file changed during bounded read",
      );
    }
    return bytes;
  } catch (error) {
    if (error instanceof ArtifactStoreAuthorityError) {
      throw error;
    }
    if (isNodeError(error, "ENOENT")) {
      if (!pathWasObserved) throw error;
      throw new ArtifactStoreAuthorityError(
        "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
        `Artifact authority file ${target} disappeared during stable read`,
        { cause: error },
      );
    }
    if (isTransientFilesystemError(error)) {
      throw unavailableFilesystem(
        `Artifact authority file ${target} is temporarily unavailable`,
        error,
      );
    }
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_INVALID",
      "Artifact root authority file could not be read safely",
      { cause: error },
    );
  } finally {
    await handle?.close();
  }
}

async function readCanonicalAuthorityFile<T>(
  target: string,
  schema: z.ZodType<T>,
  allowedLinks: readonly number[] = [1],
): Promise<T> {
  const bytes = await readStableRegularFile(target, allowedLinks);
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (cause) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_INVALID",
      "Artifact root authority file is not valid JSON",
      { cause },
    );
  }
  const result = schema.safeParse(parsed);
  if (!result.success || !bytes.equals(canonicalJsonBytes(result.data))) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_INVALID",
      "Artifact root authority file is not exact canonical authority bytes",
      { cause: result.success ? undefined : result.error },
    );
  }
  return result.data;
}

export function artifactStoreAuthorityStagePathV1(
  targetInput: string,
  value: unknown,
): string {
  const target = path.resolve(targetInput);
  const bytes = canonicalJsonBytes(value);
  return path.join(
    path.dirname(target),
    `.setfarm-artifact-authority-stage.${sha256(path.basename(target))}.${sha256(bytes)}.tmp`,
  );
}

async function optionalLstat(target: string): Promise<Stats | undefined> {
  try {
    return await lstat(target);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return undefined;
    if (isTransientFilesystemError(error)) {
      throw unavailableFilesystem(
        `Artifact authority path ${target} is temporarily unavailable`,
        error,
      );
    }
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_INVALID",
      `Artifact authority path ${target} could not be inspected safely`,
      { cause: error },
    );
  }
}

async function unlinkStableAuthorityPath(target: string, expected: Stats): Promise<void> {
  const current = await lstat(target);
  if (!sameIdentity(expected, current) || current.nlink !== expected.nlink) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      `Artifact authority path ${target} changed before cleanup`,
    );
  }
  try {
    await unlink(target);
  } catch (error) {
    if (isTransientFilesystemError(error)) {
      throw unavailableFilesystem(
        `Artifact authority path ${target} could not be cleaned up`,
        error,
      );
    }
    throw error;
  }
}

async function reconcileCanonicalPublication(
  target: string,
  stage: string,
  value: unknown,
): Promise<Readonly<{ targetExists: boolean; stageReady: boolean; replayed: boolean }>> {
  const bytes = canonicalJsonBytes(value);
  const [targetStats, stageStats] = await Promise.all([
    optionalLstat(target),
    optionalLstat(stage),
  ]);

  if (targetStats && stageStats) {
    assertSecureAuthorityFile(targetStats, [2]);
    assertSecureAuthorityFile(stageStats, [2]);
    if (!sameIdentity(targetStats, stageStats) || targetStats.nlink !== 2) {
      throw new ArtifactStoreAuthorityError(
        "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
        "Artifact authority target and deterministic stage are different physical files",
      );
    }
    const observed = await readStableRegularFile(target, [2]);
    if (!observed.equals(bytes)) {
      throw new ArtifactStoreAuthorityError(
        "ARTIFACT_ROOT_AUTHORITY_INVALID",
        "Artifact authority crash-replay target does not contain exact canonical bytes",
      );
    }
    await syncDirectory(path.dirname(target));
    await unlinkStableAuthorityPath(stage, stageStats);
    await syncDirectory(path.dirname(stage));
    const finalBytes = await readStableRegularFile(target, [1]);
    if (!finalBytes.equals(bytes)) {
      throw new ArtifactStoreAuthorityError(
        "ARTIFACT_ROOT_AUTHORITY_INVALID",
        "Artifact authority target changed while its crash stage was removed",
      );
    }
    await syncDirectory(path.dirname(target));
    return { targetExists: true, stageReady: false, replayed: true };
  }

  if (targetStats) {
    assertSecureAuthorityFile(targetStats, [1]);
    // A crash may leave a visible hard link before the containing directory's
    // durability point. Replay synchronizes before trusting the target.
    await syncDirectory(path.dirname(target));
    return { targetExists: true, stageReady: false, replayed: false };
  }

  if (!stageStats) {
    return { targetExists: false, stageReady: false, replayed: false };
  }
  if (!stageStats.isFile() || stageStats.isSymbolicLink()) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_INVALID",
      "Artifact authority deterministic stage is not one ordinary file",
    );
  }
  if (stageStats.nlink !== 1) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact authority deterministic stage has an external hard-link alias",
    );
  }
  assertSecureAuthorityFile(stageStats, [1]);
  let exact = false;
  if (stageStats.size >= 1 && stageStats.size <= MAX_AUTHORITY_FILE_BYTES) {
    try {
      exact = (await readStableRegularFile(stage, [1])).equals(bytes);
    } catch (error) {
      if (!(error instanceof ArtifactStoreAuthorityError)) throw error;
      if (error.code === "ARTIFACT_ROOT_AUTHORITY_UNAVAILABLE") throw error;
    }
  }
  if (exact) {
    return { targetExists: false, stageReady: true, replayed: true };
  }
  // A deterministic, private, unaliased partial stage is an interrupted write,
  // not authority. It is safe to remove only while the caller holds the
  // binding/ready serialization lease.
  await unlinkStableAuthorityPath(stage, stageStats);
  await syncDirectory(path.dirname(stage));
  return { targetExists: false, stageReady: false, replayed: true };
}

async function writeCanonicalNoReplace(
  target: string,
  value: unknown,
  containingDirectory: string,
): Promise<boolean> {
  const bytes = canonicalJsonBytes(value);
  const stagingDirectory = path.resolve(containingDirectory);
  if (path.dirname(path.resolve(target)) !== stagingDirectory) {
    throw new TypeError("Artifact authority stage must share its target directory");
  }
  const stage = artifactStoreAuthorityStagePathV1(target, value);
  let handle;
  const reconciled = await reconcileCanonicalPublication(target, stage, value);
  if (reconciled.targetExists) return false;
  let stageReady = reconciled.stageReady;
  if (!stageReady) {
    try {
      handle = await open(
        stage,
        constants.O_WRONLY
          | constants.O_CREAT
          | constants.O_EXCL
          | constants.O_NOFOLLOW,
        0o600,
      );
      await handle.chmod(0o600);
      const created = await handle.stat();
      assertSecureAuthorityFile(created, [1]);
      await handle.writeFile(bytes);
      await handle.sync();
      stageReady = true;
    } catch (error) {
      if (isNodeError(error, "EEXIST")) {
        await handle?.close();
        handle = undefined;
        const raced = await reconcileCanonicalPublication(target, stage, value);
        if (raced.targetExists) return false;
        if (raced.stageReady) {
          stageReady = true;
        } else {
          throw new ArtifactStoreAuthorityError(
            "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
            "Artifact authority deterministic stage raced without exact replay evidence",
            { cause: error },
          );
        }
      } else if (isTransientFilesystemError(error)) {
        throw unavailableFilesystem(
          `Artifact authority stage ${stage} could not be published`,
          error,
        );
      } else {
        throw error;
      }
    } finally {
      await handle?.close();
    }
    await syncDirectory(stagingDirectory);
  }

  if (!stageReady) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact authority deterministic stage was not ready for publication",
    );
  }

  const stageBefore = await lstat(stage);
  assertSecureAuthorityFile(stageBefore, [1]);
  if (!(await readStableRegularFile(stage, [1])).equals(bytes)) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_INVALID",
      "Artifact authority deterministic stage changed before no-replace link",
    );
  }
  try {
    await link(stage, target);
  } catch (error) {
    if (isNodeError(error, "EEXIST")) {
      const raced = await reconcileCanonicalPublication(target, stage, value);
      if (raced.targetExists) return false;
    }
    if (isTransientFilesystemError(error)) {
      throw unavailableFilesystem(
        `Artifact authority target ${target} could not be linked durably`,
        error,
      );
    }
    throw error;
  }
  const targetAfterLink = await lstat(target);
  const stageAfterLink = await lstat(stage);
  assertSecureAuthorityFile(targetAfterLink, [2]);
  assertSecureAuthorityFile(stageAfterLink, [2]);
  if (!sameIdentity(targetAfterLink, stageAfterLink)) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact authority target did not retain the staged physical identity",
    );
  }
  await syncDirectory(path.dirname(target));
  await unlinkStableAuthorityPath(stage, stageAfterLink);
  await syncDirectory(stagingDirectory);
  const finalBytes = await readStableRegularFile(target, [1]);
  if (!finalBytes.equals(bytes)) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_INVALID",
      "Artifact authority target changed during durable no-replace publication",
    );
  }
  return true;
}

function assertAuthorityRow(value: AuthorityRow | undefined): AuthorityRow {
  if (
    !value
    || value.authority_key !== AUTHORITY_KEY
    || value.authority_schema !== ARTIFACT_STORE_AUTHORITY_SCHEMA_V1
    || !LowerUuidSchema.safeParse(value.authority_id).success
    || !Sha256Schema.safeParse(value.root_locator_hash).success
    || !["binding", "ready", "quarantined"].includes(value.state)
    || (value.state === "quarantined") !== Boolean(value.diagnostic)
  ) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_CAPACITY_AUTHORITY_DATABASE_INVALID",
      "Artifact store authority database singleton is missing or malformed",
    );
  }
  return value;
}

async function readAuthorityRow(sql: TransactionSql): Promise<AuthorityRow | undefined> {
  const rows = await sql.unsafe<AuthorityRow[]>(
    `SELECT authority_key, authority_schema,
            authority_id::text AS authority_id,
            root_locator_hash, state, diagnostic
       FROM public.artifact_store_authorities
      WHERE authority_key = 'semantic-artifacts'
      LIMIT 2`,
  );
  if (rows.length > 1) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_CAPACITY_AUTHORITY_DATABASE_INVALID",
      "Artifact store authority database singleton contains multiple rows",
    );
  }
  return rows[0];
}

async function assertCapacityState(
  sql: TransactionSql,
  allowedStates: ReadonlySet<string>,
): Promise<void> {
  const rows = await sql.unsafe<Array<{ capacity_key: string; state: string }>>(
    `SELECT capacity_key, state
       FROM public.artifact_capacity
      WHERE capacity_key = 'semantic-artifacts'
      LIMIT 2`,
  );
  if (
    rows.length !== 1
    || rows[0]?.capacity_key !== AUTHORITY_KEY
    || !allowedStates.has(rows[0]?.state ?? "")
  ) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_CAPACITY_AUTHORITY_DATABASE_INVALID",
      "Artifact capacity singleton is not in a state allowed by this root authority purpose",
    );
  }
}

async function configureAndAcquireLock(
  sql: TransactionSql,
  acquisitionDeadlineMs: number,
  workTimeoutMs: number,
): Promise<void> {
  const remainingMs = acquisitionDeadlineMs - Date.now();
  if (remainingMs < 1) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_CAPACITY_AUTHORITY_LOCK_TIMEOUT",
      "Artifact capacity hybrid lease exhausted its cumulative acquisition deadline",
    );
  }
  const databaseLockTimeoutMs = Math.max(1, Math.ceil(remainingMs));
  await sql.unsafe("SELECT set_config('search_path', 'public', true)");
  await sql.unsafe("SELECT set_config('lock_timeout', $1, true)", [
    `${databaseLockTimeoutMs}ms`,
  ]);
  await sql.unsafe("SELECT set_config('statement_timeout', $1, true)", [
    `${databaseLockTimeoutMs + 1_000}ms`,
  ]);
  await sql.unsafe(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    [ARTIFACT_STORE_CAPACITY_LOCK_DOMAIN_V1],
  );
  await sql.unsafe("SELECT set_config('statement_timeout', $1, true)", [
    `${workTimeoutMs}ms`,
  ]);
}

function conflictDiagnostic(code: ArtifactStoreAuthorityErrorCode): string {
  const value = `${code}: physical artifact-root authority did not match migration 24`;
  return Buffer.byteLength(value, "utf8") <= MAX_DIAGNOSTIC_BYTES
    ? value
    : code;
}

async function quarantineRow(
  sql: TransactionSql,
  row: AuthorityRow,
  code: ArtifactStoreAuthorityErrorCode,
): Promise<AuthorityRow> {
  if (row.state === "quarantined") return row;
  const rows = await sql.unsafe<AuthorityRow[]>(
    `UPDATE public.artifact_store_authorities
        SET state = 'quarantined', diagnostic = $2
      WHERE authority_key = $1
        AND state IN ('binding', 'ready')
      RETURNING authority_key, authority_schema,
                authority_id::text AS authority_id,
                root_locator_hash, state, diagnostic`,
    [AUTHORITY_KEY, conflictDiagnostic(code)],
  );
  return assertAuthorityRow(rows[0]);
}

function markerPath(root: string): string {
  return path.join(root, ARTIFACT_STORE_ROOT_AUTHORITY_FILENAME_V1);
}

async function rootIdentity(root: string): Promise<FileIdentity> {
  let observed: Stats;
  try {
    observed = await lstat(root);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      throw new ArtifactStoreAuthorityError(
        "ARTIFACT_ROOT_AUTHORITY_INVALID",
        "Artifact root authority directory does not exist",
        { cause: error },
      );
    }
    if (isTransientFilesystemError(error)) {
      throw unavailableFilesystem(
        "Artifact root authority directory is temporarily unavailable",
        error,
      );
    }
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_INVALID",
      "Artifact root authority directory is unavailable",
      { cause: error },
    );
  }
  if (!observed.isDirectory() || observed.isSymbolicLink()) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_INVALID",
      "Artifact root authority must be one ordinary directory",
    );
  }
  return identity(observed);
}

async function verifyExactRootAuthority(
  root: string,
  row: AuthorityRow,
  expected?: Readonly<{
    root: FileIdentity;
    marker?: MarkerFileIdentity;
    kernelLock?: MarkerFileIdentity;
  }>,
): Promise<HeldRootAuthority> {
  const rootBefore = await rootIdentity(root);
  if (expected && !sameIdentity(rootBefore, expected.root)) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact root physical identity changed during the held authority lease",
    );
  }
  let markerBeforeStats: Stats;
  let kernelBeforeStats: Stats;
  try {
    markerBeforeStats = await lstat(markerPath(root));
    kernelBeforeStats = await lstat(kernelLockPath(root));
  } catch (cause) {
    if (isTransientFilesystemError(cause)) {
      throw unavailableFilesystem(
        "Artifact root authority files are temporarily unavailable",
        cause,
      );
    }
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact root marker or kernel descriptor is missing from its ready authority root",
      { cause },
    );
  }
  assertSecureAuthorityFile(markerBeforeStats, [1]);
  assertSecureAuthorityFile(kernelBeforeStats, [1]);
  const markerBefore = markerIdentity(markerBeforeStats);
  const kernelBefore = markerIdentity(kernelBeforeStats);
  if (expected?.marker && !sameMarkerIdentity(markerBefore, expected.marker)) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact root marker identity changed during the held authority lease",
    );
  }
  if (expected?.kernelLock && !sameMarkerIdentity(kernelBefore, expected.kernelLock)) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact root kernel descriptor identity changed during the held authority lease",
    );
  }
  const marker = await readCanonicalAuthorityFile(
    markerPath(root),
    ArtifactStoreRootAuthorityV1Schema,
  );
  if (
    marker.authorityId !== row.authority_id
    || marker.rootLocatorHash !== row.root_locator_hash
  ) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact root marker belongs to another database or locator",
    );
  }
  const descriptor = await readCanonicalAuthorityFile(
    kernelLockPath(root),
    ArtifactStoreKernelLockV1Schema,
  );
  if (
    descriptor.authorityId !== row.authority_id
    || descriptor.rootLocatorHash !== row.root_locator_hash
    || descriptor.lockDomain !== ARTIFACT_STORE_CAPACITY_LOCK_DOMAIN_V1
  ) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact root kernel descriptor belongs to another database or locator",
    );
  }
  const markerAfterStats = await lstat(markerPath(root));
  const kernelAfterStats = await lstat(kernelLockPath(root));
  assertSecureAuthorityFile(markerAfterStats, [1]);
  assertSecureAuthorityFile(kernelAfterStats, [1]);
  const markerAfter = markerIdentity(markerAfterStats);
  const kernelAfter = markerIdentity(kernelAfterStats);
  if (!sameMarkerIdentity(markerBefore, markerAfter)) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact root marker changed while its canonical bytes were verified",
    );
  }
  if (!sameMarkerIdentity(kernelBefore, kernelAfter)) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact root kernel descriptor changed while its canonical bytes were verified",
    );
  }
  const rootAfter = await rootIdentity(root);
  if (!sameIdentity(rootBefore, rootAfter)) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact root physical identity changed while its marker was read",
    );
  }
  return Object.freeze({
    root: rootAfter,
    marker: markerAfter,
    kernelLock: kernelAfter,
  });
}

async function exactClaimExists(root: string, row: AuthorityRow): Promise<boolean> {
  const claimPath = artifactStoreBindingClaimPathV1(root);
  let claim: ArtifactStoreRootBindingClaimV1;
  try {
    claim = await readCanonicalAuthorityFile(
      claimPath,
      ArtifactStoreRootBindingClaimV1Schema,
    );
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return false;
    throw error;
  }
  const expected = claimFor(root, row);
  if (
    claim.authorityId !== expected.authorityId
    || claim.rootLocatorHash !== expected.rootLocatorHash
    || claim.rootBasenameHash !== expected.rootBasenameHash
  ) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact root binding claim belongs to another authority",
    );
  }
  return true;
}

async function ensureParentIdentity(root: string): Promise<FileIdentity> {
  const parent = path.dirname(root);
  let observed: Stats;
  try {
    observed = await lstat(parent);
  } catch (error) {
    if (isTransientFilesystemError(error)) {
      throw unavailableFilesystem(
        "Artifact root parent directory is temporarily unavailable",
        error,
      );
    }
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_INVALID",
      "Artifact root parent directory is unavailable",
      { cause: error },
    );
  }
  if (!observed.isDirectory() || observed.isSymbolicLink()) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_INVALID",
      "Artifact root parent must be one ordinary directory",
    );
  }
  return identity(observed);
}

async function assertParentIdentity(root: string, expected: FileIdentity): Promise<void> {
  const current = await ensureParentIdentity(root);
  if (!sameIdentity(current, expected)) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact root parent identity changed during binding",
    );
  }
}

type KernelLease = Readonly<{
  assertCurrent(): Promise<void>;
  release(): Promise<void>;
}>;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function executableIdentity(target: string): Promise<FileIdentity> {
  let observed: Stats;
  try {
    observed = await lstat(target);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      throw new ArtifactStoreAuthorityError(
        "ARTIFACT_CAPACITY_AUTHORITY_PLATFORM_UNSUPPORTED",
        `Required hybrid-lease executable ${target} is unavailable`,
        { cause: error },
      );
    }
    throw unavailableFilesystem(
      `Required hybrid-lease executable ${target} could not be inspected`,
      error,
    );
  }
  if (!observed.isFile() || observed.isSymbolicLink()) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_CAPACITY_AUTHORITY_PLATFORM_UNSUPPORTED",
      `Required hybrid-lease executable ${target} is not one exact ordinary file`,
    );
  }
  return identity(observed);
}

async function assertExecutableIdentity(
  target: string,
  expected: FileIdentity,
): Promise<void> {
  const current = await executableIdentity(target);
  if (!sameIdentity(current, expected)) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_CAPACITY_AUTHORITY_LOST",
      `Hybrid-lease executable ${target} changed physical identity`,
    );
  }
}

async function assertPathIdentity(
  target: string,
  expected: FileIdentity,
  kind: "directory" | "authority-file",
): Promise<void> {
  let observed: Stats;
  try {
    observed = await lstat(target);
  } catch (error) {
    if (isTransientFilesystemError(error)) {
      throw unavailableFilesystem(
        `Held kernel-lock path ${target} is temporarily unavailable`,
        error,
      );
    }
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      `Held kernel-lock path ${target} disappeared`,
      { cause: error },
    );
  }
  if (
    !sameIdentity(observed, expected)
    || (kind === "directory" && (!observed.isDirectory() || observed.isSymbolicLink()))
  ) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      `Held kernel-lock path ${target} changed physical identity`,
    );
  }
  if (kind === "authority-file") assertSecureAuthorityFile(observed, [1]);
}

async function waitForChildExit(
  child: ReturnType<typeof spawn>,
  timeoutMs = 1_000,
): Promise<void> {
  const hasExited = () =>
    child.pid === undefined
    || child.exitCode !== null
    || child.signalCode !== null;
  if (hasExited()) return;
  const waitOnce = (): Promise<boolean> => new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (exited: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("exit", onExit);
      child.off("close", onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    timer.unref?.();
    child.once("exit", onExit);
    child.once("close", onExit);
    if (hasExited()) finish(true);
  });
  const exited = await waitOnce();
  if (exited) return;
  child.kill("SIGKILL");
  const killed = await waitOnce();
  if (!killed && child.exitCode === null && child.signalCode === null) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_CAPACITY_AUTHORITY_LOST",
      "Filesystem kernel-lock helper did not terminate after SIGKILL",
    );
  }
}

async function acquireKernelLease(
  input: Readonly<{
    target: string;
    expected: FileIdentity;
    kind: "directory" | "authority-file";
    acquisitionDeadlineMs: number;
    hooks?: AuthorityTestHooks;
  }>,
): Promise<KernelLease> {
  if (process.platform !== "darwin") {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_CAPACITY_AUTHORITY_PLATFORM_UNSUPPORTED",
      "Artifact capacity hybrid authority currently requires Darwin /usr/bin/lockf",
    );
  }
  const lockfIdentity = await executableIdentity(LOCKF_PATH);
  const nodeIdentity = await executableIdentity(process.execPath);

  while (Date.now() < input.acquisitionDeadlineMs) {
    await assertPathIdentity(input.target, input.expected, input.kind);
    let handle;
    let child: ReturnType<typeof spawn> | undefined;
    try {
      handle = await open(
        input.target,
        input.kind === "directory"
          ? constants.O_RDONLY
            | constants.O_DIRECTORY
            | constants.O_NOFOLLOW
            | constants.O_NONBLOCK
          : constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      const opened = await handle.stat();
      if (!sameIdentity(opened, input.expected)) {
        throw new ArtifactStoreAuthorityError(
          "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
          `Kernel-lock target ${input.target} changed while it was opened`,
        );
      }
      if (input.kind === "authority-file") assertSecureAuthorityFile(opened, [1]);

      const token = `setfarm-kernel-ready:${randomUUID()}`;
      const activeChild = spawn(
        LOCKF_PATH,
        [
          "-s",
          "-t",
          "0",
          "/dev/fd/3",
          process.execPath,
          "-e",
          LOCK_HELPER_SOURCE,
          token,
        ],
        {
          stdio: ["pipe", "pipe", "pipe", handle.fd],
          windowsHide: true,
        },
      );
      child = activeChild;
      activeChild.stderr!.resume();
      let stdinFailure: Error | undefined;
      activeChild.stdin!.on("error", (error) => {
        // EPIPE is expected when lockf/helper exits just before parent cleanup.
        // Capture it as lifecycle evidence; never let an owned stream emit an
        // unhandled process-level error.
        stdinFailure = error;
      });
      let output = "";
      let protocolFailure: Error | undefined;
      const readiness = await new Promise<
        | Readonly<{ kind: "ready" }>
        | Readonly<{ kind: "exit"; code: number | null; signal: NodeJS.Signals | null }>
      >((resolve, reject) => {
        let settled = false;
        const finish = (
          result:
            | Readonly<{ kind: "ready" }>
            | Readonly<{ kind: "exit"; code: number | null; signal: NodeJS.Signals | null }>,
        ) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          activeChild.stdout!.off("data", onData);
          resolve(result);
        };
        const fail = (error: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          activeChild.stdout!.off("data", onData);
          reject(error);
        };
        const remaining = Math.max(1, input.acquisitionDeadlineMs - Date.now());
        const timer = setTimeout(() => {
          fail(new ArtifactStoreAuthorityError(
            "ARTIFACT_CAPACITY_AUTHORITY_LOCK_TIMEOUT",
            "Filesystem kernel lease did not report readiness before the cumulative deadline",
          ));
        }, remaining);
        timer.unref?.();
        activeChild.once("error", (error) => {
          fail(unavailableFilesystem("Filesystem kernel-lock helper could not start", error));
        });
        activeChild.once("exit", (code, signal) => {
          finish({ kind: "exit", code, signal });
        });
        const onData = (chunk: Buffer) => {
          output += chunk.toString("utf8");
          if (output === `${token}\n`) {
            finish({ kind: "ready" });
          } else if (
            output.length > Buffer.byteLength(`${token}\n`, "utf8")
            || !`${token}\n`.startsWith(output)
          ) {
            protocolFailure = new Error("Kernel-lock helper emitted a non-canonical readiness token");
            fail(protocolFailure);
          }
        };
        activeChild.stdout!.on("data", onData);
      }).catch(async (error) => {
        activeChild.stdin!.destroy();
        activeChild.kill("SIGKILL");
        await waitForChildExit(activeChild);
        throw error;
      });

      if (readiness.kind === "exit") {
        await handle.close();
        handle = undefined;
        if (readiness.code === LOCKF_TEMPFAIL_EXIT && readiness.signal === null) {
          await delay(Math.min(
            KERNEL_LOCK_RETRY_MS,
            Math.max(0, input.acquisitionDeadlineMs - Date.now()),
          ));
          continue;
        }
        throw new ArtifactStoreAuthorityError(
          "ARTIFACT_CAPACITY_AUTHORITY_LOST",
          `Filesystem kernel-lock helper exited before readiness (${readiness.code ?? readiness.signal})`,
          { cause: protocolFailure },
        );
      }

      // The child inherited this exact open-file description. Closing the
      // parent's duplicate ensures helper/process death releases the lock.
      await input.hooks?.beforeKernelParentHandleClose?.({
        pid: activeChild.pid!,
        target: input.target,
        token,
      });
      await handle.close();
      handle = undefined;
      try {
        await assertPathIdentity(input.target, input.expected, input.kind);
        await input.hooks?.afterKernelLockAcquired?.({
          pid: activeChild.pid!,
          target: input.target,
          token,
        });
      } catch (error) {
        activeChild.stdin!.end();
        await waitForChildExit(activeChild);
        throw error;
      }
      let released = false;
      const assertCurrent = async (): Promise<void> => {
        if (
          released
          || activeChild.exitCode !== null
          || activeChild.signalCode !== null
          || activeChild.stdin!.destroyed
          || stdinFailure !== undefined
        ) {
          throw new ArtifactStoreAuthorityError(
            "ARTIFACT_CAPACITY_AUTHORITY_LOST",
            "Filesystem kernel-lock helper is no longer holding authority",
          );
        }
        await assertPathIdentity(input.target, input.expected, input.kind);
        await assertExecutableIdentity(LOCKF_PATH, lockfIdentity).catch((error) => {
          throw new ArtifactStoreAuthorityError(
            "ARTIFACT_CAPACITY_AUTHORITY_LOST",
            "Exact /usr/bin/lockf identity changed during the held hybrid lease",
            { cause: error },
          );
        });
        const currentNode = await executableIdentity(process.execPath);
        if (!sameIdentity(currentNode, nodeIdentity)) {
          throw new ArtifactStoreAuthorityError(
            "ARTIFACT_CAPACITY_AUTHORITY_LOST",
            "Exact Node helper executable identity changed during the held hybrid lease",
          );
        }
      };
      const release = async (): Promise<void> => {
        if (released) return;
        released = true;
        activeChild.stdin!.end();
        await waitForChildExit(activeChild);
        if (activeChild.exitCode !== 0 || activeChild.signalCode !== null) {
          throw new ArtifactStoreAuthorityError(
            "ARTIFACT_CAPACITY_AUTHORITY_LOST",
            `Filesystem kernel-lock helper exited abnormally during release (${activeChild.exitCode ?? activeChild.signalCode})`,
            { cause: stdinFailure },
          );
        }
        await input.hooks?.afterKernelLockReleased?.({
          pid: activeChild.pid!,
          target: input.target,
          token,
        });
      };
      return Object.freeze({ assertCurrent, release });
    } catch (error) {
      let cleanupFailure: unknown;
      if (
        child !== undefined
        && child.exitCode === null
        && child.signalCode === null
      ) {
        try {
          child.stdin?.destroy();
          child.kill("SIGKILL");
          await waitForChildExit(child);
        } catch (cleanupError) {
          cleanupFailure = cleanupError;
        }
      }
      try {
        await handle?.close();
      } catch (cleanupError) {
        cleanupFailure ??= cleanupError;
      }
      if (cleanupFailure !== undefined) {
        throw new ArtifactStoreAuthorityError(
          "ARTIFACT_CAPACITY_AUTHORITY_LOST",
          "Failed to close every owned kernel-lease resource after acquisition failure",
          { cause: { acquisitionFailure: error, cleanupFailure } },
        );
      }
      throw error;
    }
  }
  throw new ArtifactStoreAuthorityError(
    "ARTIFACT_CAPACITY_AUTHORITY_LOCK_TIMEOUT",
    "Filesystem kernel lease was not acquired within the cumulative deadline",
  );
}

async function withKernelLease<T>(
  input: Parameters<typeof acquireKernelLease>[0],
  work: (lease: KernelLease) => Promise<T>,
): Promise<T> {
  const lease = await acquireKernelLease(input);
  try {
    await lease.assertCurrent();
    return await work(lease);
  } finally {
    await lease.release();
  }
}

async function assertBindingRootLayout(
  root: string,
  row: AuthorityRow,
  final: boolean,
  policy: "empty-only" | "inventory-adoption",
): Promise<void> {
  const marker = markerFor(row);
  const descriptor = kernelLockFor(row);
  const markerStageName = path.basename(
    artifactStoreAuthorityStagePathV1(markerPath(root), marker),
  );
  const kernelLockStageName = path.basename(
    artifactStoreAuthorityStagePathV1(kernelLockPath(root), descriptor),
  );
  const allowed = new Set([
    ARTIFACT_STORE_ROOT_AUTHORITY_FILENAME_V1,
    ARTIFACT_STORE_KERNEL_LOCK_FILENAME_V1,
    markerStageName,
    kernelLockStageName,
  ]);
  let directory;
  try {
    directory = await opendir(root);
  } catch (error) {
    if (isTransientFilesystemError(error)) {
      throw unavailableFilesystem(
        "Artifact root binding layout is temporarily unavailable",
        error,
      );
    }
    throw error;
  }
  const observedReserved = new Set<string>();
  let finalArtifactCount = 0;
  try {
    for await (const entry of directory) {
      if (allowed.has(entry.name)) {
        observedReserved.add(entry.name);
        continue;
      }
      if (
        policy === "inventory-adoption"
        && entry.name === ARTIFACT_STORE_STAGING_DIRECTORY_V1
        && entry.isDirectory()
      ) {
        observedReserved.add(entry.name);
        continue;
      }
      if (
        policy === "inventory-adoption"
        && entry.isFile()
        && /^[a-f0-9]{64}\.json$/.test(entry.name)
      ) {
        finalArtifactCount += 1;
        if (finalArtifactCount > MAX_ARTIFACT_INVENTORY_FINAL_FILES_V1) {
          throw new ArtifactStoreAuthorityError(
            "ARTIFACT_ROOT_INVENTORY_LIMIT_EXCEEDED",
            `Artifact root contains more than ${MAX_ARTIFACT_INVENTORY_FINAL_FILES_V1} canonical final artifacts`,
          );
        }
        continue;
      }
      throw new ArtifactStoreAuthorityError(
        "ARTIFACT_ROOT_AUTHORITY_UNMARKED",
        "Artifact root contains foreign content outside the exact binding layout",
      );
    }
  } catch (error) {
    if (error instanceof ArtifactStoreAuthorityError) throw error;
    if (isTransientFilesystemError(error)) {
      throw unavailableFilesystem(
        "Artifact root binding layout changed during bounded enumeration",
        error,
      );
    }
    throw error;
  }
  if (
    final
    && (
      !observedReserved.has(ARTIFACT_STORE_ROOT_AUTHORITY_FILENAME_V1)
      || !observedReserved.has(ARTIFACT_STORE_KERNEL_LOCK_FILENAME_V1)
      || observedReserved.has(markerStageName)
      || observedReserved.has(kernelLockStageName)
      || (policy === "empty-only" && observedReserved.size !== 2)
    )
  ) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact root did not converge to the exact marker/lock binding layout",
    );
  }
}

async function ensureMarkerForBinding(
  root: string,
  row: AuthorityRow,
  hooks: AuthorityTestHooks | undefined,
  acquisitionDeadlineMs: number,
  bindingPolicy: "empty-only" | "inventory-adoption",
): Promise<void> {
  const parentIdentity = await ensureParentIdentity(root);
  await withKernelLease(
    {
      target: path.dirname(root),
      expected: parentIdentity,
      kind: "directory",
      acquisitionDeadlineMs,
      hooks,
    },
    async (parentLease) => {
      await assertParentIdentity(root, parentIdentity);
      let rootExists = true;
      try {
        await rootIdentity(root);
      } catch (error) {
        if (
          error instanceof ArtifactStoreAuthorityError
          && isNodeError(error.cause, "ENOENT")
        ) {
          rootExists = false;
        } else {
          throw error;
        }
      }

      const claimPath = artifactStoreBindingClaimPathV1(root);
      const claim = claimFor(root, row);
      const claimPreexisted = await exactClaimExists(root, row);
      if (rootExists && !claimPreexisted) {
        const adoptionMayBindUnmarkedRoot = bindingPolicy === "inventory-adoption"
          && await optionalLstat(markerPath(root)) === undefined
          && await optionalLstat(kernelLockPath(root)) === undefined;
        if (adoptionMayBindUnmarkedRoot) {
          // Explicit offline adoption is the only capability allowed to bind a
          // bounded root containing canonical finals. It still rejects every
          // foreign entry before publishing the sibling claim or either marker.
          await assertBindingRootLayout(root, row, false, bindingPolicy);
        } else {
          try {
            await assertBindingRootLayout(root, row, true, bindingPolicy);
            await verifyExactRootAuthority(root, row);
            return;
          } catch (error) {
            if (
              error instanceof ArtifactStoreAuthorityError
              && error.code === "ARTIFACT_ROOT_AUTHORITY_UNAVAILABLE"
            ) {
              throw error;
            }
            if (
              error instanceof ArtifactStoreAuthorityError
              && (
                error.code === "ARTIFACT_ROOT_AUTHORITY_CONFLICT"
                || error.code === "ARTIFACT_ROOT_AUTHORITY_INVALID"
              )
              && (await readdir(root)).length > 0
            ) {
              throw error;
            }
            throw new ArtifactStoreAuthorityError(
              "ARTIFACT_ROOT_AUTHORITY_UNMARKED",
              "Existing artifact root has neither an exact binding claim nor exact authority files",
              { cause: error },
            );
          }
        }
      }
      if (!claimPreexisted) {
        const created = await writeCanonicalNoReplace(
          claimPath,
          claim,
          path.dirname(root),
        );
        if (!created && !await exactClaimExists(root, row)) {
          throw new ArtifactStoreAuthorityError(
            "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
            "Artifact root binding claim raced with another authority",
          );
        }
      }
      await parentLease.assertCurrent();
      await assertParentIdentity(root, parentIdentity);

      if (!rootExists) {
        try {
          await mkdir(root, { mode: 0o700 });
          await syncDirectory(path.dirname(root));
          await hooks?.afterRootCreate?.({
            authorityId: row.authority_id,
            rootLocatorHash: row.root_locator_hash,
          });
        } catch (error) {
          if (!isNodeError(error, "EEXIST")) throw error;
          throw new ArtifactStoreAuthorityError(
            "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
            "Artifact root appeared after the exclusive binding claim",
            { cause: error },
          );
        }
      }
      await assertBindingRootLayout(root, row, false, bindingPolicy);
      const expectedRootIdentity = await rootIdentity(root);
      const createdMarker = await writeCanonicalNoReplace(
        markerPath(root),
        markerFor(row),
        root,
      );
      if (createdMarker) {
        await hooks?.afterMarkerCreate?.({
          authorityId: row.authority_id,
          rootLocatorHash: row.root_locator_hash,
        });
      }
      await assertBindingRootLayout(root, row, false, bindingPolicy);
      await writeCanonicalNoReplace(
        kernelLockPath(root),
        kernelLockFor(row),
        root,
      );
      await assertBindingRootLayout(root, row, true, bindingPolicy);
      await verifyExactRootAuthority(root, row, { root: expectedRootIdentity });
      await parentLease.assertCurrent();
      await assertBindingRootLayout(root, row, true, bindingPolicy);
    },
  );
}

async function removeExactBindingClaim(root: string, row: AuthorityRow): Promise<void> {
  const claimPath = artifactStoreBindingClaimPathV1(root);
  if (!await exactClaimExists(root, row)) return;
  let before: Stats;
  try {
    before = await lstat(claimPath);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return;
    throw error;
  }
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_INVALID",
      "Artifact root binding claim changed before cleanup",
    );
  }
  const current = await lstat(claimPath);
  if (!sameIdentity(before, current)) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
      "Artifact root binding claim changed before cleanup",
    );
  }
  try {
    await unlink(claimPath);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return;
    if (isTransientFilesystemError(error)) {
      throw unavailableFilesystem(
        "Artifact root binding claim could not be removed",
        error,
      );
    }
    throw error;
  }
  await syncDirectory(path.dirname(root));
}

function isLockTimeout(error: unknown): boolean {
  return error instanceof Error
    && (
      ("code" in error && error.code === "55P03")
      || /lock timeout/i.test(error.message)
    );
}

function mapDatabaseError(error: unknown): never {
  if (error instanceof ArtifactStoreAuthorityError) throw error;
  if (isLockTimeout(error)) {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_CAPACITY_AUTHORITY_LOCK_TIMEOUT",
      "Artifact capacity PostgreSQL lease was not acquired within its bounded deadline",
      { cause: error },
    );
  }
  throw new ArtifactStoreAuthorityError(
    "ARTIFACT_CAPACITY_AUTHORITY_LOST",
    "Artifact capacity PostgreSQL authority became unavailable",
    { cause: error },
  );
}

function shouldQuarantineAuthorityFailure(
  code: ArtifactStoreAuthorityErrorCode,
): boolean {
  return code === "ARTIFACT_ROOT_AUTHORITY_CONFLICT"
    || code === "ARTIFACT_ROOT_AUTHORITY_INVALID"
    || code === "ARTIFACT_ROOT_AUTHORITY_UNMARKED"
    || code === "ARTIFACT_ROOT_INVENTORY_LIMIT_EXCEEDED"
    || code === "ARTIFACT_ROOT_STAGING_INVALID";
}

export function isHybridArtifactStoreCapacityLeaseProviderV1(
  value: unknown,
): value is ArtifactStoreCapacityLeaseProvider {
  return typeof value === "object"
    && value !== null
    && hybridProviders.has(value);
}

export function artifactStoreCapacityLeaseProviderPurposeV1(
  value: unknown,
): ArtifactStoreCapacityLeasePurposeV1 | undefined {
  return typeof value === "object" && value !== null
    ? hybridProviderPurposes.get(value)
    : undefined;
}

export function createHybridArtifactStoreCapacityLeaseProviderV1(
  input: Readonly<{
    sql: Sql;
    artifactRoot: string;
    /** Read paths must never bootstrap physical authority as a side effect. */
    allowInitialization?: boolean;
    purpose?: ArtifactStoreCapacityLeasePurposeV1;
    lockTimeoutMs?: number;
    workTimeoutMs?: number;
    testHooks?: AuthorityTestHooks;
  }>,
): ArtifactStoreCapacityLeaseProvider {
  if (process.platform !== "darwin") {
    throw new ArtifactStoreAuthorityError(
      "ARTIFACT_CAPACITY_AUTHORITY_PLATFORM_UNSUPPORTED",
      "Artifact capacity hybrid authority currently requires Darwin /usr/bin/lockf",
    );
  }
  const root = normalizedArtifactRoot(input.artifactRoot);
  const rootLocatorHash = artifactStoreRootLocatorHashV1(root);
  const lockTimeoutMs = boundedTimeout(input.lockTimeoutMs, DEFAULT_LOCK_TIMEOUT_MS);
  const workTimeoutMs = boundedTimeout(input.workTimeoutMs, DEFAULT_WORK_TIMEOUT_MS);
  const hooks = input.testHooks;
  if (input.purpose !== undefined && input.allowInitialization !== undefined) {
    throw new TypeError("Artifact store authority purpose cannot be combined with allowInitialization");
  }
  const purpose = input.purpose
    ?? (input.allowInitialization === false ? "reader" : "writer");
  const allowInitialization = purpose === "writer" || purpose === "inventory-adoption";
  const allowStagingCleanup = purpose !== "reader";
  const allowedCapacityStates = new Set<string>(
    purpose === "inventory-adoption"
      ? ["bootstrap_required", "ready"]
      : ["ready"],
  );
  const bindingPolicy = purpose === "inventory-adoption"
    ? "inventory-adoption" as const
    : "empty-only" as const;

  async function bindDatabaseIdentity(
    acquisitionDeadlineMs: number,
  ): Promise<Readonly<{
    row: AuthorityRow;
    created: boolean;
  }>> {
    try {
      return await input.sql.begin(async (transaction) => {
        await configureAndAcquireLock(transaction, acquisitionDeadlineMs, workTimeoutMs);
        await assertCapacityState(transaction, allowedCapacityStates);
        let row = await readAuthorityRow(transaction);
        let created = false;
        if (!row) {
          const authorityId = randomUUID();
          const inserted = await transaction.unsafe<AuthorityRow[]>(
            `INSERT INTO public.artifact_store_authorities (
               authority_key, authority_schema, authority_id,
               root_locator_hash, state
             ) VALUES ($1, $2, $3, $4, 'binding')
             RETURNING authority_key, authority_schema,
                       authority_id::text AS authority_id,
                       root_locator_hash, state, diagnostic`,
            [
              AUTHORITY_KEY,
              ARTIFACT_STORE_AUTHORITY_SCHEMA_V1,
              authorityId,
              rootLocatorHash,
            ],
          );
          row = inserted[0];
          created = true;
        }
        const exact = assertAuthorityRow(row);
        if (exact.state === "quarantined") {
          throw new ArtifactStoreAuthorityError(
            "ARTIFACT_CAPACITY_AUTHORITY_QUARANTINED",
            "Artifact store authority is permanently quarantined",
          );
        }
        if (exact.root_locator_hash !== rootLocatorHash) {
          throw new ArtifactStoreAuthorityError(
            "ARTIFACT_ROOT_AUTHORITY_WRONG_ROOT",
            "Configured artifact root does not match the database-bound root locator",
          );
        }
        return { row: exact, created };
      }) as Readonly<{ row: AuthorityRow; created: boolean }>;
    } catch (error) {
      return mapDatabaseError(error);
    }
  }

  async function ensureReady(acquisitionDeadlineMs: number): Promise<AuthorityRow> {
    const bound = await bindDatabaseIdentity(acquisitionDeadlineMs);
    if (bound.row.state === "quarantined") {
      throw new ArtifactStoreAuthorityError(
        "ARTIFACT_ROOT_AUTHORITY_CONFLICT",
        "Artifact store root locator conflicts with permanent database authority",
      );
    }
    if (bound.created) {
      await hooks?.afterBindingCommit?.({
        authorityId: bound.row.authority_id,
        rootLocatorHash: bound.row.root_locator_hash,
      });
    }
    let result: Readonly<{
      row: AuthorityRow;
      transitioned: boolean;
      failureCode?: ArtifactStoreAuthorityErrorCode;
    }>;
    try {
      result = await input.sql.begin(async (transaction) => {
        await configureAndAcquireLock(transaction, acquisitionDeadlineMs, workTimeoutMs);
        await assertCapacityState(transaction, allowedCapacityStates);
        const current = assertAuthorityRow(await readAuthorityRow(transaction));
        if (current.state === "quarantined") {
          return { row: current, transitioned: false };
        }
        if (
          current.authority_id !== bound.row.authority_id
          || current.root_locator_hash !== rootLocatorHash
        ) {
          throw new ArtifactStoreAuthorityError(
            current.root_locator_hash !== rootLocatorHash
              ? "ARTIFACT_ROOT_AUTHORITY_WRONG_ROOT"
              : "ARTIFACT_CAPACITY_AUTHORITY_LOST",
            "Artifact store database identity changed during ready binding",
          );
        }
        try {
          if (current.state === "binding") {
            await ensureMarkerForBinding(
              root,
              current,
              hooks,
              acquisitionDeadlineMs,
              bindingPolicy,
            );
          } else {
            await verifyExactRootAuthority(root, current);
          }
        } catch (error) {
          if (!(error instanceof ArtifactStoreAuthorityError)) throw error;
          if (!shouldQuarantineAuthorityFailure(error.code)) throw error;
          const quarantined = await quarantineRow(transaction, current, error.code);
          return {
            row: quarantined,
            transitioned: false,
            failureCode: error.code,
          };
        }
        if (current.state === "ready") {
          return { row: current, transitioned: false };
        }
        const rows = await transaction.unsafe<AuthorityRow[]>(
          `UPDATE public.artifact_store_authorities
              SET state = 'ready', diagnostic = NULL
            WHERE authority_key = $1 AND state = 'binding'
            RETURNING authority_key, authority_schema,
                      authority_id::text AS authority_id,
                      root_locator_hash, state, diagnostic`,
          [AUTHORITY_KEY],
        );
        return { row: assertAuthorityRow(rows[0]), transitioned: true };
      }) as Readonly<{
        row: AuthorityRow;
        transitioned: boolean;
        failureCode?: ArtifactStoreAuthorityErrorCode;
      }>;
    } catch (error) {
      return mapDatabaseError(error);
    }
    if (result.failureCode) {
      throw new ArtifactStoreAuthorityError(
        result.failureCode,
        "Artifact root authority binding failed and was quarantined",
      );
    }
    if (result.row.state === "quarantined") {
      throw new ArtifactStoreAuthorityError(
        "ARTIFACT_CAPACITY_AUTHORITY_QUARANTINED",
        "Artifact store authority is permanently quarantined",
      );
    }
    if (result.row.state !== "ready") {
      throw new ArtifactStoreAuthorityError(
        "ARTIFACT_CAPACITY_AUTHORITY_DATABASE_INVALID",
        "Artifact store authority did not reach ready state",
      );
    }
    if (result.transitioned) {
      await hooks?.afterReadyCommit?.({
        authorityId: result.row.authority_id,
        rootLocatorHash: result.row.root_locator_hash,
      });
    }
    await removeExactBindingClaim(root, result.row);
    return result.row;
  }

  async function quarantineAfterLeaseFailure(
    expected: AuthorityRow,
    code: ArtifactStoreAuthorityErrorCode,
  ): Promise<void> {
    if (!shouldQuarantineAuthorityFailure(code)) return;
    try {
      await input.sql.begin(async (transaction) => {
        await configureAndAcquireLock(
          transaction,
          Date.now() + lockTimeoutMs,
          workTimeoutMs,
        );
        const current = assertAuthorityRow(await readAuthorityRow(transaction));
        if (
          current.authority_id === expected.authority_id
          && current.root_locator_hash === expected.root_locator_hash
          && current.state !== "quarantined"
        ) {
          await quarantineRow(transaction, current, code);
        }
      });
    } catch {
      // The original authority loss remains primary. A later preflight or
      // lease attempt rereads the database and physical marker from scratch.
    }
  }

  type ReadyAttempt<T> =
    | Readonly<{ kind: "not-ready" }>
    | Readonly<{ kind: "ready"; value: T }>;

  async function runReadyTransaction<T>(
    acquisitionDeadlineMs: number,
    work: (lease: ArtifactStoreCapacityLease) => Promise<T>,
  ): Promise<ReadyAttempt<T>> {
    let expectedRow: AuthorityRow | undefined;
    let workFailureCaptured = false;
    let workFailure: unknown;
    let authorityFailureAfterWork: ArtifactStoreAuthorityError | undefined;
    try {
      return await input.sql.begin(async (transaction) => {
        await configureAndAcquireLock(
          transaction,
          acquisitionDeadlineMs,
          workTimeoutMs,
        );
        await assertCapacityState(transaction, allowedCapacityStates);
        const observedRow = await readAuthorityRow(transaction);
        if (!observedRow) return { kind: "not-ready" as const };
        const current = assertAuthorityRow(observedRow);
        expectedRow = current;
        if (current.state === "binding") return { kind: "not-ready" as const };
        if (current.state === "quarantined") {
          throw new ArtifactStoreAuthorityError(
            "ARTIFACT_CAPACITY_AUTHORITY_QUARANTINED",
            "Artifact store authority is permanently quarantined",
          );
        }
        if (current.root_locator_hash !== rootLocatorHash) {
          throw new ArtifactStoreAuthorityError(
            "ARTIFACT_ROOT_AUTHORITY_WRONG_ROOT",
            "Configured artifact root does not match the database-bound root locator",
          );
        }
        const heldRootIdentity = await verifyExactRootAuthority(root, current);
        return await withKernelLease(
          {
            target: kernelLockPath(root),
            expected: heldRootIdentity.kernelLock,
            kind: "authority-file",
            acquisitionDeadlineMs,
            hooks,
          },
          async (kernelLease): Promise<ReadyAttempt<T>> => {
            // A process can die after the ready transaction commits but before
            // the temporary sibling claim is removed. The shared descriptor
            // lock makes exact cleanup race-free across restored DB copies.
            await removeExactBindingClaim(root, current);
            const controller = new AbortController();
            const timeout = setTimeout(() => {
              controller.abort(new ArtifactStoreAuthorityError(
                "ARTIFACT_CAPACITY_AUTHORITY_WORK_TIMEOUT",
                "Artifact capacity lease exceeded its bounded work deadline",
              ));
            }, workTimeoutMs);
            timeout.unref?.();
            let stagingIdentity: StagingDirectoryIdentity | undefined;
            const assertFilesystemLeaseCurrent = async (): Promise<void> => {
              if (controller.signal.aborted) {
                throw new ArtifactStoreAuthorityError(
                  "ARTIFACT_CAPACITY_AUTHORITY_WORK_TIMEOUT",
                  "Artifact capacity lease exceeded its bounded work deadline",
                  { cause: controller.signal.reason },
                );
              }
              try {
                await kernelLease.assertCurrent();
              } catch (error) {
                if (error instanceof ArtifactStoreAuthorityError) {
                  throw authorityEvidence(error);
                }
                throw authorityEvidence(new ArtifactStoreAuthorityError(
                  "ARTIFACT_CAPACITY_AUTHORITY_LOST",
                  "Artifact capacity physical authority became unavailable",
                  { cause: error },
                ));
              }
            };
            const assertPhysicalCurrent = async (): Promise<void> => {
              await assertFilesystemLeaseCurrent();
              try {
                await verifyExactRootAuthority(root, current, heldRootIdentity);
              } catch (error) {
                if (error instanceof ArtifactStoreAuthorityError) {
                  throw authorityEvidence(error);
                }
                throw authorityEvidence(new ArtifactStoreAuthorityError(
                  "ARTIFACT_CAPACITY_AUTHORITY_LOST",
                  "Artifact capacity physical authority became unavailable",
                  { cause: error },
                ));
              }
            };
            const assertCurrent = async (): Promise<void> => {
              if (controller.signal.aborted) {
                throw new ArtifactStoreAuthorityError(
                  "ARTIFACT_CAPACITY_AUTHORITY_WORK_TIMEOUT",
                  "Artifact capacity lease exceeded its bounded work deadline",
                  { cause: controller.signal.reason },
                );
              }
              try {
                await assertPhysicalCurrent();
                await transaction.unsafe("SELECT 1");
                await assertCapacityState(transaction, allowedCapacityStates);
                const observed = assertAuthorityRow(await readAuthorityRow(transaction));
                if (
                  observed.state !== "ready"
                  || observed.authority_id !== current.authority_id
                  || observed.root_locator_hash !== current.root_locator_hash
                ) {
                  throw new ArtifactStoreAuthorityError(
                    observed.state === "quarantined"
                      ? "ARTIFACT_CAPACITY_AUTHORITY_QUARANTINED"
                      : "ARTIFACT_CAPACITY_AUTHORITY_LOST",
                    "Artifact store database authority changed during lease work",
                  );
                }
                if (stagingIdentity) {
                  await verifyOwnedStagingRoot(root, stagingIdentity);
                }
              } catch (error) {
                if (error instanceof ArtifactStoreAuthorityError) {
                  throw authorityEvidence(error);
                }
                throw authorityEvidence(new ArtifactStoreAuthorityError(
                  "ARTIFACT_CAPACITY_AUTHORITY_LOST",
                  "Artifact capacity hybrid transaction became unavailable",
                  { cause: error },
                ));
              }
              if (controller.signal.aborted) {
                throw new ArtifactStoreAuthorityError(
                  "ARTIFACT_CAPACITY_AUTHORITY_WORK_TIMEOUT",
                  "Artifact capacity lease exceeded its bounded work deadline",
                  { cause: controller.signal.reason },
                );
              }
            };
            const lease: ArtifactStoreCapacityLease = Object.freeze({
              authority: ARTIFACT_STORE_CAPACITY_LEASE_AUTHORITY_V1,
              authorityId: current.authority_id,
              rootLocatorHash: current.root_locator_hash,
              signal: controller.signal,
              assertCurrent,
            });
            try {
              await assertCurrent();
              if (allowStagingCleanup) {
                try {
                  stagingIdentity = await ensureAndCleanOwnedStaging(
                    root,
                    assertFilesystemLeaseCurrent,
                    hooks,
                  );
                } catch (error) {
                  if (error instanceof ArtifactStoreAuthorityError) {
                    throw authorityEvidence(error);
                  }
                  throw authorityEvidence(new ArtifactStoreAuthorityError(
                    "ARTIFACT_CAPACITY_AUTHORITY_LOST",
                    "Artifact staging authority became unavailable",
                    { cause: error },
                  ));
                }
                await assertCurrent();
              }
              let value: T;
              try {
                value = await work(lease);
              } catch (error) {
                workFailureCaptured = true;
                workFailure = error;
                if (isAuthorityEvidenceError(error)) {
                  authorityFailureAfterWork = error;
                  throw error;
                }
                try {
                  await assertCurrent();
                } catch (authorityError) {
                  if (authorityError instanceof ArtifactStoreAuthorityError) {
                    authorityFailureAfterWork = authorityError;
                  }
                  throw authorityError;
                }
                throw error;
              }
              await assertCurrent();
              return { kind: "ready", value };
            } finally {
              clearTimeout(timeout);
            }
          },
        );
      }) as ReadyAttempt<T>;
    } catch (error) {
      if (authorityFailureAfterWork) {
        if (expectedRow) {
          await quarantineAfterLeaseFailure(
            expectedRow,
            authorityFailureAfterWork.code,
          );
        }
        throw authorityFailureAfterWork;
      }
      // Caller errors, including caller-constructed ArtifactStoreAuthorityError
      // instances, are never authority evidence. A fresh check above proved
      // authority healthy before this branch can be reached.
      if (workFailureCaptured) throw workFailure;
      if (error instanceof ArtifactStoreAuthorityError) {
        if (expectedRow) {
          await quarantineAfterLeaseFailure(expectedRow, error.code);
        }
        throw error;
      }
      return mapDatabaseError(error);
    }
  }

  const provider: ArtifactStoreCapacityLeaseProvider = Object.freeze({
    authority: ARTIFACT_STORE_CAPACITY_LEASE_AUTHORITY_V1,
    artifactRoot: root,
    async withLease<T>(
      work: (lease: ArtifactStoreCapacityLease) => Promise<T>,
    ): Promise<T> {
      const acquisitionDeadlineMs = Date.now() + lockTimeoutMs;
      let attempt = await runReadyTransaction(acquisitionDeadlineMs, work);
      if (attempt.kind === "not-ready") {
        if (!allowInitialization) {
          throw new ArtifactStoreAuthorityError(
            "ARTIFACT_CAPACITY_AUTHORITY_NOT_READY",
            "Artifact store authority is not ready and this read-only provider cannot initialize it",
          );
        }
        await ensureReady(acquisitionDeadlineMs);
        attempt = await runReadyTransaction(acquisitionDeadlineMs, work);
      }
      if (attempt.kind !== "ready") {
        throw new ArtifactStoreAuthorityError(
          "ARTIFACT_CAPACITY_AUTHORITY_LOST",
          "Artifact store authority did not remain ready for hybrid lease work",
        );
      }
      return attempt.value;
    },
  });
  hybridProviders.add(provider);
  hybridProviderPurposes.set(provider, purpose);
  return provider;
}
