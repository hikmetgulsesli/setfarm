import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeSync,
  type Stats,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isProxy } from "node:util/types";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import {
  EXACT_PLATFORM_RELEASE_SOURCE_REF_V2_SCHEMA,
  PLATFORM_RELEASE_EMPTY_GIT_STATUS_CONTENT_HASH_V2,
  PLATFORM_RELEASE_SOURCE_ADMISSION_CONTRACT_HASH_V2,
  PLATFORM_RELEASE_SOURCE_GIT_COMMAND_CONTRACT_HASH_V2,
  PLATFORM_RELEASE_SOURCE_HTTPS_ORIGIN_V2,
  PLATFORM_RELEASE_SOURCE_MAX_DIRECTORIES_V2,
  PLATFORM_RELEASE_SOURCE_MAX_FILES_V2,
  PLATFORM_RELEASE_SOURCE_MAX_TOTAL_BYTES_V2,
  PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
  PLATFORM_RELEASE_SOURCE_SSH_ORIGIN_V2,
  PLATFORM_RELEASE_SOURCE_STAGE_PHYSICAL_IDENTITY_V2_SCHEMA,
  PLATFORM_RELEASE_SOURCE_TREE_BINDING_V2_SCHEMA,
  SOURCE_ADMISSION_RECEIPT_V2_SCHEMA,
  PlatformReleaseSourceTreeBindingV2Schema,
  SourceAdmissionReceiptV2Schema,
  hashExactPlatformReleaseSourceRefV2,
  hashPlatformReleaseSourceStagePhysicalIdentityV2,
  hashPlatformReleaseSourceTreeBindingV2,
  hashSourceAdmissionReceiptV2,
  type PlatformReleaseSourceStagePhysicalIdentityV2,
  type PlatformReleaseSourceTreeBindingV2,
  type SourceAdmissionReceiptV2,
} from "./schemas/platform-release-build-v2.js";
import {
  ExactHostOwnedFileRefV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  type ExactHostOwnedFileRefV2,
} from "./schemas/platform-release-common-v2.js";

const FULL_GIT_OBJECT_HASH_V2 = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const PORTABLE_SOURCE_PATH_V2 =
  /^(?:[A-Za-z0-9._@+-]+)(?:\/[A-Za-z0-9._@+-]+)*$/;
const SOURCE_FILE_MAX_BYTES_V2 = 64 * 1024 * 1024;
const GIT_LISTING_MAX_BYTES_V2 = 64 * 1024 * 1024;
const GIT_DIAGNOSTIC_MAX_BYTES_V2 = 16 * 1024;
const GIT_COMMAND_TIMEOUT_MS_V2 = 60_000;
const SOURCE_STAGE_PREFIX_V2 =
  "setfarm-platform-release-source-v2-";
const SOURCE_ADMISSION_INPUT_MAX_BYTES_V2 = 256 * 1024;

export type PlatformReleaseSourceAdmissionErrorCodeV2 =
  | "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID"
  | "PLATFORM_RELEASE_SOURCE_V2_REPOSITORY_INVALID"
  | "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID"
  | "PLATFORM_RELEASE_SOURCE_V2_GIT_COMMAND_FAILED"
  | "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID"
  | "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID"
  | "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID"
  | "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID"
  | "PLATFORM_RELEASE_SOURCE_V2_SOURCE_DRIFT"
  | "PLATFORM_RELEASE_SOURCE_V2_HANDLE_UNAUTHENTICATED"
  | "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED"
  | "PLATFORM_RELEASE_SOURCE_V2_TEST_ONLY";

export class PlatformReleaseSourceAdmissionErrorV2 extends Error {
  readonly code: PlatformReleaseSourceAdmissionErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: PlatformReleaseSourceAdmissionErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PlatformReleaseSourceAdmissionErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type GitOriginTransportV2 =
  | "github_https"
  | "github_ssh"
  | "test_fixture_local";

type RemoteObservationV2 = Readonly<{
  repositoryId:
    | typeof PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2
    | "test_fixture";
  originTransport: GitOriginTransportV2;
  originUrlHash: string;
  remoteRef: "refs/remotes/origin/main";
  observedSha: string;
  observedTreeHash: string;
  observationHash: string;
}>;

type GitSourceFenceV2 = Readonly<{
  headSha: string;
  treeHash: string;
  indexTreeHash: string;
  identityHash: string;
}>;

type CleanWorktreeProofV2 = Readonly<{
  dirty: false;
  untrackedEntryCount: 0;
  statusPorcelainContentHash:
    typeof PLATFORM_RELEASE_EMPTY_GIT_STATUS_CONTENT_HASH_V2;
  headSha: string;
  treeHash: string;
  indexTreeHash: string;
  proofHash: string;
}>;

type CapturedGitFenceV2 = Readonly<{
  branch: "main";
  originUrl: string;
  remote: RemoteObservationV2;
  source: GitSourceFenceV2;
  clean: CleanWorktreeProofV2;
}>;

type GitTreeFileV2 = Readonly<{
  locator: string;
  gitMode: "100644" | "100755";
  blobHash: string;
}>;

type CapturedGitObjectV2 = Readonly<{
  objectHash: string;
  objectType: "blob" | "commit";
  bytes: Buffer;
}>;

type SourceFingerprintEntryV2 =
  | Readonly<{
    path: string;
    type: "directory";
    mode: "0555";
  }>
  | Readonly<{
    path: string;
    type: "file";
    mode: "0444" | "0555";
    byteLength: number;
    contentHash: string;
  }>;

type SourceFingerprintV2 = Readonly<{
  entries: readonly SourceFingerprintEntryV2[];
  fileCount: number;
  directoryCount: number;
  totalBytes: number;
  fingerprintHash: string;
}>;

type SourceExportCoreV2 = Readonly<{
  admittedSource: Readonly<{
    sha: string;
    treeHash: string;
    commitEpochSeconds: string;
  }>;
  remoteBefore: RemoteObservationV2;
  remoteAfter: RemoteObservationV2;
  sourceBefore: GitSourceFenceV2;
  sourceAfter: GitSourceFenceV2;
  cleanWorktreeBefore: CleanWorktreeProofV2;
  cleanWorktreeAfter: CleanWorktreeProofV2;
  source: PlatformReleaseSourceTreeBindingV2;
  stageBefore: PlatformReleaseSourceStagePhysicalIdentityV2;
  stageAfter: PlatformReleaseSourceStagePhysicalIdentityV2;
  gitExecutableHash: string;
  gitExecutableByteLength: number;
}>;

export type PlatformReleaseSourceAdmissionTestEvidenceV2 = Readonly<{
  schema: "setfarm.platform-release-source-admission-test-evidence.v2";
  authorityState: "test_fixture_source_admission_only";
  productionUse: "forbidden";
  repositoryId: "test_fixture";
  admittedSource: SourceExportCoreV2["admittedSource"];
  remoteBefore: RemoteObservationV2;
  remoteAfter: RemoteObservationV2;
  sourceBefore: GitSourceFenceV2;
  sourceAfter: GitSourceFenceV2;
  cleanWorktreeBefore: CleanWorktreeProofV2;
  cleanWorktreeAfter: CleanWorktreeProofV2;
  exportedSource: Readonly<{
    method: "verified_git_tree_export.v2";
    buildContextPolicy:
      "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2";
    source: PlatformReleaseSourceTreeBindingV2;
    initialStageWasEmpty: true;
    stageBefore: PlatformReleaseSourceStagePhysicalIdentityV2;
    stageAfter: PlatformReleaseSourceStagePhysicalIdentityV2;
    temporaryLocatorDisclosure: "forbidden";
  }>;
  gitExecutable: Readonly<{
    hash: string;
    byteLength: number;
    authority: "test_fixture_process_tool";
  }>;
}>;

export type PlatformReleaseSourceAdmissionCandidateSnapshotV2 =
  | Readonly<{
    admissionScope: "production_candidate";
    receipt: SourceAdmissionReceiptV2;
    testEvidence: null;
  }>
  | Readonly<{
    admissionScope: "test_fixture";
    receipt: null;
    testEvidence: PlatformReleaseSourceAdmissionTestEvidenceV2;
  }>;

type SourceStageStateV2 = {
  readonly admissionScope: "production_candidate" | "test_fixture";
  readonly contextRoot: string;
  readonly stageRoot: string;
  readonly core: SourceExportCoreV2;
  readonly receipt: SourceAdmissionReceiptV2 | null;
  readonly testEvidence: PlatformReleaseSourceAdmissionTestEvidenceV2 | null;
  disposed: boolean;
};

export type AdmitPlatformReleaseSourceV2Input = Readonly<{
  repositoryRoot: string;
  implementation: unknown;
  gitTool: unknown;
}>;

export type AdmitPlatformReleaseSourceV2ForTestInput = Readonly<{
  repositoryRoot: string;
  gitExecutable?: string;
  afterInitialFenceForTest?: () => void;
  afterFirstStageCaptureForTest?: (stageRoot: string) => void;
}>;

const sourceStageConstructorCapabilityV2 = Object.freeze({});
const sourceStageStatesV2 = new WeakMap<object, SourceStageStateV2>();

export class AdmittedPlatformReleaseSourceStageV2 {
  readonly authorityState =
    "candidate_source_stage_unverified" as const;
  readonly sourceBindingHash: string;
  readonly admittedSha: string;

