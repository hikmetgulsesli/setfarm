import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  chmodSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import type { BigIntStats } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";

const SHA256_V1 = /^[0-9a-f]{64}$/;
const GIT_SHA_V1 = /^[0-9a-f]{40}$/;
const RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_EXCLUDE_V1 = [
  "/.setfarm/",
  "/quality-reports/qa-test-1.md",
  "/quality-reports/.qa-test-1.md.setfarm-recovery-publish.tmp",
  "/quality-reports/qa-test-1.json",
  "/quality-reports/.qa-test-1.json.setfarm-recovery-publish.tmp",
  "/quality-reports/final-test-1.json",
  "/quality-reports/.final-test-1.json.setfarm-recovery-publish.tmp",
  "/smoke-home.png",
  "/.smoke-home.png.setfarm-recovery-publish.tmp",
  "/smoke-after-click.png",
  "/.smoke-after-click.png.setfarm-recovery-publish.tmp",
  "",
].join("\n");
const RECOVERY_SOURCE_BOOTSTRAP_ARTIFACT_TARGETS_V1 = Object.freeze([
  ".setfarm/run-runtime.json",
  "quality-reports/qa-test-1.md",
  "quality-reports/qa-test-1.json",
  "quality-reports/final-test-1.json",
  "smoke-home.png",
  "smoke-after-click.png",
] as const);
export type InternalProductionRecoverySourceBootstrapArtifactPathV1 =
  (typeof RECOVERY_SOURCE_BOOTSTRAP_ARTIFACT_TARGETS_V1)[number];

function recoveryArtifactTempPathV1(relativePath: string): string {
  const directory = path.posix.dirname(relativePath);
  const basename = path.posix.basename(relativePath);
  const temp = `.${basename}.setfarm-recovery-publish.tmp`;
  return directory === "." ? temp : `${directory}/${temp}`;
}

const RECOVERY_SOURCE_BOOTSTRAP_EXACT_ARTIFACTS_V1 = Object.freeze([
  ...RECOVERY_SOURCE_BOOTSTRAP_ARTIFACT_TARGETS_V1,
  ...RECOVERY_SOURCE_BOOTSTRAP_ARTIFACT_TARGETS_V1.map(recoveryArtifactTempPathV1),
]);

const AUTHENTICATED_RECOVERY_REPOSITORY_DIRENT_ERASER_V1 = String.raw`
import { closeSync, constants, fsyncSync, lstatSync, openSync, readFileSync, rmdirSync, unlinkSync } from "node:fs";

const fail = () => { throw new Error("RECOVERY_SOURCE_BOOTSTRAP_ERASER_INVALID"); };
const input = JSON.parse(readFileSync(0, "utf8"));
if (
  Object.keys(input).sort().join(",") !== "ancestors,dev,ino,kind,mode,name,nlink,rootDev,rootIno"
  || !Array.isArray(input.ancestors)
  || input.ancestors.length > 128
  || !/^[0-9]+$/.test(input.rootDev)
  || !/^[0-9]+$/.test(input.rootIno)
  || !/^[0-9]+$/.test(input.dev)
  || !/^[0-9]+$/.test(input.ino)
  || !/^[0-9]+$/.test(input.mode)
  || !/^[0-9]+$/.test(input.nlink)
  || !["directory", "file", "symlink"].includes(input.kind)
  || typeof input.name !== "string"
  || input.name.length === 0
  || input.name === "."
  || input.name === ".."
  || input.name.includes("/")
) fail();
for (const ancestor of input.ancestors) {
  if (
    Object.keys(ancestor).sort().join(",") !== "dev,ino,name"
    || typeof ancestor.name !== "string"
    || ancestor.name.length === 0
    || ancestor.name === "."
    || ancestor.name === ".."
    || ancestor.name.includes("/")
    || !/^[0-9]+$/.test(ancestor.dev)
    || !/^[0-9]+$/.test(ancestor.ino)
  ) fail();
}
const kind = (observed) => observed.isDirectory()
  ? "directory"
  : observed.isFile()
    ? "file"
    : observed.isSymbolicLink()
      ? "symlink"
      : fail();
let parent = lstatSync(".", { bigint: true });
if (!parent.isDirectory() || String(parent.dev) !== input.rootDev || String(parent.ino) !== input.rootIno) fail();
for (const ancestor of input.ancestors) {
  const named = lstatSync("./" + ancestor.name, { bigint: true });
  if (
    !named.isDirectory()
    || named.isSymbolicLink()
    || String(named.dev) !== ancestor.dev
    || String(named.ino) !== ancestor.ino
  ) fail();
  process.chdir(ancestor.name);
  parent = lstatSync(".", { bigint: true });
  if (!parent.isDirectory() || String(parent.dev) !== ancestor.dev || String(parent.ino) !== ancestor.ino) fail();
}
const target = "./" + input.name;
const observed = lstatSync(target, { bigint: true });
if (
  kind(observed) !== input.kind
  || String(observed.dev) !== input.dev
  || String(observed.ino) !== input.ino
  || String(observed.mode) !== input.mode
  || (input.kind !== "directory" && String(observed.nlink) !== input.nlink)
) fail();
if (input.kind === "directory") rmdirSync(target);
else unlinkSync(target);
const parentDescriptor = openSync(".", constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
try { fsyncSync(parentDescriptor); } finally { closeSync(parentDescriptor); }
const parentAfter = lstatSync(".", { bigint: true });
if (!parentAfter.isDirectory() || String(parentAfter.dev) !== String(parent.dev) || String(parentAfter.ino) !== String(parent.ino)) fail();
process.stdout.write(JSON.stringify({schema:"setfarm.internal-production-recovery-source-bootstrap-dirent-erasure.v1",dev:input.dev,ino:input.ino}));
`;