  constructor(
    capability: object,
    state: SourceStageStateV2,
  ) {
    if (capability !== sourceStageConstructorCapabilityV2) {
      throw new PlatformReleaseSourceAdmissionErrorV2(
        "PLATFORM_RELEASE_SOURCE_V2_HANDLE_UNAUTHENTICATED",
        "Source stage constructor capability is unavailable",
      );
    }
    this.sourceBindingHash = state.core.source.bindingHash;
    this.admittedSha = state.core.admittedSource.sha;
    sourceStageStatesV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: PlatformReleaseSourceAdmissionErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseSourceAdmissionErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactPlainObject(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
    || isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
      `${label} must be one exact plain data object`,
    );
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string"
      || !descriptor
      || !("value" in descriptor)
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
        `${label} must contain only exact data properties`,
      );
    }
  }
  return value as Record<string, unknown>;
}

function normalizedAbsolute(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && Buffer.byteLength(value, "utf8") <= 4_096
    && path.isAbsolute(value)
    && path.normalize(value) === value
    && value !== path.parse(value).root;
}

function anchorRealDirectory(value: unknown): string {
  if (!normalizedAbsolute(value)) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_REPOSITORY_INVALID",
      "Repository root must be one normalized absolute directory",
    );
  }
  try {
    const stat = lstatSync(value);
    const real = realpathSync(value);
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || real !== value
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_REPOSITORY_INVALID",
        "Repository root must be one real directory",
      );
    }
    return real;
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_REPOSITORY_INVALID",
      "Repository root cannot be anchored",
      error,
    );
  }
}

function sameStat(left: Stats, right: Stats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.uid === right.uid
    && left.gid === right.gid
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

function closeQuietly(descriptor: number | undefined): void {
  if (descriptor === undefined) return;
  try {
    closeSync(descriptor);
  } catch {
    // Preserve the primary typed failure.
  }
}

function hashStableFile(
  absolutePath: string,
  maxBytes: number,
  code:
    | "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID"
    | "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
  linkPolicy: "single" | "any_positive" = "single",
): Readonly<{
  hash: string;
  byteLength: number;
  stat: Stats;
}> {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (
      !before.isFile()
      || (
        linkPolicy === "single"
          ? before.nlink !== 1
          : before.nlink < 1
      )
      || before.size < 1
      || before.size > maxBytes
    ) {
      return fail(
        code,
        "Exact file is outside its bounded single-link contract",
      );
    }
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let total = 0;
    while (true) {
      const count = readSync(
        descriptor,
        buffer,
        0,
        buffer.byteLength,
        null,
      );
      if (count === 0) break;
      total += count;
      if (total > maxBytes) {
        return fail(code, "Exact file exceeded its byte limit");
      }
      hash.update(buffer.subarray(0, count));
    }
    const after = fstatSync(descriptor);
    if (total !== before.size || !sameStat(before, after)) {
      return fail(code, "Exact file changed during descriptor read");
    }
    return Object.freeze({
      hash: hash.digest("hex"),
      byteLength: total,
      stat: before,
    });
  } catch (error) {
    if (error instanceof PlatformReleaseSourceAdmissionErrorV2) throw error;
    return fail(code, "Exact no-follow file read failed", error);
  } finally {
    closeQuietly(descriptor);
  }
}

function anchorGitExecutableForTest(value: unknown): Readonly<{
  absolutePath: string;
  hash: string;
  byteLength: number;
}> {
  if (!normalizedAbsolute(value)) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
      "Test Git executable must be one normalized absolute path",
    );
  }
  let real: string;
  try {
    real = realpathSync(value);
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
      "Test Git executable cannot be resolved",
      error,
    );
  }
  if (real !== value) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
      "Test Git executable path must already be real",
    );
  }
  const observed = hashStableFile(
    real,
    1024 * 1024 * 1024,
    "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID",
    "any_positive",
  );
  if ((observed.stat.mode & 0o111) === 0) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
      "Test Git executable is not executable",
    );
  }
  return Object.freeze({
    absolutePath: real,
    hash: observed.hash,
    byteLength: observed.byteLength,
  });
}

function sealedGitEnvironment(): NodeJS.ProcessEnv {
  return {
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
    HOME: "/var/empty",
    LANG: "C",
    LC_ALL: "C",
    PATH: "/usr/bin:/bin",
    TZ: "UTC",
  };
}

function runGit(
  executable: string,
  repositoryRoot: string,
  args: readonly string[],
  options: Readonly<{
    input?: Buffer;
    maxBuffer?: number;
  }> = {},
): Buffer {
  const result = spawnSync(
    executable,
    [
      "-C",
      repositoryRoot,
      "-c",
      "core.fsmonitor=false",
      "-c",
      "core.untrackedCache=false",
      "-c",
      "core.hooksPath=/dev/null",
      ...args,
    ],
    {
      cwd: repositoryRoot,
      env: sealedGitEnvironment(),
      encoding: "buffer",
      input: options.input,
      maxBuffer: options.maxBuffer ?? GIT_LISTING_MAX_BYTES_V2,
      timeout: GIT_COMMAND_TIMEOUT_MS_V2,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const stdout = Buffer.from(result.stdout ?? Buffer.alloc(0));
  const stderr = Buffer.from(result.stderr ?? Buffer.alloc(0));
  if (
    result.error
    || result.status !== 0
    || result.signal !== null
    || stderr.byteLength !== 0
  ) {
    const detail = stderr
      .subarray(0, GIT_DIAGNOSTIC_MAX_BYTES_V2)
      .toString("utf8")
      .replaceAll(repositoryRoot, "<REPOSITORY>");
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_COMMAND_FAILED",
      `Exact Git command failed status=${String(result.status)} signal=${String(result.signal)} detail=${detail}`,
      result.error,
    );
  }
  return stdout;
}

function exactGitLine(
  bytes: Buffer,
  label: string,
  maximumBytes = 4_096,
): string {
  if (
    bytes.byteLength < 2
    || bytes.byteLength > maximumBytes
    || bytes[bytes.byteLength - 1] !== 0x0a
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      `${label} did not return one bounded newline-terminated value`,
    );
  }
  const content = bytes.subarray(0, -1);
  if (
    content.includes(0)
    || content.includes(0x0a)
    || content.includes(0x0d)
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      `${label} returned non-canonical text`,
    );
  }
  const value = content.toString("utf8");
  if (!Buffer.from(value, "utf8").equals(content)) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      `${label} returned invalid UTF-8`,
    );
  }
  return value;
}

function requireGitHash(value: string, label: string): string {
  if (!FULL_GIT_OBJECT_HASH_V2.test(value)) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      `${label} is not one full lowercase Git object hash`,
    );
  }
  return value;
}

function classifyOrigin(
  originUrl: string,
  enforceCanonicalRepository: boolean,
): Readonly<{
  repositoryId:
    | typeof PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2
    | "test_fixture";
  originTransport: GitOriginTransportV2;
}> {
  if (originUrl === PLATFORM_RELEASE_SOURCE_HTTPS_ORIGIN_V2) {
    return Object.freeze({
      repositoryId: PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
      originTransport: "github_https" as const,
    });
  }
  if (originUrl === PLATFORM_RELEASE_SOURCE_SSH_ORIGIN_V2) {
    return Object.freeze({
      repositoryId: PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
      originTransport: "github_ssh" as const,
    });
  }
  if (enforceCanonicalRepository) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      "Production source origin is not the code-owned Setfarm repository",
    );
  }
  if (
    originUrl.length < 1
    || Buffer.byteLength(originUrl, "utf8") > 4_096
    || originUrl.includes("\0")
    || originUrl.includes("\n")
    || originUrl.includes("\r")
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      "Test source origin is not one bounded value",
    );
  }
  return Object.freeze({
    repositoryId: "test_fixture" as const,
    originTransport: "test_fixture_local" as const,
  });
}

function captureGitFence(
  gitExecutable: string,
  repositoryRoot: string,
  enforceCanonicalRepository: boolean,
): CapturedGitFenceV2 {
  const readLine = (args: readonly string[], label: string) =>
    exactGitLine(runGit(gitExecutable, repositoryRoot, args), label);
  const readIdentity = () => {
    const topLevel = readLine(
      ["rev-parse", "--show-toplevel"],
      "repository top level",
    );
    if (realpathSync(topLevel) !== repositoryRoot) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_REPOSITORY_INVALID",
        "Git top level differs from the anchored repository root",
      );
    }
    const branch = readLine(
      ["symbolic-ref", "--quiet", "--short", "HEAD"],
      "HEAD branch",
    );
    const headSha = requireGitHash(readLine(
      ["rev-parse", "--verify", "--end-of-options", "HEAD^{commit}"],
      "HEAD commit",
    ), "HEAD commit");
    const treeHash = requireGitHash(readLine(
      ["rev-parse", "--verify", "--end-of-options", "HEAD^{tree}"],
      "HEAD tree",
    ), "HEAD tree");
    const remoteSha = requireGitHash(readLine(
      [
        "rev-parse",
        "--verify",
        "--end-of-options",
        "refs/remotes/origin/main^{commit}",
      ],
      "origin main commit",
    ), "origin main commit");
    const remoteTreeHash = requireGitHash(readLine(
      [
        "rev-parse",
        "--verify",
        "--end-of-options",
        "refs/remotes/origin/main^{tree}",
      ],
      "origin main tree",
    ), "origin main tree");
    const originUrl = readLine(
      [
        "config",
        "--local",
        "--no-includes",
        "--get",
        "remote.origin.url",
      ],
      "origin URL",
    );
    return Object.freeze({
      branch,
      headSha,
      treeHash,
      remoteSha,
      remoteTreeHash,
      originUrl,
    });
  };

  const before = readIdentity();
  const status = runGit(
    gitExecutable,
    repositoryRoot,
    [
      "status",
      "--porcelain=v2",
      "-z",
      "--untracked-files=all",
      "--ignore-submodules=all",
    ],
    { maxBuffer: GIT_LISTING_MAX_BYTES_V2 },
  );
  const after = readIdentity();
  if (
    canonicalJsonStringify(before)
      !== canonicalJsonStringify(after)
    || before.branch !== "main"
    || before.headSha !== before.remoteSha
    || before.treeHash !== before.remoteTreeHash
    || before.headSha.length !== before.treeHash.length
    || status.byteLength !== 0
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      "Source admission requires one stable clean main exactly equal to origin/main",
    );
  }
  const origin = classifyOrigin(
    before.originUrl,
    enforceCanonicalRepository,
  );
  const remoteIdentity = {
    repositoryId: origin.repositoryId,
    originTransport: origin.originTransport,
    originUrlHash: sha256(before.originUrl),
    remoteRef: "refs/remotes/origin/main" as const,
    observedSha: before.remoteSha,
    observedTreeHash: before.remoteTreeHash,
  };
  const remote: RemoteObservationV2 = Object.freeze({
    ...remoteIdentity,
    observationHash: hashCanonicalJson({
      schema: "setfarm.remote-main-observation.v2",
      ...remoteIdentity,
    }),
  });
  const sourceIdentity = {
    headSha: before.headSha,
    treeHash: before.treeHash,
    indexTreeHash: before.treeHash,
  };
  const source: GitSourceFenceV2 = Object.freeze({
    ...sourceIdentity,
    identityHash: hashCanonicalJson({
      schema: "setfarm.git-source-fence-identity.v2",
      ...sourceIdentity,
    }),
  });
  const cleanIdentity: Omit<CleanWorktreeProofV2, "proofHash"> = {
    dirty: false as const,
    untrackedEntryCount: 0 as const,
    statusPorcelainContentHash:
      PLATFORM_RELEASE_EMPTY_GIT_STATUS_CONTENT_HASH_V2,
    headSha: before.headSha,
    treeHash: before.treeHash,
    indexTreeHash: before.treeHash,
  };
  const clean: CleanWorktreeProofV2 = Object.freeze({
    ...cleanIdentity,
    proofHash: hashCanonicalJson({
      schema: "setfarm.clean-worktree-proof.v2",
      ...cleanIdentity,
    }),
  });
  return Object.freeze({
    branch: "main" as const,
    originUrl: before.originUrl,
    remote,
    source,
    clean,
  });
}

function portableSourceLocator(locator: string): boolean {
  const segments = locator.split("/");
  return locator.length > 0
    && Buffer.byteLength(locator, "utf8") <= 1_024
    && PORTABLE_SOURCE_PATH_V2.test(locator)
    && segments.length <= 64
    && segments.every((segment) =>
      segment !== "."
      && segment !== ".."
      && segment.toLowerCase() !== ".git"
      && segment.toLowerCase() !== "node_modules"
      && Buffer.byteLength(segment, "utf8") <= 255);
}

function parseGitTreeListing(
  listing: Buffer,
  objectHashLength: number,
): readonly GitTreeFileV2[] {
  const files: GitTreeFileV2[] = [];
  const exactLocators = new Set<string>();
  const foldedLocators = new Set<string>();
  const directoryLocators = new Set<string>();
  const foldedDirectoryLocators = new Map<string, string>();
  let offset = 0;
  while (offset < listing.byteLength) {
    const end = listing.indexOf(0, offset);
    if (end < 0) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
        "Git tree listing is not NUL terminated",
      );
    }
    const record = listing.subarray(offset, end);
    offset = end + 1;
    const tab = record.indexOf(0x09);
    if (tab < 1) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
        "Git tree record has no exact locator separator",
      );
    }
    const prefix = record.subarray(0, tab).toString("ascii");
    const match = /^(100644|100755) blob ([a-f0-9]{40}|[a-f0-9]{64})$/
      .exec(prefix);
    const locatorBytes = record.subarray(tab + 1);
    const locator = locatorBytes.toString("utf8");
    if (
      !match
      || match[2]!.length !== objectHashLength
      || !Buffer.from(locator, "utf8").equals(locatorBytes)
      || !portableSourceLocator(locator)
      || exactLocators.has(locator)
      || foldedLocators.has(locator.toLowerCase())
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
        "Git tree contains a non-blob, non-portable or colliding entry",
      );
    }
    const segments = locator.split("/");
    let parent = "";
    for (const segment of segments.slice(0, -1)) {
      parent = parent ? `${parent}/${segment}` : segment;
      const foldedParent = parent.toLowerCase();
      const existingFoldedDirectory =
        foldedDirectoryLocators.get(foldedParent);
      if (
        exactLocators.has(parent)
        || foldedLocators.has(foldedParent)
        || (
          existingFoldedDirectory !== undefined
          && existingFoldedDirectory !== parent
        )
      ) {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
          "Git tree contains a file, directory or case-fold topology collision",
        );
      }
      directoryLocators.add(parent);
      foldedDirectoryLocators.set(foldedParent, parent);
    }
    if (
      directoryLocators.has(locator)
      || foldedDirectoryLocators.has(locator.toLowerCase())
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
        "Git tree contains a directory and file case-fold collision",
      );
    }
    exactLocators.add(locator);
    foldedLocators.add(locator.toLowerCase());
    files.push(Object.freeze({
      locator,
      gitMode: match[1] as "100644" | "100755",
      blobHash: match[2]!,
    }));
    if (
      files.length > PLATFORM_RELEASE_SOURCE_MAX_FILES_V2
      || directoryLocators.size
        > PLATFORM_RELEASE_SOURCE_MAX_DIRECTORIES_V2
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
        "Git source tree exceeds its file or directory limit",
      );
    }
  }
  if (files.length === 0) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
      "Git source tree must contain files",
    );
  }
  return Object.freeze(
    files.sort((left, right) =>
      left.locator < right.locator
        ? -1
        : left.locator > right.locator ? 1 : 0),
  );
}