const AUTHENTICATED_RECOVERY_REPOSITORY_ARTIFACT_PUBLISHER_V1 = String.raw`
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const fail = () => { throw new Error("RECOVERY_SOURCE_BOOTSTRAP_ARTIFACT_PUBLISHER_INVALID"); };
const input = JSON.parse(readFileSync(0, "utf8"));
if (
  Object.keys(input).sort().join(",") !== "bytes,expectedParent,relativePath,rootDev,rootIno,rootUid,targetName,tempName"
  || typeof input.bytes !== "string"
  || input.bytes.length === 0
  || input.bytes.length > 48 * 1024 * 1024
  || typeof input.relativePath !== "string"
  || typeof input.targetName !== "string"
  || typeof input.tempName !== "string"
  || input.targetName.length === 0
  || input.tempName.length === 0
  || input.targetName === "."
  || input.targetName === ".."
  || input.tempName === "."
  || input.tempName === ".."
  || input.targetName.includes("/")
  || input.tempName.includes("/")
  || !/^[0-9]+$/.test(input.rootDev)
  || !/^[0-9]+$/.test(input.rootIno)
  || !/^[0-9]+$/.test(input.rootUid)
  || input.expectedParent === null
  || typeof input.expectedParent !== "object"
  || Object.keys(input.expectedParent).sort().join(",") !== "dev,ino,name,uid"
  || typeof input.expectedParent.name !== "string"
  || input.expectedParent.name === "."
  || input.expectedParent.name === ".."
  || input.expectedParent.name.includes("/")
) fail();
const expectedRelativePath = input.expectedParent.name === ""
  ? input.targetName
  : input.expectedParent.name + "/" + input.targetName;
if (
  input.relativePath !== expectedRelativePath
  || input.tempName !== "." + input.targetName + ".setfarm-recovery-publish.tmp"
) fail();
const bytes = Buffer.from(input.bytes, "base64");
if (bytes.length === 0 || bytes.length > 32 * 1024 * 1024 || bytes.toString("base64") !== input.bytes) fail();
const rootPath = process.cwd();
const root = lstatSync(".", { bigint: true });
if (
  !root.isDirectory()
  || root.isSymbolicLink()
  || String(root.dev) !== input.rootDev
  || String(root.ino) !== input.rootIno
  || String(root.uid) !== input.rootUid
) fail();
let parent = root;
if (input.expectedParent.name !== "") {
  const parentPath = "./" + input.expectedParent.name;
  let namedParent;
  try {
    const named = lstatSync(parentPath, { bigint: true });
    if (
      input.expectedParent.dev === null
      || input.expectedParent.ino === null
      || input.expectedParent.uid === null
      || !named.isDirectory()
      || named.isSymbolicLink()
      || String(named.dev) !== input.expectedParent.dev
      || String(named.ino) !== input.expectedParent.ino
      || String(named.uid) !== input.expectedParent.uid
    ) fail();
    namedParent = named;
  } catch (error) {
    if (input.expectedParent.dev !== null || input.expectedParent.ino !== null || input.expectedParent.uid !== null) fail();
    mkdirSync(parentPath, { mode: 0o700 });
    namedParent = lstatSync(parentPath, { bigint: true });
    if (
      !namedParent.isDirectory()
      || namedParent.isSymbolicLink()
      || String(namedParent.uid) !== input.rootUid
      || namedParent.dev !== root.dev
    ) fail();
  }
  process.chdir(input.expectedParent.name);
  parent = lstatSync(".", { bigint: true });
  const namedAfterChdir = lstatSync(rootPath + "/" + input.expectedParent.name, { bigint: true });
  if (
    !parent.isDirectory()
    || parent.isSymbolicLink()
    || String(parent.uid) !== input.rootUid
    || parent.dev !== root.dev
    || parent.dev !== namedParent.dev
    || parent.ino !== namedParent.ino
    || namedAfterChdir.dev !== parent.dev
    || namedAfterChdir.ino !== parent.ino
  ) fail();
}
const target = "./" + input.targetName;
const temp = "./" + input.tempName;
const validateOwnedFile = (candidate) => {
  const observed = lstatSync(candidate, { bigint: true });
  if (
    !observed.isFile()
    || observed.isSymbolicLink()
    || observed.nlink !== 1n
    || String(observed.uid) !== input.rootUid
  ) fail();
  return observed;
};
try { validateOwnedFile(target); } catch (error) {
  try { lstatSync(target, { bigint: true }); fail(); } catch (missing) {
    if (String(missing?.code ?? "") !== "ENOENT") throw missing;
  }
}
try {
  const staged = validateOwnedFile(temp);
  if ((staged.mode & 0o777n) !== 0o600n) fail();
  unlinkSync(temp);
} catch (error) {
  try { lstatSync(temp, { bigint: true }); fail(); } catch (missing) {
    if (String(missing?.code ?? "") !== "ENOENT") throw missing;
  }
}
const descriptor = openSync(
  temp,
  constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
  0o600,
);
let staged;
try {
  writeFileSync(descriptor, bytes);
  fsyncSync(descriptor);
  staged = fstatSync(descriptor, { bigint: true });
  if (
    !staged.isFile()
    || staged.isSymbolicLink()
    || staged.nlink !== 1n
    || (staged.mode & 0o777n) !== 0o600n
    || staged.size !== BigInt(bytes.length)
    || String(staged.uid) !== input.rootUid
  ) fail();
} finally {
  closeSync(descriptor);
}
const parentBeforeRename = lstatSync(".", { bigint: true });
if (parentBeforeRename.dev !== parent.dev || parentBeforeRename.ino !== parent.ino) fail();
const rootBeforeRename = lstatSync(rootPath, { bigint: true });
if (rootBeforeRename.dev !== root.dev || rootBeforeRename.ino !== root.ino) fail();
if (input.expectedParent.name !== "") {
  const namedParent = lstatSync(rootPath + "/" + input.expectedParent.name, { bigint: true });
  if (namedParent.dev !== parent.dev || namedParent.ino !== parent.ino) fail();
}
try { validateOwnedFile(target); } catch (error) {
  try { lstatSync(target, { bigint: true }); fail(); } catch (missing) {
    if (String(missing?.code ?? "") !== "ENOENT") throw missing;
  }
}
renameSync(temp, target);
const parentDescriptor = openSync(".", constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
try { fsyncSync(parentDescriptor); } finally { closeSync(parentDescriptor); }
const finalDescriptor = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW);
let finalBytes;
try {
  const before = fstatSync(finalDescriptor, { bigint: true });
  finalBytes = readFileSync(finalDescriptor);
  const after = fstatSync(finalDescriptor, { bigint: true });
  const named = lstatSync(target, { bigint: true });
  if (
    !before.isFile()
    || before.isSymbolicLink()
    || before.nlink !== 1n
    || (before.mode & 0o777n) !== 0o600n
    || before.size !== BigInt(bytes.length)
    || String(before.uid) !== input.rootUid
    || after.dev !== before.dev
    || after.ino !== before.ino
    || after.mtimeNs !== before.mtimeNs
    || after.ctimeNs !== before.ctimeNs
    || named.dev !== before.dev
    || named.ino !== before.ino
    || !finalBytes.equals(bytes)
  ) fail();
} finally {
  closeSync(finalDescriptor);
}
const parentAfter = lstatSync(".", { bigint: true });
if (parentAfter.dev !== parent.dev || parentAfter.ino !== parent.ino) fail();
const rootAfter = lstatSync(rootPath, { bigint: true });
if (rootAfter.dev !== root.dev || rootAfter.ino !== root.ino) fail();
if (input.expectedParent.name !== "") {
  const namedParent = lstatSync(rootPath + "/" + input.expectedParent.name, { bigint: true });
  if (namedParent.dev !== parent.dev || namedParent.ino !== parent.ino) fail();
}
process.stdout.write(JSON.stringify({
  schema:"setfarm.internal-production-recovery-source-bootstrap-artifact-publication.v1",
  relativePath:input.relativePath,
  artifactHash:createHash("sha256").update(finalBytes).digest("hex"),
}));
`;

export type InternalProductionRecoverySourceBootstrapRepositoryIdentityV1 = Readonly<{
  sourceRepositoryRoot: string;
  workspaceRoot: string;
  repositoryRoot: string;
  branch: string;
}>;

type RecoverySourceBootstrapRepositoryMarkerV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-source-bootstrap-repository.v1";
  runId: string;
  operationRef: string;
  operationHash: string;
  baseSourceSha: string;
  baseSourceTreeHash: string;
  sourceRepositoryRoot: string;
  repositoryRoot: string;
  branch: string;
  originHash: string;
  markerHash: string;
}>;

export type PrepareRecoverySourceBootstrapRepositoryInputV1 = Readonly<{
  sourceRepositoryRoot: string;
  runId: string;
  operationRef: string;
  operationHash: string;
  baseSourceSha: string;
  baseSourceTreeHash: string;
}>;

type RecoverySourceBootstrapErasureEntryV1 = Readonly<{
  locator: string;
  parentLocator: string;
  name: string;
  kind: "directory" | "file" | "symlink";
  parentDev: string;
  parentIno: string;
  dev: string;
  ino: string;
  mode: string;
  nlink: string;
}>;

type RecoverySourceBootstrapErasureJournalV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-source-bootstrap-erasure-journal.v1";
  authorityHash: string;
  rootDev: string;
  rootIno: string;
  entryCount: number;
  inventoryHash: string;
  entries: readonly RecoverySourceBootstrapErasureEntryV1[];
  journalHash: string;
}>;

export type InternalProductionRecoverySourceBootstrapErasureCompletionV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-source-bootstrap-erasure-completion.v1";
  authorityHash: string;
  journalHash: string;
  rootDev: string;
  rootIno: string;
  completionHash: string;
}>;

export type InternalProductionRecoverySourceBootstrapRepositoryCleanupStateV1 =
  | "workspace"
  | "claimed"
  | "erasing"
  | "erased"
  | "absent";