function gitObjectHash(
  objectType: "blob" | "commit" | "tree",
  bytes: Uint8Array,
  objectHashLength: number,
): string {
  const algorithm = objectHashLength === 40
    ? "sha1"
    : objectHashLength === 64 ? "sha256" : null;
  if (!algorithm) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Git object format is unsupported",
    );
  }
  return createHash(algorithm)
    .update(`${objectType} ${bytes.byteLength}\0`)
    .update(bytes)
    .digest("hex");
}

function readGitObjects(
  gitExecutable: string,
  repositoryRoot: string,
  commitSha: string,
  files: readonly GitTreeFileV2[],
): ReadonlyMap<string, CapturedGitObjectV2> {
  const requests = [
    commitSha,
    ...new Set(files.map((entry) => entry.blobHash)),
  ];
  const output = runGit(
    gitExecutable,
    repositoryRoot,
    ["cat-file", "--batch"],
    {
      input: Buffer.from(`${requests.join("\n")}\n`, "ascii"),
      maxBuffer:
        PLATFORM_RELEASE_SOURCE_MAX_TOTAL_BYTES_V2
        + SOURCE_FILE_MAX_BYTES_V2
        + GIT_LISTING_MAX_BYTES_V2,
    },
  );
  const objects = new Map<string, CapturedGitObjectV2>();
  let offset = 0;
  let totalBlobBytes = 0;
  for (const expectedHash of requests) {
    const headerEnd = output.indexOf(0x0a, offset);
    if (headerEnd < 0 || headerEnd - offset > 256) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
        "Git batch object header is missing or oversized",
      );
    }
    const header = output.subarray(offset, headerEnd).toString("ascii");
    const match =
      /^([a-f0-9]{40}|[a-f0-9]{64}) (blob|commit) (0|[1-9][0-9]*)$/
        .exec(header);
    if (
      !match
      || match[1] !== expectedHash
      || match[1]!.length !== commitSha.length
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
        "Git batch object header differs from its exact request",
      );
    }
    const objectType = match[2] as "blob" | "commit";
    const byteLength = Number(match[3]);
    if (
      !Number.isSafeInteger(byteLength)
      || byteLength < (objectType === "commit" ? 1 : 0)
      || (objectType === "blob"
        && byteLength > SOURCE_FILE_MAX_BYTES_V2)
      || (objectType === "commit"
        && byteLength > SOURCE_FILE_MAX_BYTES_V2)
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
        "Git object byte length is outside its exact bound",
      );
    }
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + byteLength;
    if (
      contentEnd >= output.byteLength
      || output[contentEnd] !== 0x0a
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
        "Git batch object bytes are truncated or not delimited",
      );
    }
    const bytes = Buffer.from(
      output.subarray(contentStart, contentEnd),
    );
    if (
      gitObjectHash(objectType, bytes, commitSha.length)
        !== expectedHash
    ) {
      bytes.fill(0);
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
        "Git object bytes do not reproduce their object ID",
      );
    }
    if (objectType === "blob") {
      totalBlobBytes += byteLength;
      if (
        totalBlobBytes
          > PLATFORM_RELEASE_SOURCE_MAX_TOTAL_BYTES_V2
      ) {
        bytes.fill(0);
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
          "Git blob set exceeds its aggregate byte bound",
        );
      }
    }
    objects.set(expectedHash, Object.freeze({
      objectHash: expectedHash,
      objectType,
      bytes,
    }));
    offset = contentEnd + 1;
  }
  if (offset !== output.byteLength) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Git batch returned unrequested trailing bytes",
    );
  }
  return objects;
}

function parseCommitObject(
  commit: CapturedGitObjectV2,
  expectedTreeHash: string,
): Readonly<{
  treeHash: string;
  commitEpochSeconds: string;
}> {
  if (commit.objectType !== "commit") {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Admitted commit request did not return a commit object",
    );
  }
  const headerEnd = commit.bytes.indexOf(
    Buffer.from("\n\n", "ascii"),
  );
  if (headerEnd < 1 || headerEnd > SOURCE_FILE_MAX_BYTES_V2) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Commit object has no bounded header",
    );
  }
  const headerBytes = commit.bytes.subarray(0, headerEnd);
  const header = headerBytes.toString("utf8");
  if (
    !Buffer.from(header, "utf8").equals(headerBytes)
    || header.includes("\0")
    || header.includes("\r")
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Commit header is not canonical UTF-8",
    );
  }
  const lines = header.split("\n");
  const treeLines = lines.filter((line) => line.startsWith("tree "));
  const committerLines = lines.filter(
    (line) => line.startsWith("committer "),
  );
  if (treeLines.length !== 1 || committerLines.length !== 1) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Commit header lacks one exact tree or committer identity",
    );
  }
  const treeHash = treeLines[0]!.slice("tree ".length);
  const epochMatch = / (0|[1-9][0-9]{0,19}) [+-][0-9]{4}$/
    .exec(committerLines[0]!);
  if (
    treeHash !== expectedTreeHash
    || !FULL_GIT_OBJECT_HASH_V2.test(treeHash)
    || !epochMatch
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Commit bytes differ from the admitted tree or clock",
    );
  }
  const epoch = Number(epochMatch[1]);
  if (
    !Number.isSafeInteger(epoch)
    || !Number.isFinite(new Date(epoch * 1_000).valueOf())
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Commit epoch is outside the deterministic build clock range",
    );
  }
  return Object.freeze({
    treeHash,
    commitEpochSeconds: epochMatch[1]!,
  });
}

type MutableTreeNodeV2 = {
  readonly directories: Map<string, MutableTreeNodeV2>;
  readonly files: Map<string, GitTreeFileV2>;
};

function reproduceRootTreeHash(
  files: readonly GitTreeFileV2[],
  objectHashLength: number,
): string {
  const root: MutableTreeNodeV2 = {
    directories: new Map(),
    files: new Map(),
  };
  for (const file of files) {
    const segments = file.locator.split("/");
    let node = root;
    for (const segment of segments.slice(0, -1)) {
      let child = node.directories.get(segment);
      if (!child) {
        child = { directories: new Map(), files: new Map() };
        node.directories.set(segment, child);
      }
      node = child;
    }
    node.files.set(segments.at(-1)!, file);
  }

  const hashNode = (node: MutableTreeNodeV2): string => {
    const entries: Array<Readonly<{
      name: string;
      directory: boolean;
      mode: string;
      objectHash: string;
    }>> = [];
    for (const [name, child] of node.directories) {
      entries.push({
        name,
        directory: true,
        mode: "40000",
        objectHash: hashNode(child),
      });
    }
    for (const [name, file] of node.files) {
      entries.push({
        name,
        directory: false,
        mode: file.gitMode,
        objectHash: file.blobHash,
      });
    }
    entries.sort((left, right) => Buffer.compare(
      Buffer.from(`${left.name}${left.directory ? "/" : ""}`, "ascii"),
      Buffer.from(`${right.name}${right.directory ? "/" : ""}`, "ascii"),
    ));
    const chunks: Buffer[] = [];
    for (const entry of entries) {
      chunks.push(Buffer.from(
        `${entry.mode} ${entry.name}\0`,
        "ascii",
      ));
      chunks.push(Buffer.from(entry.objectHash, "hex"));
    }
    return gitObjectHash(
      "tree",
      Buffer.concat(chunks),
      objectHashLength,
    );
  };
  return hashNode(root);
}

function ensurePrivateStageParent(): string {
  const parent = realpathSync(tmpdir());
  const stat = lstatSync(parent);
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || realpathSync(parent) !== parent
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      "Private temporary parent is not one real directory",
    );
  }
  return parent;
}

function writeAll(descriptor: number, bytes: Buffer): void {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const written = writeSync(
      descriptor,
      bytes,
      offset,
      bytes.byteLength - offset,
      null,
    );
    if (written < 1) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Exclusive source write ended early",
      );
    }
    offset += written;
  }
}

function fsyncDirectory(absolutePath: string): void {
  const descriptor = openSync(
    absolutePath,
    constants.O_RDONLY
      | constants.O_DIRECTORY
      | constants.O_NOFOLLOW,
  );
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function materializeSourceStage(
  files: readonly GitTreeFileV2[],
  objects: ReadonlyMap<string, CapturedGitObjectV2>,
): Readonly<{
  contextRoot: string;
  stageRoot: string;
}> {
  const parent = ensurePrivateStageParent();
  let contextRoot: string | undefined;
  let stageRoot: string | undefined;
  try {
    contextRoot = realpathSync(mkdtempSync(
      path.join(parent, SOURCE_STAGE_PREFIX_V2),
    ));
    chmodSync(contextRoot, 0o700);
    const context = lstatSync(contextRoot);
    if (
      context.isSymbolicLink()
      || !context.isDirectory()
      || (context.mode & 0o7777) !== 0o700
      || readdirSync(contextRoot).length !== 0
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Source context was not one fresh private empty directory",
      );
    }
    stageRoot = path.join(contextRoot, "source");
    mkdirSync(stageRoot, { mode: 0o700 });
    stageRoot = realpathSync(stageRoot);
    if (readdirSync(stageRoot).length !== 0) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Source stage was not initially empty",
      );
    }
    const directories = new Set<string>();
    for (const file of files) {
      const segments = file.locator.split("/");
      let current = "";
      for (const segment of segments.slice(0, -1)) {
        current = current ? `${current}/${segment}` : segment;
        directories.add(current);
      }
    }
    const orderedDirectories = [...directories].sort(
      (left, right) => {
        const depth = left.split("/").length
          - right.split("/").length;
        return depth !== 0
          ? depth
          : left < right ? -1 : left > right ? 1 : 0;
      },
    );
    for (const locator of orderedDirectories) {
      mkdirSync(path.join(stageRoot, locator), { mode: 0o700 });
    }
    for (const file of files) {
      const object = objects.get(file.blobHash);
      if (!object || object.objectType !== "blob") {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
          "Source file has no exact captured blob bytes",
        );
      }
      const absolutePath = path.join(stageRoot, file.locator);
      let descriptor: number | undefined;
      try {
        descriptor = openSync(
          absolutePath,
          constants.O_WRONLY
            | constants.O_CREAT
            | constants.O_EXCL
            | constants.O_NOFOLLOW,
          0o600,
        );
        writeAll(descriptor, object.bytes);
        fsyncSync(descriptor);
        fchmodSync(
          descriptor,
          file.gitMode === "100755" ? 0o555 : 0o444,
        );
        fsyncSync(descriptor);
      } finally {
        closeQuietly(descriptor);
      }
    }
    for (const locator of [...orderedDirectories].reverse()) {
      const absolutePath = path.join(stageRoot, locator);
      chmodSync(absolutePath, 0o555);
      fsyncDirectory(absolutePath);
    }
    chmodSync(stageRoot, 0o555);
    fsyncDirectory(stageRoot);
    fsyncDirectory(contextRoot);
    fsyncDirectory(parent);
    return Object.freeze({ contextRoot, stageRoot });
  } catch (error) {
    if (contextRoot) cleanupStage(contextRoot);
    if (error instanceof PlatformReleaseSourceAdmissionErrorV2) throw error;
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      "Source stage materialization failed",
      error,
    );
  }
}

function stableStageFile(
  absolutePath: string,
  expected: Stats,
): Buffer {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (
      !before.isFile()
      || before.nlink !== 1
      || before.size < 0
      || before.size > SOURCE_FILE_MAX_BYTES_V2
      || !sameStat(before, expected)
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Source stage file changed before descriptor capture",
      );
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    if (
      bytes.byteLength !== before.size
      || !sameStat(before, after)
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Source stage file changed during descriptor capture",
      );
    }
    return bytes;
  } catch (error) {
    if (error instanceof PlatformReleaseSourceAdmissionErrorV2) throw error;
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      "Source stage file could not be captured",
      error,
    );
  } finally {
    closeQuietly(descriptor);
  }
}

function captureSourceFingerprint(
  stageRoot: string,
): SourceFingerprintV2 {
  const entries: SourceFingerprintEntryV2[] = [];
  let fileCount = 0;
  let directoryCount = 0;
  let totalBytes = 0;

  const visit = (absolute: string, relative: string): void => {
    const before = lstatSync(absolute);
    if (
      before.isSymbolicLink()
      || !before.isDirectory()
      || (before.mode & 0o7777) !== 0o555
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Source stage contains a noncanonical directory",
      );
    }
    const names = readdirSync(absolute).sort();
    for (const name of names) {
      const childRelative = relative
        ? `${relative}/${name}`
        : name;
      if (!portableSourceLocator(childRelative)) {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
          "Source stage contains a nonportable locator",
        );
      }
      const child = path.join(absolute, name);
      const stat = lstatSync(child);
      if (stat.isSymbolicLink()) {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
          "Source stage contains a symbolic link",
        );
      }
      if (stat.isDirectory()) {
        directoryCount += 1;
        if (
          directoryCount
            > PLATFORM_RELEASE_SOURCE_MAX_DIRECTORIES_V2
        ) {
          return fail(
            "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
            "Source stage exceeds its directory bound",
          );
        }
        entries.push(Object.freeze({
          path: childRelative,
          type: "directory" as const,
          mode: "0555" as const,
        }));
        visit(child, childRelative);
        continue;
      }
      if (
        !stat.isFile()
        || stat.nlink !== 1
        || ![0o444, 0o555].includes(stat.mode & 0o7777)
        || stat.size < 0
        || stat.size > SOURCE_FILE_MAX_BYTES_V2
      ) {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
          "Source stage contains a noncanonical file",
        );
      }
      const bytes = stableStageFile(child, stat);
      const after = lstatSync(child);
      if (!sameStat(stat, after)) {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
          "Source stage file changed after descriptor capture",
        );
      }
      fileCount += 1;
      totalBytes += bytes.byteLength;
      if (
        fileCount > PLATFORM_RELEASE_SOURCE_MAX_FILES_V2
        || totalBytes > PLATFORM_RELEASE_SOURCE_MAX_TOTAL_BYTES_V2
      ) {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
          "Source stage exceeds its file or byte bound",
        );
      }
      entries.push(Object.freeze({
        path: childRelative,
        type: "file" as const,
        mode: (stat.mode & 0o7777) === 0o555
          ? "0555" as const
          : "0444" as const,
        byteLength: bytes.byteLength,
        contentHash: sha256(bytes),
      }));
    }
    const afterNames = readdirSync(absolute).sort();
    const after = lstatSync(absolute);
    if (
      canonicalJsonStringify(names)
        !== canonicalJsonStringify(afterNames)
      || !sameStat(before, after)
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Source stage directory changed during traversal",
      );
    }
  };

  visit(stageRoot, "");
  const fingerprintHash = sha256(canonicalJsonStringify({
    schema:
      "setfarm.platform-release-build-source-fingerprint.v2",
    entries,
    fileCount,
    directoryCount,
    totalBytes,
  }));
  return Object.freeze({
    entries: Object.freeze(entries),
    fileCount,
    directoryCount,
    totalBytes,
    fingerprintHash,
  });
}