function fail(message: string): never {
  throw new Error(message);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function erasureJournalPath(
  identity: InternalProductionRecoverySourceBootstrapRepositoryIdentityV1,
  runId: string,
): string {
  return path.join(path.dirname(identity.workspaceRoot), `.cleanup-${runId}.erasure.json`);
}

function erasureCompletionPath(
  identity: InternalProductionRecoverySourceBootstrapRepositoryIdentityV1,
  runId: string,
): string {
  return path.join(path.dirname(identity.workspaceRoot), `.cleanup-${runId}.erasure-complete.json`);
}

function erasureEntryKind(observed: BigIntStats): RecoverySourceBootstrapErasureEntryV1["kind"] {
  if (observed.isDirectory()) return "directory";
  if (observed.isFile()) return "file";
  if (observed.isSymbolicLink()) return "symlink";
  fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_SPECIAL_NODE");
}

function inventoryErasureEntries(
  cleanupRoot: string,
  expectedRoot: Readonly<{ dev: bigint; ino: bigint }>,
): readonly RecoverySourceBootstrapErasureEntryV1[] {
  const entries: RecoverySourceBootstrapErasureEntryV1[] = [];
  const visit = (parentLocator: string, depth: number): void => {
    if (depth > 128) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_DEPTH_EXCEEDED");
    const parentTarget = parentLocator === "." ? cleanupRoot : path.join(cleanupRoot, parentLocator);
    const parent = lstatSync(parentTarget, { bigint: true });
    if (!parent.isDirectory()) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_INVENTORY_CROSSED");
    for (const name of readdirSync(parentTarget).sort()) {
      if (entries.length >= 50_000) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_ENTRY_LIMIT_EXCEEDED");
      const locator = parentLocator === "." ? name : `${parentLocator}/${name}`;
      const observed = lstatSync(path.join(cleanupRoot, locator), { bigint: true });
      const kind = erasureEntryKind(observed);
      if (kind !== "directory" && observed.nlink !== 1n) {
        fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_HARDLINK_CROSSED");
      }
      entries.push(Object.freeze({
        locator,
        parentLocator,
        name,
        kind,
        parentDev: String(parent.dev),
        parentIno: String(parent.ino),
        dev: String(observed.dev),
        ino: String(observed.ino),
        mode: String(observed.mode),
        nlink: String(observed.nlink),
      }));
      if (kind === "directory") visit(locator, depth + 1);
    }
  };
  const root = lstatSync(cleanupRoot, { bigint: true });
  if (!root.isDirectory() || root.dev !== expectedRoot.dev || root.ino !== expectedRoot.ino) {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_ROOT_CROSSED");
  }
  visit(".", 0);
  const rootAfter = lstatSync(cleanupRoot, { bigint: true });
  if (rootAfter.dev !== expectedRoot.dev || rootAfter.ino !== expectedRoot.ino) {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_ROOT_CROSSED");
  }
  return Object.freeze(entries);
}

function git(repositoryRoot: string, args: readonly string[]): string {
  try {
    return execFileSync("git", [
      "-c", "core.hooksPath=/dev/null",
      "-c", "core.excludesFile=/dev/null",
      ...args,
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    }).trim();
  } catch {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_GIT_INVALID");
  }
}

function normalizeSourceOriginUrl(sourceRepositoryRoot: string, originUrl: string): string {
  if (originUrl.length === 0) fail("RECOVERY_SOURCE_BOOTSTRAP_SOURCE_ORIGIN_INVALID");
  if (
    /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(originUrl)
    || /^[^/@\s]+@[^:\s]+:.+/.test(originUrl)
  ) return originUrl;
  const localOrigin = path.isAbsolute(originUrl)
    ? originUrl
    : path.resolve(sourceRepositoryRoot, originUrl);
  try {
    return realpathSync(localOrigin);
  } catch {
    fail("RECOVERY_SOURCE_BOOTSTRAP_SOURCE_ORIGIN_INVALID");
  }
}

function exactInput(input: PrepareRecoverySourceBootstrapRepositoryInputV1): void {
  if (
    !SHA256_V1.test(input.runId)
    || typeof input.operationRef !== "string"
    || input.operationRef.length === 0
    || !SHA256_V1.test(input.operationHash)
    || !GIT_SHA_V1.test(input.baseSourceSha)
    || !GIT_SHA_V1.test(input.baseSourceTreeHash)
    || typeof input.sourceRepositoryRoot !== "string"
    || !path.isAbsolute(input.sourceRepositoryRoot)
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_INPUT_INVALID");
}

function authorityHash(input: PrepareRecoverySourceBootstrapRepositoryInputV1): string {
  return sha256(canonicalJsonStringify(input));
}

function validateErasureJournal(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
  journal: RecoverySourceBootstrapErasureJournalV1,
): RecoverySourceBootstrapErasureJournalV1 {
  if (
    Reflect.ownKeys(journal).length !== 8
    || journal.schema !== "setfarm.internal-production-recovery-source-bootstrap-erasure-journal.v1"
    || journal.authorityHash !== authorityHash(input)
    || !/^[0-9]+$/.test(journal.rootDev)
    || !/^[0-9]+$/.test(journal.rootIno)
    || !Number.isSafeInteger(journal.entryCount)
    || journal.entryCount < 1
    || journal.entryCount > 50_000
    || journal.entries.length !== journal.entryCount
    || !SHA256_V1.test(journal.inventoryHash)
    || !SHA256_V1.test(journal.journalHash)
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_JOURNAL_INVALID");
  const directories = new Map<string, RecoverySourceBootstrapErasureEntryV1>();
  const locators = new Set<string>();
  for (const entry of journal.entries) {
    if (
      Reflect.ownKeys(entry).length !== 10
      || !["directory", "file", "symlink"].includes(entry.kind)
      || typeof entry.name !== "string"
      || typeof entry.parentLocator !== "string"
      || typeof entry.locator !== "string"
      || entry.locator !== (entry.parentLocator === "." ? entry.name : `${entry.parentLocator}/${entry.name}`)
      || path.isAbsolute(entry.locator)
      || entry.locator.split("/").some((part) => part.length === 0 || part === "." || part === "..")
      || !/^[0-9]+$/.test(entry.parentDev)
      || !/^[0-9]+$/.test(entry.parentIno)
      || !/^[0-9]+$/.test(entry.dev)
      || !/^[0-9]+$/.test(entry.ino)
      || !/^[0-9]+$/.test(entry.mode)
      || !/^[0-9]+$/.test(entry.nlink)
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_JOURNAL_INVALID");
    if (locators.has(entry.locator)) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_JOURNAL_INVALID");
    }
    locators.add(entry.locator);
    if (entry.parentLocator === ".") {
      if (entry.parentDev !== journal.rootDev || entry.parentIno !== journal.rootIno) {
        fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_JOURNAL_INVALID");
      }
    } else {
      const parent = directories.get(entry.parentLocator);
      if (
        parent === undefined
        || parent.kind !== "directory"
        || entry.parentDev !== parent.dev
        || entry.parentIno !== parent.ino
      ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_JOURNAL_INVALID");
    }
    if (entry.kind === "directory") directories.set(entry.locator, entry);
  }
  const { journalHash, ...body } = journal;
  if (
    journal.inventoryHash !== sha256(canonicalJsonStringify(journal.entries))
    || journalHash !== sha256(canonicalJsonStringify(body))
    || canonicalJsonStringify({ ...body, journalHash }) !== canonicalJsonStringify(journal)
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_JOURNAL_CROSSED");
  return journal;
}

function fsyncErasureDirectory(directory: string): void {
  const before = lstatSync(directory, { bigint: true });
  const descriptor = openSync(directory, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
  try {
    const pinned = fstatSync(descriptor, { bigint: true });
    const named = lstatSync(directory, { bigint: true });
    if (
      !before.isDirectory()
      || before.isSymbolicLink()
      || !pinned.isDirectory()
      || pinned.isSymbolicLink()
      || !named.isDirectory()
      || named.isSymbolicLink()
      || pinned.dev !== before.dev
      || pinned.ino !== before.ino
      || named.dev !== before.dev
      || named.ino !== before.ino
      || realpathSync(directory) !== path.resolve(directory)
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED");
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function readPinnedErasureRecord(
  target: string,
  maxBytes: bigint,
  allowedLinks: ReadonlySet<bigint>,
  message: string,
): Readonly<{ bytes: Buffer; stats: BigIntStats }> {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = fstatSync(descriptor, { bigint: true });
    const named = lstatSync(target, { bigint: true });
    if (
      !before.isFile()
      || before.isSymbolicLink()
      || !named.isFile()
      || named.isSymbolicLink()
      || before.dev !== named.dev
      || before.ino !== named.ino
      || before.mode !== named.mode
      || before.nlink !== named.nlink
      || (before.mode & 0o777n) !== 0o600n
      || !allowedLinks.has(before.nlink)
      || before.size < 1n
      || before.size > maxBytes
      || (typeof process.getuid === "function" && before.uid !== BigInt(process.getuid()))
    ) throw new Error();
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (
      after.dev !== before.dev
      || after.ino !== before.ino
      || after.mode !== before.mode
      || after.nlink !== before.nlink
      || after.size !== before.size
      || after.mtimeNs !== before.mtimeNs
      || after.ctimeNs !== before.ctimeNs
      || BigInt(bytes.length) !== before.size
    ) throw new Error();
    return Object.freeze({ bytes, stats: before });
  } catch {
    fail(message);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return fail(message);
}

function erasurePublisherCandidates(target: string): readonly string[] {
  const directory = path.dirname(target);
  const basename = path.basename(target);
  const prefix = `${basename}.tmp-`;
  const candidates = readdirSync(directory)
    .filter((name) => name.startsWith(prefix))
    .sort();
  if (
    candidates.length > 1
    || candidates.some((name) => !/^.+\.tmp-[0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(name))
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED");
  return Object.freeze(candidates.map((name) => path.join(directory, name)));
}

function releaseIncompleteErasurePublisherCandidate(
  candidate: string,
  expected: Buffer,
): boolean {
  let descriptor: number | undefined;
  let observedBytes: Buffer | undefined;
  try {
    descriptor = openSync(candidate, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = fstatSync(descriptor, { bigint: true });
    const named = lstatSync(candidate, { bigint: true });
    if (
      !before.isFile()
      || before.isSymbolicLink()
      || !named.isFile()
      || named.isSymbolicLink()
      || before.dev !== named.dev
      || before.ino !== named.ino
      || before.mode !== named.mode
      || before.nlink !== 1n
      || named.nlink !== 1n
      || (before.mode & 0o777n) !== 0o600n
      || before.size < 0n
      || before.size > BigInt(expected.length)
      || (typeof process.getuid === "function" && before.uid !== BigInt(process.getuid()))
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED");
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (
      after.dev !== before.dev
      || after.ino !== before.ino
      || after.mode !== before.mode
      || after.nlink !== before.nlink
      || after.size !== before.size
      || after.mtimeNs !== before.mtimeNs
      || after.ctimeNs !== before.ctimeNs
      || BigInt(bytes.length) !== before.size
      || !expected.subarray(0, bytes.length).equals(bytes)
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED");
    observedBytes = bytes;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  if (observedBytes === undefined) {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED");
  }
  unlinkAuthenticatedErasureRecordV1(
    candidate,
    observedBytes,
    new Set([1n]),
    "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED",
  );
  return false;
}

function publishExactErasureRecord(target: string, bytes: string): void {
  const directory = path.dirname(target);
  validatePrivateErasureDirectory(directory);
  const expected = Buffer.from(bytes, "utf8");
  const normalizeFixed = (): boolean => {
    if (!pathEntryExistsNoFollow(target)) return false;
    const fixed = readPinnedErasureRecord(
      target, 64n * 1024n * 1024n, new Set([1n, 2n]),
      "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED",
    );
    if (!fixed.bytes.equals(expected)) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED");
    const candidates = erasurePublisherCandidates(target);
    if (fixed.stats.nlink === 2n) {
      if (candidates.length !== 1) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED");
      const twin = readPinnedErasureRecord(
        candidates[0]!, 64n * 1024n * 1024n, new Set([2n]),
        "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED",
      );
      if (
        twin.stats.dev !== fixed.stats.dev
        || twin.stats.ino !== fixed.stats.ino
        || !twin.bytes.equals(expected)
      ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED");
      unlinkAuthenticatedErasureRecordV1(
        candidates[0]!, expected, new Set([2n]),
        "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED",
      );
    } else if (candidates.length !== 0) {
      const abandoned = readPinnedErasureRecord(
        candidates[0]!, 64n * 1024n * 1024n, new Set([1n]),
        "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED",
      );
      if (!abandoned.bytes.equals(expected)) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED");
      unlinkAuthenticatedErasureRecordV1(
        candidates[0]!, expected, new Set([1n]),
        "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED",
      );
    }
    const normalized = readPinnedErasureRecord(
      target, 64n * 1024n * 1024n, new Set([1n]),
      "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED",
    );
    if (!normalized.bytes.equals(expected)) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED");
    return true;
  };
  if (normalizeFixed()) return;

  let temporary: string | undefined = erasurePublisherCandidates(target)[0];
  if (temporary !== undefined && !releaseIncompleteErasurePublisherCandidate(temporary, expected)) {
    temporary = undefined;
  }
  if (temporary === undefined) {
    temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
    const descriptor = openSync(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      writeFileSync(descriptor, expected);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  }
  const staged = readPinnedErasureRecord(
    temporary, 64n * 1024n * 1024n, new Set([1n]),
    "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED",
  );
  if (!staged.bytes.equals(expected)) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED");
  try {
    linkSync(temporary, target);
    fsyncErasureDirectory(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  normalizeFixed();
}

function readErasureJournal(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
  journalPath: string,
): RecoverySourceBootstrapErasureJournalV1 {
  const initial = readPinnedErasureRecord(
    journalPath, 64n * 1024n * 1024n, new Set([1n, 2n]),
    "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_JOURNAL_INVALID",
  );
  publishExactErasureRecord(journalPath, initial.bytes.toString("utf8"));
  const bytes = readPinnedErasureRecord(
    journalPath, 64n * 1024n * 1024n, new Set([1n]),
    "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_JOURNAL_INVALID",
  ).bytes;
  let journal: RecoverySourceBootstrapErasureJournalV1;
  try {
    journal = JSON.parse(bytes.toString("utf8")) as RecoverySourceBootstrapErasureJournalV1;
  } catch {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_JOURNAL_INVALID");
  }
  return validateErasureJournal(input, journal);
}

function publishErasureJournal(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
  journalPath: string,
  root: Readonly<{ dev: bigint; ino: bigint }>,
  entries: readonly RecoverySourceBootstrapErasureEntryV1[],
): RecoverySourceBootstrapErasureJournalV1 {
  const body = Object.freeze({
    schema: "setfarm.internal-production-recovery-source-bootstrap-erasure-journal.v1" as const,
    authorityHash: authorityHash(input),
    rootDev: String(root.dev),
    rootIno: String(root.ino),
    entryCount: entries.length,
    inventoryHash: sha256(canonicalJsonStringify(entries)),
    entries,
  });
  const journal = Object.freeze({ ...body, journalHash: sha256(canonicalJsonStringify(body)) });
  publishExactErasureRecord(journalPath, canonicalJsonStringify(journal));
  return readErasureJournal(input, journalPath);
}

function readErasureCompletion(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
  target: string,
): InternalProductionRecoverySourceBootstrapErasureCompletionV1 {
  const initial = readPinnedErasureRecord(
    target, 1024n * 1024n, new Set([1n, 2n]),
    "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_COMPLETION_INVALID",
  );
  publishExactErasureRecord(target, initial.bytes.toString("utf8"));
  let observed: InternalProductionRecoverySourceBootstrapErasureCompletionV1;
  try {
    observed = JSON.parse(readPinnedErasureRecord(
      target, 1024n * 1024n, new Set([1n]),
      "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_COMPLETION_INVALID",
    ).bytes.toString("utf8")) as InternalProductionRecoverySourceBootstrapErasureCompletionV1;
  } catch {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_COMPLETION_INVALID");
  }
  const { completionHash, ...body } = observed;
  if (
    Reflect.ownKeys(observed).length !== 6
    || observed.schema !== "setfarm.internal-production-recovery-source-bootstrap-erasure-completion.v1"
    || observed.authorityHash !== authorityHash(input)
    || !SHA256_V1.test(observed.journalHash)
    || !/^[0-9]+$/.test(observed.rootDev)
    || !/^[0-9]+$/.test(observed.rootIno)
    || completionHash !== sha256(canonicalJsonStringify(body))
    || canonicalJsonStringify({ ...body, completionHash }) !== canonicalJsonStringify(observed)
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_COMPLETION_CROSSED");
  return observed;
}

function validateErasureCompletionCensusRecordV1(target: string): void {
  let observed: InternalProductionRecoverySourceBootstrapErasureCompletionV1;
  try {
    observed = JSON.parse(readPinnedErasureRecord(
      target, 1024n * 1024n, new Set([1n]),
      "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_CENSUS_CROSSED",
    ).bytes.toString("utf8")) as InternalProductionRecoverySourceBootstrapErasureCompletionV1;
  } catch {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_CENSUS_CROSSED");
  }
  const { completionHash, ...body } = observed;
  if (
    Reflect.ownKeys(observed).length !== 6
    || observed.schema !== "setfarm.internal-production-recovery-source-bootstrap-erasure-completion.v1"
    || !SHA256_V1.test(observed.authorityHash)
    || !SHA256_V1.test(observed.journalHash)
    || !/^[0-9]+$/.test(observed.rootDev)
    || !/^[0-9]+$/.test(observed.rootIno)
    || completionHash !== sha256(canonicalJsonStringify(body))
    || canonicalJsonStringify({ ...body, completionHash }) !== canonicalJsonStringify(observed)
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_CENSUS_CROSSED");
}

function resolveErasureCompletion(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
  journal: RecoverySourceBootstrapErasureJournalV1,
  target: string,
  publish: boolean,
): InternalProductionRecoverySourceBootstrapErasureCompletionV1 | null {
  const body = Object.freeze({
    schema: "setfarm.internal-production-recovery-source-bootstrap-erasure-completion.v1" as const,
    authorityHash: authorityHash(input),
    journalHash: journal.journalHash,
    rootDev: journal.rootDev,
    rootIno: journal.rootIno,
  });
  const expected = Object.freeze({ ...body, completionHash: sha256(canonicalJsonStringify(body)) });
  if (publish) publishExactErasureRecord(target, canonicalJsonStringify(expected));
  if (!pathEntryExistsNoFollow(target)) return null;
  const observed = readErasureCompletion(input, target);
  if (canonicalJsonStringify(observed) !== canonicalJsonStringify(expected)) {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_COMPLETION_CROSSED");
  }
  return observed;
}

function pathEntryExistsNoFollow(candidate: string): boolean {
  try {
    lstatSync(candidate);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_STATE_INVALID");
  }
}

export function resolveInternalProductionRecoverySourceBootstrapRepositoryIdentityV1(
  input: Readonly<{ sourceRepositoryRoot: string; runId: string }>,
): InternalProductionRecoverySourceBootstrapRepositoryIdentityV1 {
  if (
    typeof input.sourceRepositoryRoot !== "string"
    || !path.isAbsolute(input.sourceRepositoryRoot)
    || !SHA256_V1.test(input.runId)
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_IDENTITY_INVALID");
  let sourceRepositoryRoot: string;
  try {
    sourceRepositoryRoot = realpathSync(input.sourceRepositoryRoot);
  } catch {
    fail("RECOVERY_SOURCE_BOOTSTRAP_SOURCE_REPOSITORY_UNAVAILABLE");
  }
  const sourceKey = sha256(sourceRepositoryRoot);
  const workspaceRoot = path.join(
    path.dirname(sourceRepositoryRoot),
    ".setfarm-internal-production",
    "recovery-source-bootstrap-workspaces",
    sourceKey,
    input.runId,
  );
  return Object.freeze({
    sourceRepositoryRoot,
    workspaceRoot,
    repositoryRoot: path.join(workspaceRoot, "repository"),
    branch: input.runId,
  });
}

function markerBody(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
  identity: InternalProductionRecoverySourceBootstrapRepositoryIdentityV1,
  originHash: string,
): Omit<RecoverySourceBootstrapRepositoryMarkerV1, "markerHash"> {
  return Object.freeze({
    schema: "setfarm.internal-production-recovery-source-bootstrap-repository.v1" as const,
    runId: input.runId,
    operationRef: input.operationRef,
    operationHash: input.operationHash,
    baseSourceSha: input.baseSourceSha,
    baseSourceTreeHash: input.baseSourceTreeHash,
    sourceRepositoryRoot: identity.sourceRepositoryRoot,
    repositoryRoot: identity.repositoryRoot,
    branch: identity.branch,
    originHash,
  });
}

function validateManagedDirectory(directory: string, message: string): void {
  let stats;
  try {
    stats = lstatSync(directory);
  } catch {
    fail(message);
  }
  if (!stats.isDirectory() || stats.isSymbolicLink() || realpathSync(directory) !== path.resolve(directory)) {
    fail(message);
  }
}

function validatePrivateErasureDirectory(directory: string): void {
  let stats: BigIntStats;
  try {
    stats = lstatSync(directory, { bigint: true });
  } catch {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED");
  }
  if (
    !stats.isDirectory()
    || stats.isSymbolicLink()
    || realpathSync(directory) !== path.resolve(directory)
    || (stats.mode & 0o777n) !== 0o700n
    || (typeof process.getuid === "function" && stats.uid !== BigInt(process.getuid()))
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_RECORD_CROSSED");
}

function validateRecoveryRepositoryExcludedArtifactsV1(repositoryRoot: string): void {
  const expectedUid = typeof process.getuid === "function" ? BigInt(process.getuid()) : null;
  const validateDirectory = (target: string): void => {
    const observed = lstatSync(target, { bigint: true });
    if (
      !observed.isDirectory()
      || observed.isSymbolicLink()
      || realpathSync(target) !== path.resolve(target)
      || (expectedUid !== null && observed.uid !== expectedUid)
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_EXCLUDED_ARTIFACT_CROSSED");
  };
  const qualityReports = path.join(repositoryRoot, "quality-reports");
  if (pathEntryExistsNoFollow(qualityReports)) validateDirectory(qualityReports);
  for (const relative of RECOVERY_SOURCE_BOOTSTRAP_EXACT_ARTIFACTS_V1) {
    const target = path.join(repositoryRoot, relative);
    if (!pathEntryExistsNoFollow(target)) continue;
    const observed = lstatSync(target, { bigint: true });
    if (
      !observed.isFile()
      || observed.isSymbolicLink()
      || observed.nlink !== 1n
      || realpathSync(target) !== path.resolve(target)
      || (expectedUid !== null && observed.uid !== expectedUid)
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_EXCLUDED_ARTIFACT_CROSSED");
  }

  const internalRoot = path.join(repositoryRoot, ".setfarm");
  if (!pathEntryExistsNoFollow(internalRoot)) return;
  let entryCount = 0;
  const visit = (directory: string, depth: number): void => {
    if (depth > 128) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_EXCLUDED_ARTIFACT_CROSSED");
    validateDirectory(directory);
    for (const name of readdirSync(directory)) {
      entryCount += 1;
      if (entryCount > 50_000) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_EXCLUDED_ARTIFACT_CROSSED");
      const target = path.join(directory, name);
      const observed = lstatSync(target, { bigint: true });
      if (observed.isDirectory() && !observed.isSymbolicLink()) {
        visit(target, depth + 1);
        continue;
      }
      if (
        !observed.isFile()
        || observed.isSymbolicLink()
        || observed.nlink !== 1n
        || realpathSync(target) !== path.resolve(target)
        || (expectedUid !== null && observed.uid !== expectedUid)
      ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_EXCLUDED_ARTIFACT_CROSSED");
    }
  };
  visit(internalRoot, 0);
}

function validateExistingRepository(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
  identity: InternalProductionRecoverySourceBootstrapRepositoryIdentityV1,
  originUrl: string,
  physicalWorkspaceRoot = identity.workspaceRoot,
): InternalProductionRecoverySourceBootstrapRepositoryIdentityV1 {
  const physicalRepositoryRoot = path.join(physicalWorkspaceRoot, "repository");
  validateManagedDirectory(physicalWorkspaceRoot, "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_WORKSPACE_CROSSED");
  validateManagedDirectory(physicalRepositoryRoot, "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_WORKSPACE_CROSSED");
  validateManagedDirectory(path.join(physicalRepositoryRoot, ".git"), "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_NOT_ISOLATED");
  validateRecoveryRepositoryExcludedArtifactsV1(physicalRepositoryRoot);
  const markerPath = path.join(physicalWorkspaceRoot, "authority.json");
  const excludePath = path.join(physicalRepositoryRoot, ".git", "info", "exclude");
  try {
    const excludeStats = lstatSync(excludePath, { bigint: true });
    if (
      !excludeStats.isFile()
      || excludeStats.isSymbolicLink()
      || excludeStats.nlink !== 1n
      || (excludeStats.mode & 0o777n) !== 0o600n
      || realpathSync(excludePath) !== path.resolve(excludePath)
      || (typeof process.getuid === "function" && excludeStats.uid !== BigInt(process.getuid()))
      || readFileSync(excludePath, "utf8") !== RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_EXCLUDE_V1
    ) throw new Error();
  } catch {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_EXCLUDE_CROSSED");
  }
  let marker: RecoverySourceBootstrapRepositoryMarkerV1;
  try {
    const stats = lstatSync(markerPath);
    if (!stats.isFile() || stats.isSymbolicLink() || (stats.mode & 0o777) !== 0o600) throw new Error();
    marker = JSON.parse(readFileSync(markerPath, "utf8")) as RecoverySourceBootstrapRepositoryMarkerV1;
  } catch {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_MARKER_INVALID");
  }
  const body = markerBody(input, identity, sha256(originUrl));
  if (
    Reflect.ownKeys(marker).length !== 11
    || canonicalJsonStringify({ ...body, markerHash: marker.markerHash }) !== canonicalJsonStringify(marker)
    || marker.markerHash !== sha256(canonicalJsonStringify(body))
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_MARKER_CROSSED");
  if (
    git(physicalRepositoryRoot, ["rev-parse", "--show-toplevel"]) !== physicalRepositoryRoot
    || git(physicalRepositoryRoot, ["branch", "--show-current"]) !== identity.branch
    || git(physicalRepositoryRoot, ["remote", "get-url", "origin"]) !== originUrl
    || git(physicalRepositoryRoot, ["rev-parse", `${input.baseSourceSha}^{tree}`]) !== input.baseSourceTreeHash
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_AUTHORITY_CROSSED");
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", input.baseSourceSha, "HEAD"], {
      cwd: physicalRepositoryRoot,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      stdio: "ignore",
    });
  } catch {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_BASE_CROSSED");
  }
  return identity;
}

function validateClaimedRepository(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
  identity: InternalProductionRecoverySourceBootstrapRepositoryIdentityV1,
  claimedWorkspaceRoot: string,
): void {
  const originUrl = normalizeSourceOriginUrl(
    identity.sourceRepositoryRoot,
    git(identity.sourceRepositoryRoot, ["remote", "get-url", "origin"]),
  );
  validateExistingRepository(input, identity, originUrl, claimedWorkspaceRoot);
}

export function validateInternalProductionRecoverySourceBootstrapRepositoryV1(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
): InternalProductionRecoverySourceBootstrapRepositoryIdentityV1 {
  exactInput(input);
  const identity = resolveInternalProductionRecoverySourceBootstrapRepositoryIdentityV1(input);
  const originUrl = normalizeSourceOriginUrl(
    identity.sourceRepositoryRoot,
    git(identity.sourceRepositoryRoot, ["remote", "get-url", "origin"]),
  );
  return validateExistingRepository(input, identity, originUrl);
}

export function syncInternalProductionRecoverySourceBootstrapRepositoryToOriginMainV1(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
): InternalProductionRecoverySourceBootstrapRepositoryIdentityV1 {
  exactInput(input);
  const identity = validateInternalProductionRecoverySourceBootstrapRepositoryV1(input);
  if (git(identity.repositoryRoot, ["status", "--porcelain=v1", "--untracked-files=all"]) !== "") {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_SYNC_WORKTREE_CROSSED");
  }
  git(identity.repositoryRoot, [
    "fetch",
    "origin",
    "refs/heads/main:refs/remotes/origin/main",
  ]);
  const remoteMain = git(identity.repositoryRoot, ["rev-parse", "refs/remotes/origin/main"]);
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", "HEAD", remoteMain], {
      cwd: identity.repositoryRoot,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      stdio: "ignore",
    });
  } catch {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_MAIN_DIVERGED");
  }
  git(identity.repositoryRoot, ["merge", "--ff-only", remoteMain]);
  git(identity.repositoryRoot, ["branch", "-f", "main", remoteMain]);
  return validateInternalProductionRecoverySourceBootstrapRepositoryV1(input);
}

export function validateClaimedInternalProductionRecoverySourceBootstrapRepositoryV1(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
): InternalProductionRecoverySourceBootstrapRepositoryIdentityV1 {
  exactInput(input);
  const identity = resolveInternalProductionRecoverySourceBootstrapRepositoryIdentityV1(input);
  const cleanupRoot = path.join(path.dirname(identity.workspaceRoot), `.cleanup-${input.runId}`);
  if (resolveInternalProductionRecoverySourceBootstrapRepositoryCleanupStateV1(input) !== "claimed") {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_CLAIM_INVALID");
  }
  const originUrl = normalizeSourceOriginUrl(
    identity.sourceRepositoryRoot,
    git(identity.sourceRepositoryRoot, ["remote", "get-url", "origin"]),
  );
  validateExistingRepository(input, identity, originUrl, cleanupRoot);
  return Object.freeze({
    ...identity,
    workspaceRoot: cleanupRoot,
    repositoryRoot: path.join(cleanupRoot, "repository"),
  });
}

export function validateInternalProductionRecoverySourceBootstrapSetupBaselineV1(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
): InternalProductionRecoverySourceBootstrapRepositoryIdentityV1 {
  const identity = validateInternalProductionRecoverySourceBootstrapRepositoryV1(input);
  if (
    git(identity.repositoryRoot, ["rev-parse", "HEAD"]) !== input.baseSourceSha
    || git(identity.repositoryRoot, ["rev-parse", "HEAD^{tree}"]) !== input.baseSourceTreeHash
    || git(identity.repositoryRoot, ["status", "--porcelain=v1", "--untracked-files=all"]) !== ""
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_SETUP_BASELINE_CROSSED");
  return identity;
}

export function resolveInternalProductionRecoverySourceBootstrapRepositoryCleanupStateV1(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
): InternalProductionRecoverySourceBootstrapRepositoryCleanupStateV1 {
  exactInput(input);
  const expectedIdentity = resolveInternalProductionRecoverySourceBootstrapRepositoryIdentityV1(input);
  const cleanupRoot = path.join(
    path.dirname(expectedIdentity.workspaceRoot),
    `.cleanup-${input.runId}`,
  );
  const journalPath = erasureJournalPath(expectedIdentity, input.runId);
  const completionPath = erasureCompletionPath(expectedIdentity, input.runId);
  const workspaceExists = pathEntryExistsNoFollow(expectedIdentity.workspaceRoot);
  const cleanupExists = pathEntryExistsNoFollow(cleanupRoot);
  const journalExists = pathEntryExistsNoFollow(journalPath);
  const completionExists = pathEntryExistsNoFollow(completionPath);
  if (
    (workspaceExists && (cleanupExists || journalExists || completionExists))
    || (cleanupExists && completionExists && !journalExists)
    || (journalExists && !cleanupExists && !completionExists)
  ) {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_CLAIM_CROSSED");
  }
  if (workspaceExists) return "workspace";
  if (journalExists) return "erasing";
  if (cleanupExists) return "claimed";
  if (completionExists) return "erased";
  return "absent";
}

export function listInternalProductionRecoverySourceBootstrapRepositoryCleanupCandidateRunIdsV1(
  input: Readonly<{ sourceRepositoryRoot: string }>,
): Readonly<{ runIds: readonly string[]; diagnostics: readonly string[] }> {
  const probe = resolveInternalProductionRecoverySourceBootstrapRepositoryIdentityV1({
    sourceRepositoryRoot: input.sourceRepositoryRoot,
    runId: "0".repeat(64),
  });
  const managedBase = path.dirname(probe.workspaceRoot);
  if (!pathEntryExistsNoFollow(managedBase)) {
    return Object.freeze({ runIds: Object.freeze([]), diagnostics: Object.freeze([]) });
  }
  validatePrivateErasureDirectory(managedBase);
  const names = readdirSync(managedBase).sort();
  const runIds = new Set<string>();
  const completionRunIds = new Set<string>();
  const diagnostics: string[] = [];
  let truncated = 0;
  const addRunId = (target: Set<string>, runId: string): void => {
    if (target.has(runId)) return;
    if (target.size >= 500) {
      truncated += 1;
      return;
    }
    target.add(runId);
  };
  const addDiagnostic = (diagnostic: string): void => {
    if (diagnostics.length >= 1_000) {
      truncated += 1;
      return;
    }
    diagnostics.push(diagnostic);
  };
  for (const name of names) {
    let match = /^([0-9a-f]{64})$/.exec(name)
      ?? /^\.cleanup-([0-9a-f]{64})$/.exec(name)
      ?? /^\.cleanup-([0-9a-f]{64})\.erasure\.json$/.exec(name)
      ?? /^\.cleanup-([0-9a-f]{64})\.erasure(?:-complete)?\.json\.tmp-[0-9]+-[0-9a-f-]{36}$/.exec(name);
    if (match !== null) {
      addRunId(runIds, match[1]!);
      continue;
    }
    match = /^\.cleanup-([0-9a-f]{64})\.erasure-complete\.json$/.exec(name);
    if (match !== null) {
      if (!completionRunIds.has(match[1]!) && completionRunIds.size >= 500) {
        truncated += 1;
        continue;
      }
      try {
        validateErasureCompletionCensusRecordV1(path.join(managedBase, name));
        addRunId(completionRunIds, match[1]!);
      } catch {
        addRunId(completionRunIds, match[1]!);
        addDiagnostic(`CENSUS_CROSSED:${name}`);
      }
      continue;
    }
    if (/^\.staging-[A-Za-z0-9._-]+$/.test(name)) {
      addDiagnostic(`UNBOUND_STAGING:${name}`);
      continue;
    }
    addDiagnostic(`CENSUS_CROSSED:${name}`);
  }
  const prioritized = [...completionRunIds, ...runIds]
    .filter((runId, index, values) => values.indexOf(runId) === index);
  truncated += completionRunIds.size + runIds.size - prioritized.length;
  if (truncated > 0) diagnostics.push(`CENSUS_TRUNCATED:${truncated}`);
  return Object.freeze({
    runIds: Object.freeze(prioritized),
    diagnostics: Object.freeze(diagnostics),
  });
}

function erasureAncestors(
  journal: RecoverySourceBootstrapErasureJournalV1,
  entry: RecoverySourceBootstrapErasureEntryV1,
): readonly Readonly<{ name: string; dev: string; ino: string }>[] {
  if (entry.parentLocator === ".") return Object.freeze([]);
  const byLocator = new Map(journal.entries.map((candidate) => [candidate.locator, candidate]));
  const ancestors: Array<Readonly<{ name: string; dev: string; ino: string }>> = [];
  let locator = entry.parentLocator;
  while (locator !== ".") {
    const ancestor = byLocator.get(locator);
    if (ancestor === undefined || ancestor.kind !== "directory") {
      fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_JOURNAL_INVALID");
    }
    ancestors.unshift(Object.freeze({ name: ancestor.name, dev: ancestor.dev, ino: ancestor.ino }));
    locator = ancestor.parentLocator;
  }
  return Object.freeze(ancestors);
}

const RECOVERY_REPOSITORY_ERASER_SANDBOX_EXECUTABLE_V1 = "/usr/bin/sandbox-exec" as const;

function recoveryRepositorySandboxStringV1(value: string): string {
  if (/\x00|\n|\r/.test(value)) {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASER_SANDBOX_PATH_INVALID");
  }
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function requireRecoveryRepositoryEraserSandboxV1(): string {
  if (process.platform !== "darwin") {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASER_HOST_UNSUPPORTED");
  }
  const executable = RECOVERY_REPOSITORY_ERASER_SANDBOX_EXECUTABLE_V1;
  let observed: BigIntStats;
  try {
    observed = lstatSync(executable, { bigint: true });
  } catch {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASER_HOST_UNSUPPORTED");
  }
  if (
    !observed.isFile()
    || observed.isSymbolicLink()
    || observed.uid !== 0n
    || observed.gid !== 0n
    || observed.nlink !== 1n
    || (observed.mode & 0o777n) !== 0o755n
    || realpathSync(executable) !== executable
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASER_HOST_UNSUPPORTED");
  return executable;
}

function recoveryRepositoryArtifactSandboxProfileV1(
  repositoryRoot: string,
  artifactParent: string,
  targetPath: string,
  tempPath: string,
  nodeExecutable: string,
): string {
  return [
    "(version 1)",
    "(allow default)",
    "(deny file-write*)",
    `(allow file-write* (literal ${recoveryRepositorySandboxStringV1(artifactParent)}) (literal ${recoveryRepositorySandboxStringV1(targetPath)}) (literal ${recoveryRepositorySandboxStringV1(tempPath)}))`,
    `(allow file-write-data (literal ${recoveryRepositorySandboxStringV1(repositoryRoot)}) (literal ${recoveryRepositorySandboxStringV1(artifactParent)}))`,
    "(deny network-outbound)",
    "(deny network-inbound)",
    "(deny process-exec)",
    `(allow process-exec (literal ${recoveryRepositorySandboxStringV1(nodeExecutable)}))`,
    "",
  ].join("\n");
}

export function publishAuthenticatedInternalProductionRecoverySourceBootstrapArtifactV1(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
  artifact: Readonly<{
    relativePath: InternalProductionRecoverySourceBootstrapArtifactPathV1;
    bytes: Buffer;
  }>,
): InternalProductionRecoverySourceBootstrapRepositoryIdentityV1 {
  exactInput(input);
  if (
    Reflect.ownKeys(artifact).length !== 2
    || !(RECOVERY_SOURCE_BOOTSTRAP_EXACT_ARTIFACTS_V1 as readonly string[]).includes(artifact.relativePath)
    || !RECOVERY_SOURCE_BOOTSTRAP_ARTIFACT_TARGETS_V1.includes(artifact.relativePath)
    || !Buffer.isBuffer(artifact.bytes)
    || artifact.bytes.length < 1
    || artifact.bytes.length > 32 * 1024 * 1024
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ARTIFACT_INPUT_INVALID");
  const identity = validateInternalProductionRecoverySourceBootstrapRepositoryV1(input);
  const root = lstatSync(identity.repositoryRoot, { bigint: true });
  if (
    !root.isDirectory()
    || root.isSymbolicLink()
    || realpathSync(identity.repositoryRoot) !== identity.repositoryRoot
    || (typeof process.getuid === "function" && root.uid !== BigInt(process.getuid()))
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ARTIFACT_CROSSED");

  const parentLocator = path.posix.dirname(artifact.relativePath);
  const parentName = parentLocator === "." ? "" : parentLocator;
  if (!["", ".setfarm", "quality-reports"].includes(parentName)) {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ARTIFACT_INPUT_INVALID");
  }
  const targetName = path.posix.basename(artifact.relativePath);
  const tempName = path.posix.basename(recoveryArtifactTempPathV1(artifact.relativePath));
  const artifactParent = parentName === ""
    ? identity.repositoryRoot
    : path.join(identity.repositoryRoot, parentName);
  const targetPath = path.join(artifactParent, targetName);
  const tempPath = path.join(artifactParent, tempName);
  const expectedParent: {
    name: string;
    dev: string | null;
    ino: string | null;
    uid: string | null;
  } = { name: parentName, dev: null, ino: null, uid: null };
  if (parentName === "") {
    expectedParent.dev = String(root.dev);
    expectedParent.ino = String(root.ino);
    expectedParent.uid = String(root.uid);
  } else if (pathEntryExistsNoFollow(artifactParent)) {
    const parent = lstatSync(artifactParent, { bigint: true });
    if (
      !parent.isDirectory()
      || parent.isSymbolicLink()
      || realpathSync(artifactParent) !== path.resolve(artifactParent)
      || parent.dev !== root.dev
      || (typeof process.getuid === "function" && parent.uid !== BigInt(process.getuid()))
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ARTIFACT_CROSSED");
    expectedParent.dev = String(parent.dev);
    expectedParent.ino = String(parent.ino);
    expectedParent.uid = String(parent.uid);
  }

  const nodeExecutable = realpathSync(process.execPath);
  const sandboxExecutable = requireRecoveryRepositoryEraserSandboxV1();
  const sandboxProfile = recoveryRepositoryArtifactSandboxProfileV1(
    identity.repositoryRoot,
    artifactParent,
    targetPath,
    tempPath,
    nodeExecutable,
  );
  const publication = spawnSync(sandboxExecutable, [
    "-p",
    sandboxProfile,
    nodeExecutable,
    "--input-type=module",
    "--eval",
    AUTHENTICATED_RECOVERY_REPOSITORY_ARTIFACT_PUBLISHER_V1,
  ], {
    cwd: identity.repositoryRoot,
    input: canonicalJsonStringify({
      bytes: artifact.bytes.toString("base64"),
      expectedParent,
      relativePath: artifact.relativePath,
      rootDev: String(root.dev),
      rootIno: String(root.ino),
      rootUid: String(root.uid),
      targetName,
      tempName,
    }),
    encoding: "utf8",
    shell: false,
    timeout: 30_000,
    maxBuffer: 64 * 1024,
  });
  if (publication.error !== undefined || publication.signal !== null || publication.status !== 0) {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ARTIFACT_CROSSED");
  }
  let receipt: Readonly<Record<string, unknown>>;
  try { receipt = JSON.parse(publication.stdout) as Readonly<Record<string, unknown>>; }
  catch { fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ARTIFACT_RECEIPT_INVALID"); }
  const expectedArtifactHash = createHash("sha256").update(artifact.bytes).digest("hex");
  if (
    Reflect.ownKeys(receipt).length !== 3
    || receipt.schema !== "setfarm.internal-production-recovery-source-bootstrap-artifact-publication.v1"
    || receipt.relativePath !== artifact.relativePath
    || receipt.artifactHash !== expectedArtifactHash
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ARTIFACT_RECEIPT_INVALID");

  validateInternalProductionRecoverySourceBootstrapRepositoryV1(input);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(targetPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = fstatSync(descriptor, { bigint: true });
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    const named = lstatSync(targetPath, { bigint: true });
    if (
      !before.isFile()
      || before.isSymbolicLink()
      || before.nlink !== 1n
      || (before.mode & 0o777n) !== 0o600n
      || before.size !== BigInt(artifact.bytes.length)
      || named.dev !== before.dev
      || named.ino !== before.ino
      || after.dev !== before.dev
      || after.ino !== before.ino
      || after.mtimeNs !== before.mtimeNs
      || after.ctimeNs !== before.ctimeNs
      || !bytes.equals(artifact.bytes)
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ARTIFACT_CROSSED");
  } catch {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ARTIFACT_CROSSED");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return identity;
}

function recoveryRepositoryEraserSandboxProfileV1(
  cleanupRoot: string,
  cleanupParent: string,
  nodeExecutable: string,
): string {
  return [
    "(version 1)",
    "(allow default)",
    "(deny file-write*)",
    `(allow file-write* (literal ${recoveryRepositorySandboxStringV1(cleanupRoot)}) (subpath ${recoveryRepositorySandboxStringV1(cleanupRoot)}))`,
    `(allow file-write-data (literal ${recoveryRepositorySandboxStringV1(cleanupParent)}))`,
    "(deny network-outbound)",
    "(deny network-inbound)",
    "(deny process-exec)",
    `(allow process-exec (literal ${recoveryRepositorySandboxStringV1(nodeExecutable)}))`,
    "",
  ].join("\n");
}

function eraseAuthenticatedDirent(
  root: string,
  input: Readonly<{
    rootDev: string;
    rootIno: string;
    ancestors: readonly Readonly<{ name: string; dev: string; ino: string }>[];
    name: string;
    kind: "directory" | "file" | "symlink";
    dev: string;
    ino: string;
    mode: string;
    nlink: string;
  }>,
): void {
  const cleanupRoot = input.ancestors.length > 0
    ? path.join(root, input.ancestors[0]!.name)
    : path.join(root, input.name);
  const nodeExecutable = realpathSync(process.execPath);
  const sandboxExecutable = requireRecoveryRepositoryEraserSandboxV1();
  const sandboxProfile = recoveryRepositoryEraserSandboxProfileV1(cleanupRoot, root, nodeExecutable);
  const erased = spawnSync(sandboxExecutable, [
    "-p",
    sandboxProfile,
    nodeExecutable,
    "--input-type=module",
    "--eval",
    AUTHENTICATED_RECOVERY_REPOSITORY_DIRENT_ERASER_V1,
  ], {
    cwd: root,
    input: canonicalJsonStringify(input),
    encoding: "utf8",
    shell: false,
    timeout: 10_000,
    maxBuffer: 64 * 1024,
  });
  if (erased.error !== undefined || erased.signal !== null || erased.status !== 0) {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_STEP_FAILED");
  }
  let receipt: Readonly<Record<string, unknown>>;
  try { receipt = JSON.parse(erased.stdout) as Readonly<Record<string, unknown>>; }
  catch { fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_STEP_RECEIPT_INVALID"); }
  if (
    Reflect.ownKeys(receipt).length !== 3
    || receipt.schema !== "setfarm.internal-production-recovery-source-bootstrap-dirent-erasure.v1"
    || receipt.dev !== input.dev
    || receipt.ino !== input.ino
  ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_STEP_RECEIPT_INVALID");
}

function unlinkAuthenticatedErasureRecordV1(
  target: string,
  expectedBytes: Buffer,
  allowedLinks: ReadonlySet<bigint>,
  message: string,
): void {
  const directory = path.dirname(target);
  validatePrivateErasureDirectory(directory);
  const parent = lstatSync(directory, { bigint: true });
  let descriptor: number | undefined;
  let observed: BigIntStats | undefined;
  try {
    descriptor = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = fstatSync(descriptor, { bigint: true });
    const named = lstatSync(target, { bigint: true });
    if (
      !before.isFile()
      || before.isSymbolicLink()
      || !named.isFile()
      || named.isSymbolicLink()
      || before.dev !== named.dev
      || before.ino !== named.ino
      || before.mode !== named.mode
      || before.nlink !== named.nlink
      || !allowedLinks.has(before.nlink)
      || (before.mode & 0o777n) !== 0o600n
      || before.size !== BigInt(expectedBytes.length)
      || (typeof process.getuid === "function" && before.uid !== BigInt(process.getuid()))
    ) throw new Error();
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (
      !bytes.equals(expectedBytes)
      || after.dev !== before.dev
      || after.ino !== before.ino
      || after.mode !== before.mode
      || after.nlink !== before.nlink
      || after.size !== before.size
      || after.mtimeNs !== before.mtimeNs
      || after.ctimeNs !== before.ctimeNs
    ) throw new Error();
    observed = before;
  } catch {
    fail(message);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  if (observed === undefined) fail(message);
  const parentAfter = lstatSync(directory, { bigint: true });
  if (
    !parent.isDirectory()
    || parent.isSymbolicLink()
    || parentAfter.dev !== parent.dev
    || parentAfter.ino !== parent.ino
    || realpathSync(directory) !== path.resolve(directory)
  ) fail(message);
  eraseAuthenticatedDirent(directory, {
    rootDev: String(parent.dev),
    rootIno: String(parent.ino),
    ancestors: Object.freeze([]),
    name: path.basename(target),
    kind: "file",
    dev: String(observed.dev),
    ino: String(observed.ino),
    mode: String(observed.mode),
    nlink: String(observed.nlink),
  });
}

export function releaseAuthenticatedInternalProductionRecoverySourceBootstrapErasureCompletionV1(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
): void {
  exactInput(input);
  const identity = resolveInternalProductionRecoverySourceBootstrapRepositoryIdentityV1(input);
  const completionPath = erasureCompletionPath(identity, input.runId);
  if (!pathEntryExistsNoFollow(completionPath)) {
    const directory = path.dirname(completionPath);
    validatePrivateErasureDirectory(directory);
    fsyncErasureDirectory(directory);
    if (pathEntryExistsNoFollow(completionPath)) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_COMPLETION_CROSSED");
    }
    return;
  }
  const completion = readErasureCompletion(input, completionPath);
  unlinkAuthenticatedErasureRecordV1(
    completionPath,
    Buffer.from(canonicalJsonStringify(completion), "utf8"),
    new Set([1n]),
    "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_COMPLETION_CROSSED",
  );
}

export function removeAuthenticatedInternalProductionRecoverySourceBootstrapRepositoryV1(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
): void {
  exactInput(input);
  const expectedIdentity = resolveInternalProductionRecoverySourceBootstrapRepositoryIdentityV1(input);
  const cleanupRoot = path.join(
    path.dirname(expectedIdentity.workspaceRoot),
    `.cleanup-${input.runId}`,
  );
  const journalPath = erasureJournalPath(expectedIdentity, input.runId);
  const completionPath = erasureCompletionPath(expectedIdentity, input.runId);
  const cleanupState = resolveInternalProductionRecoverySourceBootstrapRepositoryCleanupStateV1(input);
  if (cleanupState === "absent") {
    fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_EVIDENCE_MISSING");
  }
  if (cleanupState === "erased") {
    readErasureCompletion(input, completionPath);
    return;
  }
  if (cleanupState === "workspace") {
    try {
      renameSync(expectedIdentity.workspaceRoot, cleanupRoot);
    } catch {
      fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_CLAIM_FAILED");
    }
  }

  let journal: RecoverySourceBootstrapErasureJournalV1;
  if (cleanupState === "workspace" || cleanupState === "claimed") {
    validateClaimedRepository(input, expectedIdentity, cleanupRoot);
    const claimed = lstatSync(cleanupRoot, { bigint: true });
    const first = inventoryErasureEntries(cleanupRoot, claimed);
    const second = inventoryErasureEntries(cleanupRoot, claimed);
    if (canonicalJsonStringify(first) !== canonicalJsonStringify(second)) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_INVENTORY_CROSSED");
    }
    journal = publishErasureJournal(input, journalPath, claimed, first);
  } else {
    journal = readErasureJournal(input, journalPath);
  }

  const completion = resolveErasureCompletion(input, journal, completionPath, false);
  if (completion === null) {
    const root = lstatSync(cleanupRoot, { bigint: true });
    if (!root.isDirectory() || String(root.dev) !== journal.rootDev || String(root.ino) !== journal.rootIno) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_ROOT_CROSSED");
    }
    let firstMissing = journal.entries.length;
    for (let index = 0; index < journal.entries.length; index += 1) {
      const entry = journal.entries[index]!;
      let observed;
      try {
        observed = lstatSync(path.join(cleanupRoot, entry.locator), { bigint: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        firstMissing = Math.min(firstMissing, index);
        continue;
      }
      if (firstMissing !== journal.entries.length) {
        fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_PREFIX_CROSSED");
      }
      if (
        erasureEntryKind(observed) !== entry.kind
        || String(observed.dev) !== entry.dev
        || String(observed.ino) !== entry.ino
        || String(observed.mode) !== entry.mode
        || (entry.kind !== "directory" && String(observed.nlink) !== entry.nlink)
      ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_ENTRY_CROSSED");
    }
    const nextIndex = firstMissing === journal.entries.length
      ? journal.entries.length - 1
      : firstMissing - 1;
    const cleanupParent = lstatSync(path.dirname(cleanupRoot), { bigint: true });
    if (!cleanupParent.isDirectory() || cleanupParent.isSymbolicLink()) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_ROOT_CROSSED");
    }
    const cleanupRootAncestor = Object.freeze({
      name: path.basename(cleanupRoot),
      dev: journal.rootDev,
      ino: journal.rootIno,
    });
    for (let index = nextIndex; index >= 0; index -= 1) {
      const entry = journal.entries[index]!;
      eraseAuthenticatedDirent(path.dirname(cleanupRoot), {
        rootDev: String(cleanupParent.dev),
        rootIno: String(cleanupParent.ino),
        ancestors: Object.freeze([cleanupRootAncestor, ...erasureAncestors(journal, entry)]),
        name: entry.name,
        kind: entry.kind,
        dev: entry.dev,
        ino: entry.ino,
        mode: entry.mode,
        nlink: entry.nlink,
      });
    }
    if (readdirSync(cleanupRoot).length !== 0) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_NOT_EMPTY");
    }
    resolveErasureCompletion(input, journal, completionPath, true);
  }

  if (pathEntryExistsNoFollow(cleanupRoot)) {
    const named = lstatSync(cleanupRoot, { bigint: true });
    if (
      named.dev !== BigInt(journal.rootDev)
      || named.ino !== BigInt(journal.rootIno)
      || !named.isDirectory()
      || readdirSync(cleanupRoot).length !== 0
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_CROSSED");
    const parent = lstatSync(path.dirname(cleanupRoot), { bigint: true });
    if (!parent.isDirectory() || parent.isSymbolicLink()) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_CROSSED");
    }
    eraseAuthenticatedDirent(path.dirname(cleanupRoot), {
      rootDev: String(parent.dev),
      rootIno: String(parent.ino),
      ancestors: Object.freeze([]),
      name: path.basename(cleanupRoot),
      kind: "directory",
      dev: String(named.dev),
      ino: String(named.ino),
      mode: String(named.mode),
      nlink: String(named.nlink),
    });
  }
  unlinkAuthenticatedErasureRecordV1(
    journalPath,
    Buffer.from(canonicalJsonStringify(journal), "utf8"),
    new Set([1n]),
    "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_ERASURE_JOURNAL_INVALID",
  );
}

export function prepareInternalProductionRecoverySourceBootstrapRepositoryV1(
  input: PrepareRecoverySourceBootstrapRepositoryInputV1,
): InternalProductionRecoverySourceBootstrapRepositoryIdentityV1 {
  exactInput(input);
  const identity = resolveInternalProductionRecoverySourceBootstrapRepositoryIdentityV1(input);
  if (git(identity.sourceRepositoryRoot, ["rev-parse", `${input.baseSourceSha}^{tree}`]) !== input.baseSourceTreeHash) {
    fail("RECOVERY_SOURCE_BOOTSTRAP_SOURCE_AUTHORITY_CROSSED");
  }
  const originUrl = normalizeSourceOriginUrl(
    identity.sourceRepositoryRoot,
    git(identity.sourceRepositoryRoot, ["remote", "get-url", "origin"]),
  );
  if (existsSync(identity.workspaceRoot)) return validateExistingRepository(input, identity, originUrl);

  const managedBase = path.dirname(identity.workspaceRoot);
  mkdirSync(managedBase, { recursive: true, mode: 0o700 });
  validateManagedDirectory(managedBase, "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_BASE_INVALID");
  const stagingRoot = mkdtempSync(path.join(managedBase, ".staging-"));
  const stagingRepository = path.join(stagingRoot, "repository");
  let publicationStarted = false;
  try {
    execFileSync("git", ["clone", "--no-hardlinks", "--no-checkout", identity.sourceRepositoryRoot, stagingRepository], {
      cwd: managedBase,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      stdio: "ignore",
      timeout: 60_000,
    });
    git(stagingRepository, ["remote", "set-url", "origin", originUrl]);
    git(stagingRepository, ["checkout", "--detach", input.baseSourceSha]);
    git(stagingRepository, ["branch", "-f", "main", input.baseSourceSha]);
    git(stagingRepository, ["checkout", "-B", identity.branch, input.baseSourceSha]);
    writeFileSync(
      path.join(stagingRepository, ".git", "info", "exclude"),
      RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_EXCLUDE_V1,
      { mode: 0o600 },
    );
    chmodSync(path.join(stagingRepository, ".git", "info", "exclude"), 0o600);
    if (
      git(stagingRepository, ["rev-parse", "HEAD"]) !== input.baseSourceSha
      || git(stagingRepository, ["rev-parse", "HEAD^{tree}"]) !== input.baseSourceTreeHash
      || git(stagingRepository, ["status", "--porcelain=v1", "--untracked-files=all"]) !== ""
    ) fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_INITIALIZATION_CROSSED");
    const body = markerBody(input, identity, sha256(originUrl));
    writeFileSync(path.join(stagingRoot, "authority.json"), canonicalJsonStringify({
      ...body,
      markerHash: sha256(canonicalJsonStringify(body)),
    }), { encoding: "utf8", mode: 0o600, flag: "wx" });
    try {
      mkdirSync(identity.workspaceRoot, { mode: 0o700 });
    } catch {
      fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLAIM_CROSSED");
    }
    publicationStarted = true;
    validateManagedDirectory(identity.workspaceRoot, "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLAIM_CROSSED");
    renameSync(stagingRepository, identity.repositoryRoot);
    renameSync(path.join(stagingRoot, "authority.json"), path.join(identity.workspaceRoot, "authority.json"));
    rmdirSync(stagingRoot);
  } catch (error) {
    if (publicationStarted) {
      fail("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_PUBLICATION_INCOMPLETE");
    }
    throw error;
  } finally {
    if (!publicationStarted && existsSync(stagingRoot)) {
      rmSync(stagingRoot, { recursive: true, force: true });
    }
  }
  return validateExistingRepository(input, identity, originUrl);
}