function expectedSourceFingerprint(
  files: readonly GitTreeFileV2[],
  objects: ReadonlyMap<string, CapturedGitObjectV2>,
): SourceFingerprintV2 {
  const fileByLocator = new Map(
    files.map((file) => [file.locator, file] as const),
  );
  const directories = new Set<string>();
  const children = new Map<string, Set<string>>();
  const addChild = (parent: string, name: string) => {
    let names = children.get(parent);
    if (!names) {
      names = new Set();
      children.set(parent, names);
    }
    names.add(name);
  };
  for (const file of files) {
    const segments = file.locator.split("/");
    let parent = "";
    for (const segment of segments.slice(0, -1)) {
      const directory = parent
        ? `${parent}/${segment}`
        : segment;
      if (!directories.has(directory)) {
        directories.add(directory);
        addChild(parent, segment);
      }
      parent = directory;
    }
    addChild(parent, segments.at(-1)!);
  }

  const entries: SourceFingerprintEntryV2[] = [];
  let totalBytes = 0;
  const visit = (relative: string): void => {
    const names = [...(children.get(relative) ?? [])].sort();
    for (const name of names) {
      const locator = relative ? `${relative}/${name}` : name;
      if (directories.has(locator)) {
        entries.push(Object.freeze({
          path: locator,
          type: "directory" as const,
          mode: "0555" as const,
        }));
        visit(locator);
        continue;
      }
      const file = fileByLocator.get(locator);
      const object = file ? objects.get(file.blobHash) : undefined;
      if (!file || !object || object.objectType !== "blob") {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
          "Expected source fingerprint lacks exact blob bytes",
        );
      }
      totalBytes += object.bytes.byteLength;
      entries.push(Object.freeze({
        path: locator,
        type: "file" as const,
        mode: file.gitMode === "100755"
          ? "0555" as const
          : "0444" as const,
        byteLength: object.bytes.byteLength,
        contentHash: sha256(object.bytes),
      }));
    }
  };
  visit("");
  const identity = {
    schema:
      "setfarm.platform-release-build-source-fingerprint.v2",
    entries,
    fileCount: files.length,
    directoryCount: directories.size,
    totalBytes,
  };
  return Object.freeze({
    entries: Object.freeze(entries),
    fileCount: identity.fileCount,
    directoryCount: identity.directoryCount,
    totalBytes: identity.totalBytes,
    fingerprintHash: sha256(canonicalJsonStringify(identity)),
  });
}

function sourceStageIdentity(
  stageRoot: string,
  sourceBindingHash: string,
): PlatformReleaseSourceStagePhysicalIdentityV2 {
  const stat = lstatSync(stageRoot);
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || realpathSync(stageRoot) !== stageRoot
    || (stat.mode & 0o7777) !== 0o555
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      "Source stage root identity is invalid",
    );
  }
  const identity = {
    schema:
      PLATFORM_RELEASE_SOURCE_STAGE_PHYSICAL_IDENTITY_V2_SCHEMA,
    device: String(stat.dev),
    inode: String(stat.ino),
    ownerUid: stat.uid,
    ownerGid: stat.gid,
    mode: "0555" as const,
    sourceBindingHash,
  };
  return Object.freeze({
    ...identity,
    identityHash:
      hashPlatformReleaseSourceStagePhysicalIdentityV2({
        ...identity,
        identityHash: sha256("placeholder"),
      }),
  });
}

function exactSourceRef(
  file: GitTreeFileV2,
  object: CapturedGitObjectV2,
  role:
    | "dependency_lock_manifest"
    | "package_manifest"
    | "typescript_compiler_config",
  locator: "package-lock.json" | "package.json" | "tsconfig.json",
) {
  if (
    file.locator !== locator
    || file.gitMode !== "100644"
    || object.objectType !== "blob"
    || object.bytes.byteLength < 1
    || object.bytes.byteLength > 16 * 1024 * 1024
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
      `Required source input ${locator} is absent or noncanonical`,
    );
  }
  const identity = {
    schema: EXACT_PLATFORM_RELEASE_SOURCE_REF_V2_SCHEMA,
    role,
    locator,
    mediaType: "application/json" as const,
    gitBlobHash: file.blobHash,
    contentHash: sha256(object.bytes),
    byteLength: object.bytes.byteLength,
    gitMode: "100644" as const,
    exportedMode: "0444" as const,
  };
  return Object.freeze({
    ...identity,
    sourceRefHash:
      hashExactPlatformReleaseSourceRefV2(identity),
  });
}

function deriveSourceBinding(
  files: readonly GitTreeFileV2[],
  objects: ReadonlyMap<string, CapturedGitObjectV2>,
  sourceTreeHash: string,
  fingerprint: SourceFingerprintV2,
): PlatformReleaseSourceTreeBindingV2 {
  const find = (locator: string) => {
    const file = files.find((entry) => entry.locator === locator);
    const object = file ? objects.get(file.blobHash) : undefined;
    if (!file || !object) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
        `Required source input ${locator} is missing`,
      );
    }
    return { file, object };
  };
  const lock = find("package-lock.json");
  const manifest = find("package.json");
  const config = find("tsconfig.json");
  const inputs = [
    exactSourceRef(
      lock.file,
      lock.object,
      "dependency_lock_manifest",
      "package-lock.json",
    ),
    exactSourceRef(
      manifest.file,
      manifest.object,
      "package_manifest",
      "package.json",
    ),
    exactSourceRef(
      config.file,
      config.object,
      "typescript_compiler_config",
      "tsconfig.json",
    ),
  ] as const;
  const inputMembershipHash = hashCanonicalJson({
    schema: "setfarm.platform-release-source-input-membership.v2",
    entries: inputs.map((entry) => ({
      role: entry.role,
      locator: entry.locator,
      sourceRefHash: entry.sourceRefHash,
    })),
  });
  const identity = {
    schema: PLATFORM_RELEASE_SOURCE_TREE_BINDING_V2_SCHEMA,
    sourceTreeHash,
    exportedFileTreeHash: fingerprint.fingerprintHash,
    exportedFileCount: fingerprint.fileCount,
    exportedDirectoryCount: fingerprint.directoryCount,
    exportedTotalBytes: fingerprint.totalBytes,
    inputMembershipHash,
    inputs,
  };
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseSourceTreeBindingV2Schema.parse({
      ...identity,
      bindingHash:
        hashPlatformReleaseSourceTreeBindingV2(identity as never),
    }),
  );
}

function cleanupStage(stageRoot: string): void {
  try {
    if (!lstatSync(stageRoot).isDirectory()) return;
    const pending = [stageRoot];
    while (pending.length > 0) {
      const current = pending.pop()!;
      try {
        const stat = lstatSync(current);
        if (stat.isDirectory() && !stat.isSymbolicLink()) {
          chmodSync(current, 0o700);
          for (const name of readdirSync(current)) {
            pending.push(path.join(current, name));
          }
        } else if (!stat.isSymbolicLink()) {
          chmodSync(current, 0o600);
        }
      } catch {
        // Best-effort cleanup remains scoped to the private random stage.
      }
    }
    rmSync(stageRoot, { recursive: true, force: true });
  } catch {
    // The typed operation failure remains authoritative.
  }
}

function zeroObjectBytes(
  objects: ReadonlyMap<string, CapturedGitObjectV2> | undefined,
): void {
  if (!objects) return;
  for (const object of objects.values()) object.bytes.fill(0);
}

function runSourceExport(
  repositoryRootInput: unknown,
  gitExecutableInput: unknown,
  options: Readonly<{
    enforceCanonicalRepository: boolean;
    afterInitialFenceForTest?: () => void;
    afterFirstStageCaptureForTest?: (stageRoot: string) => void;
  }>,
): Readonly<{
  contextRoot: string;
  stageRoot: string;
  core: SourceExportCoreV2;
}> {
  const repositoryRoot = anchorRealDirectory(repositoryRootInput);
  const git = anchorGitExecutableForTest(gitExecutableInput);
  let contextRoot: string | undefined;
  let stageRoot: string | undefined;
  let objects: ReadonlyMap<string, CapturedGitObjectV2> | undefined;
  try {
    const before = captureGitFence(
      git.absolutePath,
      repositoryRoot,
      options.enforceCanonicalRepository,
    );
    options.afterInitialFenceForTest?.();
    const listing = runGit(
      git.absolutePath,
      repositoryRoot,
      [
        "ls-tree",
        "-rz",
        "--full-tree",
        "-r",
        before.source.headSha,
      ],
      { maxBuffer: GIT_LISTING_MAX_BYTES_V2 },
    );
    const files = parseGitTreeListing(
      listing,
      before.source.headSha.length,
    );
    objects = readGitObjects(
      git.absolutePath,
      repositoryRoot,
      before.source.headSha,
      files,
    );
    const commit = parseCommitObject(
      objects.get(before.source.headSha)!,
      before.source.treeHash,
    );
    if (
      reproduceRootTreeHash(files, before.source.headSha.length)
        !== before.source.treeHash
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
        "Recursive Git tree bytes do not reproduce HEAD tree",
      );
    }
    const materialized = materializeSourceStage(files, objects);
    contextRoot = materialized.contextRoot;
    stageRoot = materialized.stageRoot;
    const expectedFingerprint =
      expectedSourceFingerprint(files, objects);
    const fingerprintBefore =
      captureSourceFingerprint(stageRoot);
    if (
      canonicalJsonStringify(expectedFingerprint)
        !== canonicalJsonStringify(fingerprintBefore)
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Materialized source stage differs from verified Git object bytes",
      );
    }
    const source = deriveSourceBinding(
      files,
      objects,
      before.source.treeHash,
      fingerprintBefore,
    );
    const stageBefore = sourceStageIdentity(
      stageRoot,
      source.bindingHash,
    );
    options.afterFirstStageCaptureForTest?.(stageRoot);
    const after = captureGitFence(
      git.absolutePath,
      repositoryRoot,
      options.enforceCanonicalRepository,
    );
    const fingerprintAfter =
      captureSourceFingerprint(stageRoot);
    const stageAfter = sourceStageIdentity(
      stageRoot,
      source.bindingHash,
    );
    const gitAfter = anchorGitExecutableForTest(git.absolutePath);
    if (
      canonicalJsonStringify(before)
        !== canonicalJsonStringify(after)
      || canonicalJsonStringify(fingerprintBefore)
        !== canonicalJsonStringify(fingerprintAfter)
      || canonicalJsonStringify(expectedFingerprint)
        !== canonicalJsonStringify(fingerprintAfter)
      || stageBefore.identityHash !== stageAfter.identityHash
      || source.exportedFileTreeHash
        !== fingerprintAfter.fingerprintHash
      || source.exportedFileCount !== fingerprintAfter.fileCount
      || source.exportedDirectoryCount
        !== fingerprintAfter.directoryCount
      || source.exportedTotalBytes !== fingerprintAfter.totalBytes
      || gitAfter.hash !== git.hash
      || gitAfter.byteLength !== git.byteLength
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_DRIFT",
        "Repository, Git executable or exported source changed across admission",
      );
    }
    const core: SourceExportCoreV2 = deepFreezePlatformReleaseJsonV2({
      admittedSource: {
        sha: before.source.headSha,
        treeHash: commit.treeHash,
        commitEpochSeconds: commit.commitEpochSeconds,
      },
      remoteBefore: before.remote,
      remoteAfter: after.remote,
      sourceBefore: before.source,
      sourceAfter: after.source,
      cleanWorktreeBefore: before.clean,
      cleanWorktreeAfter: after.clean,
      source,
      stageBefore,
      stageAfter,
      gitExecutableHash: git.hash,
      gitExecutableByteLength: git.byteLength,
    });
    return Object.freeze({ contextRoot, stageRoot, core });
  } catch (error) {
    if (contextRoot) cleanupStage(contextRoot);
    if (error instanceof PlatformReleaseSourceAdmissionErrorV2) throw error;
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_SOURCE_DRIFT",
      "Source export failed before a stable candidate was issued",
      error,
    );
  } finally {
    zeroObjectBytes(objects);
  }
}

function parseHostFileCandidate(
  input: unknown,
  label: string,
): ExactHostOwnedFileRefV2 {
  try {
    const snapshot = boundedPlatformReleaseJsonSnapshotV2(
      input,
      SOURCE_ADMISSION_INPUT_MAX_BYTES_V2,
    );
    return deepFreezePlatformReleaseJsonV2(
      ExactHostOwnedFileRefV2Schema.parse(snapshot),
    );
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID",
      `${label} host admission candidate is invalid`,
      error,
    );
  }
}

function verifyHostFileProjection(
  candidate: ExactHostOwnedFileRefV2,
  label: string,
): void {
  const observed = hashStableFile(
    candidate.absoluteRealpathLocator,
    1024 * 1024 * 1024,
    "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID",
  );
  let real: string;
  try {
    real = realpathSync(candidate.absoluteRealpathLocator);
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID",
      `${label} realpath could not be observed`,
      error,
    );
  }
  if (
    real !== candidate.absoluteRealpathLocator
    || observed.hash !== candidate.hash
    || observed.byteLength !== candidate.byteLength
    || observed.stat.uid !== candidate.ownerUid
    || observed.stat.gid !== candidate.ownerGid
    || (observed.stat.mode & 0o7777)
      !== Number.parseInt(candidate.mode, 8)
    || candidate.hostAdmissionReceipt.physicalBefore.device
      !== String(observed.stat.dev)
    || candidate.hostAdmissionReceipt.physicalAfter.device
      !== String(observed.stat.dev)
    || candidate.hostAdmissionReceipt.physicalBefore.inode
      !== String(observed.stat.ino)
    || candidate.hostAdmissionReceipt.physicalAfter.inode
      !== String(observed.stat.ino)
    || candidate.hostAdmissionReceipt.physicalBefore.linkCount
      !== observed.stat.nlink
    || candidate.hostAdmissionReceipt.physicalAfter.linkCount
      !== observed.stat.nlink
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID",
      `${label} bytes or physical projection differ from host admission`,
    );
  }
}

function authenticState(
  handle: AdmittedPlatformReleaseSourceStageV2,
): SourceStageStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle)
      !== AdmittedPlatformReleaseSourceStageV2.prototype
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_HANDLE_UNAUTHENTICATED",
      "Source stage operation requires one authentic handle",
    );
  }
  const state = sourceStageStatesV2.get(handle);
  if (!state) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_HANDLE_UNAUTHENTICATED",
      "Source stage operation requires one authentic handle",
    );
  }
  if (state.disposed) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      "Source stage handle has already been disposed",
    );
  }
  return state;
}

function issueHandle(state: SourceStageStateV2) {
  return new AdmittedPlatformReleaseSourceStageV2(
    sourceStageConstructorCapabilityV2,
    state,
  );
}

export function admitPlatformReleaseSourceV2(
  input: AdmitPlatformReleaseSourceV2Input,
): AdmittedPlatformReleaseSourceStageV2 {
  const candidate = exactPlainObject(input, "Source admission input");
  const allowed = ["gitTool", "implementation", "repositoryRoot"];
  if (
    Object.keys(candidate).sort().join("\0")
      !== allowed.join("\0")
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
      "Production source admission input has unknown or missing fields",
    );
  }
  const implementation = parseHostFileCandidate(
    candidate.implementation,
    "Source admission implementation",
  );
  const gitTool = parseHostFileCandidate(
    candidate.gitTool,
    "Source Git tool",
  );
  const implementationRealpath = realpathSync(
    fileURLToPath(import.meta.url),
  );
  if (
    implementation.absoluteRealpathLocator
      !== implementationRealpath
    || gitTool.mode !== "0555"
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID",
      "Production admission must execute the exact host-admitted implementation and Git tool",
    );
  }
  verifyHostFileProjection(implementation, "Source implementation");
  verifyHostFileProjection(gitTool, "Source Git tool");
  const exported = runSourceExport(
    candidate.repositoryRoot,
    gitTool.absoluteRealpathLocator,
    { enforceCanonicalRepository: true },
  );
  try {
    verifyHostFileProjection(implementation, "Source implementation");
    verifyHostFileProjection(gitTool, "Source Git tool");
    const receiptIdentity = {
      schema: SOURCE_ADMISSION_RECEIPT_V2_SCHEMA,
      version: "2.0.0" as const,
      authorityState: "candidate_observation_unverified" as const,
      productionUse:
        "forbidden_until_fresh_root_owned_source_verification" as const,
      repositoryId: PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
      remoteRef: "refs/remotes/origin/main" as const,
      policy: "exact_remote_main_sha" as const,
      branch: "main" as const,
      admissionContractHash:
        PLATFORM_RELEASE_SOURCE_ADMISSION_CONTRACT_HASH_V2,
      remoteBefore: exported.core.remoteBefore,
      remoteAfter: exported.core.remoteAfter,
      admittedSource: exported.core.admittedSource,
      cleanWorktreeBefore: exported.core.cleanWorktreeBefore,
      cleanWorktreeAfter: exported.core.cleanWorktreeAfter,
      sourceBefore: exported.core.sourceBefore,
      sourceAfter: exported.core.sourceAfter,
      exportedSource: {
        method: "verified_git_tree_export.v2" as const,
        buildContextPolicy:
          "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2" as const,
        source: exported.core.source,
        initialStageWasEmpty: true as const,
        stageBefore: exported.core.stageBefore,
        stageAfter: exported.core.stageAfter,
        temporaryLocatorDisclosure: "forbidden" as const,
      },
      gitTool: {
        executable: gitTool,
        requiredAbi:
          "GIT_OBJECT_DATABASE_SOURCE_EXPORT_V2" as const,
        commandContractHash:
          PLATFORM_RELEASE_SOURCE_GIT_COMMAND_CONTRACT_HASH_V2,
      },
      implementation: {
        ownership:
          "root_owned_separately_installed" as const,
        module: implementation,
        requiredExport:
          "admitPlatformReleaseSourceV2" as const,
      },
    };
    const receipt = deepFreezePlatformReleaseJsonV2(
      SourceAdmissionReceiptV2Schema.parse({
        ...receiptIdentity,
        receiptHash:
          hashSourceAdmissionReceiptV2(receiptIdentity as never),
      }),
    );
    return issueHandle({
      admissionScope: "production_candidate",
      contextRoot: exported.contextRoot,
      stageRoot: exported.stageRoot,
      core: exported.core,
      receipt,
      testEvidence: null,
      disposed: false,
    });
  } catch (error) {
    cleanupStage(exported.contextRoot);
    if (error instanceof PlatformReleaseSourceAdmissionErrorV2) throw error;
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID",
      "Production source receipt could not be issued",
      error,
    );
  }
}

export function admitPlatformReleaseSourceV2ForTest(
  input: AdmitPlatformReleaseSourceV2ForTestInput,
): AdmittedPlatformReleaseSourceStageV2 {
  const candidate = exactPlainObject(
    input,
    "Test source admission input",
  );
  const allowed = [
    "afterFirstStageCaptureForTest",
    "afterInitialFenceForTest",
    "gitExecutable",
    "repositoryRoot",
  ];
  if (
    Object.keys(candidate).some((key) => !allowed.includes(key))
    || typeof candidate.repositoryRoot !== "string"
    || (
      candidate.gitExecutable !== undefined
      && typeof candidate.gitExecutable !== "string"
    )
    || (
      candidate.afterInitialFenceForTest !== undefined
      && typeof candidate.afterInitialFenceForTest !== "function"
    )
    || (
      candidate.afterFirstStageCaptureForTest !== undefined
      && typeof candidate.afterFirstStageCaptureForTest !== "function"
    )
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
      "Test source admission input is invalid",
    );
  }
  const exported = runSourceExport(
    candidate.repositoryRoot,
    candidate.gitExecutable ?? "/usr/bin/git",
    {
      enforceCanonicalRepository: false,
      afterInitialFenceForTest:
        candidate.afterInitialFenceForTest as
          (() => void) | undefined,
      afterFirstStageCaptureForTest:
        candidate.afterFirstStageCaptureForTest as
          ((stageRoot: string) => void) | undefined,
    },
  );
  const testEvidence: PlatformReleaseSourceAdmissionTestEvidenceV2 =
    deepFreezePlatformReleaseJsonV2({
      schema:
        "setfarm.platform-release-source-admission-test-evidence.v2",
      authorityState:
        "test_fixture_source_admission_only",
      productionUse: "forbidden",
      repositoryId: "test_fixture",
      admittedSource: exported.core.admittedSource,
      remoteBefore: exported.core.remoteBefore,
      remoteAfter: exported.core.remoteAfter,
      sourceBefore: exported.core.sourceBefore,
      sourceAfter: exported.core.sourceAfter,
      cleanWorktreeBefore: exported.core.cleanWorktreeBefore,
      cleanWorktreeAfter: exported.core.cleanWorktreeAfter,
      exportedSource: {
        method: "verified_git_tree_export.v2",
        buildContextPolicy:
          "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2",
        source: exported.core.source,
        initialStageWasEmpty: true,
        stageBefore: exported.core.stageBefore,
        stageAfter: exported.core.stageAfter,
        temporaryLocatorDisclosure: "forbidden",
      },
      gitExecutable: {
        hash: exported.core.gitExecutableHash,
        byteLength: exported.core.gitExecutableByteLength,
        authority: "test_fixture_process_tool",
      },
    });
  return issueHandle({
    admissionScope: "test_fixture",
    contextRoot: exported.contextRoot,
    stageRoot: exported.stageRoot,
    core: exported.core,
    receipt: null,
    testEvidence,
    disposed: false,
  });
}

export function inspectPlatformReleaseSourceAdmissionCandidateV2(
  handle: AdmittedPlatformReleaseSourceStageV2,
): PlatformReleaseSourceAdmissionCandidateSnapshotV2 {
  const state = authenticState(handle);
  const snapshot = state.admissionScope === "production_candidate"
    ? {
      admissionScope: "production_candidate" as const,
      receipt: structuredClone(state.receipt!),
      testEvidence: null,
    }
    : {
      admissionScope: "test_fixture" as const,
      receipt: null,
      testEvidence: structuredClone(state.testEvidence!),
    };
  return deepFreezePlatformReleaseJsonV2(snapshot);
}

export function withPlatformReleaseSourceStageForTestV2<T>(
  handle: AdmittedPlatformReleaseSourceStageV2,
  callback: (stageRoot: string) => T,
): T {
  const state = authenticState(handle);
  if (
    state.admissionScope !== "test_fixture"
    || typeof callback !== "function"
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_TEST_ONLY",
      "Source stage path access is available only to an explicit test fixture callback",
    );
  }
  const beforeFingerprint =
    captureSourceFingerprint(state.stageRoot);
  const beforeIdentity = sourceStageIdentity(
    state.stageRoot,
    state.core.source.bindingHash,
  );
  if (
    beforeFingerprint.fingerprintHash
      !== state.core.source.exportedFileTreeHash
    || beforeIdentity.identityHash
      !== state.core.stageAfter.identityHash
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_SOURCE_DRIFT",
      "Test source stage changed before callback access",
    );
  }
  const result = callback(state.stageRoot);
  const afterFingerprint =
    captureSourceFingerprint(state.stageRoot);
  const afterIdentity = sourceStageIdentity(
    state.stageRoot,
    state.core.source.bindingHash,
  );
  if (
    canonicalJsonStringify(beforeFingerprint)
      !== canonicalJsonStringify(afterFingerprint)
    || beforeIdentity.identityHash !== afterIdentity.identityHash
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_SOURCE_DRIFT",
      "Test source stage changed during callback access",
    );
  }
  return result;
}

export function disposePlatformReleaseSourceStageV2(
  handle: AdmittedPlatformReleaseSourceStageV2,
): void {
  const state = authenticState(handle);
  state.disposed = true;
  cleanupStage(state.contextRoot);
}
