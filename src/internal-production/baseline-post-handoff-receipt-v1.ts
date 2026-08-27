import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import type { BigIntStats } from "node:fs";
import { userInfo } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  validateInternalProductionSourceRunLaunchTargetReservationPairCloseV1,
  type InternalProductionCompleteZeroOwnerCensusV1,
  type InternalProductionSourceRunLaunchTargetReservationPairCloseV1,
} from "./owner-admission-v1.js";

const MAX_BUILD_TREE_DEPTH_V1 = 64;
const MAX_BUILD_INPUT_ENTRIES_V1 = 10_000;
const MAX_BUILD_OUTPUT_ENTRIES_V1 = 10_000;
const MAX_BUILD_LOCATOR_UTF8_OCTETS_V1 = 1_024;
const MAX_BUILD_FILE_BYTES_V1 = 33_554_432;
const MAX_BUILD_TOTAL_BYTES_V1 = 536_870_912;
const MAX_STITCH_CONVERTER_BYTES_V1 = 16_777_216;
const FULL_HASH = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const SHA256 = /^[a-f0-9]{64}$/;
const RFC3339_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CANONICAL_ORIGIN = "https://github.com/hikmetgulsesli/setfarm.git\n";
const COPY_STEP_ASSETS_SOURCE_SHA256_V1 = "ebc1329d163f2e3670372ba203ed98dd1d2e79c0fcaa946e364aa8db334a1a8c";
const COPY_STEP_ASSETS_SOURCE_BYTES_V1 = 1_117;
const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const GIT_ENV = Object.freeze({
  PATH: "/usr/bin:/bin",
  LANG: "C",
  LC_ALL: "C",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_NO_REPLACE_OBJECTS: "1",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_TERMINAL_PROMPT: "0",
});
const GIT_PREFIX = Object.freeze([
  "-c", "core.hooksPath=/dev/null",
  "-c", "core.fsmonitor=false",
]);
const EXACT_SCRIPTS = Object.freeze({
  prebuild: "node scripts/write-build-info.mjs --prepare && node scripts/check-version-contract.mjs && node scripts/check-english-contract.mjs && node scripts/check-path-contract.mjs && npm run check:migration-digests && npm run check:mission-control-contracts",
  build: "umask 077 && tsc -p tsconfig.json && cp src/server/index.html dist/server/index.html && cp src/installer/compat-rules.json dist/installer/compat-rules.json && mkdir -p dist/installer/prompts && cp src/installer/prompts/*.md dist/installer/prompts/ && node scripts/copy-step-assets.mjs && chmod +x dist/cli/cli.js && node scripts/inject-version.js",
  postbuild: "node scripts/write-build-info.mjs --finalize",
  "check:migration-digests": "node --import tsx scripts/check-contract-spine-migration-digests.ts --check",
  "check:mission-control-contracts": "node --import tsx scripts/mission-control-contract-artifacts.ts --check",
});
const EXACT_TSCONFIG = Object.freeze({
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    outDir: "dist",
    rootDir: "src",
    strict: true,
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    skipLibCheck: true,
    types: ["node"],
  },
  include: ["src/**/*.ts"],
});

export type InternalProductionCleanSetfarmSourceBuildV1 = Readonly<{
  branch: "main";
  clean: true;
  sha: string;
  treeHash: string;
  buildHash: string;
  originMainSha: string;
}>;

export type InternalProductionBaselineTask12P0DeliveryAuthorityV1 = Readonly<{
  schema: "setfarm.internal-production-baseline-task12-p0-delivery-authority.v1";
  deliveryCommitSha: string;
  deliveryTreeHash: string;
  deliveryAncestorOfCurrentSource: true;
  currentSourceSha: string;
  currentSourceTreeHash: string;
  currentSourceBuildHash: string;
  exact24PathBlobSetHash: string;
  focusedVerificationHash: string;
  deliveryAuthorityRef: string;
  deliveryAuthorityHash: string;
}>;

type Task12P0DeliveryConstantsV1 = Readonly<{
  deliveryCommitSha: string;
  deliveryTreeHash: string;
  orderedPathBlobs: readonly Readonly<{ path: string; blobHash: string }>[];
  orderedCommands: readonly (readonly string[])[];
  orderedTestPathBlobs: readonly Readonly<{ path: string; blobHash: string }>[];
  exitCode: 0;
  passed: true;
}>;

function task12P0DeliveryConstantsV1(): Task12P0DeliveryConstantsV1 {
  return recursivelyFreeze({
    deliveryCommitSha: "72aba7c721bffb42d3f5d7cab507360d4c588ccc",
    deliveryTreeHash: "e72a466a4db2f55015ecd3a26936b87c89d43a0e",
    orderedPathBlobs: [
      { path: "package.json", blobHash: "371d381e6837b04dc533b7a70f3682d6235853e1" },
      { path: "src/db-pg.ts", blobHash: "2d1fe1a9dbf786ee2b32a29cbdaa8db98583ec72" },
      { path: "src/execution/run-persistence.ts", blobHash: "0d563d481dd7ce4824d0d73b2aa3ad0defb7d6c3" },
      { path: "src/execution/run-terminal-transition.ts", blobHash: "4b5694b1acc7263ea7253306d0dd9a9eaf0bf1b3" },
      { path: "src/installer/run.ts", blobHash: "7a3ea511cfa4802431ed5c22d5be7f5a0b0b3bfe" },
      { path: "src/internal-production/owner-admission-v1.ts", blobHash: "f51859dd3a2fbefb79c14e011cc5647386610712" },
      { path: "src/internal-production/baseline-post-handoff-receipt-v1.ts", blobHash: "e5aa3c53d5407ad3454e88094fd7b404d9468e43" },
      { path: "src/internal-production/baseline-restart-authority-retirement-v1.ts", blobHash: "c1cf04d6e8fa124a972d87a50ff03cb973ddbf66" },
      { path: "src/internal-production/baseline-post-handoff-cli.ts", blobHash: "f6b8ae085ec4f21aaba992fe008cccead8ff2f97" },
      { path: "src/internal-production/baseline-spawner-startup-admission-v1.ts", blobHash: "8bf84adf743321e0dcddf1de84fae6c21eff590e" },
      { path: "src/internal-production/baseline-service-restart-sequence-v1.ts", blobHash: "33d2cd3750650b0645aa6a58e623770dc0f441e4" },
      { path: "src/execution/runtime-completion.ts", blobHash: "e6956fd9f705231d991538a7bc546e4d9b49a1ef" },
      { path: "src/spawner.ts", blobHash: "f04ba9c5c1283b0cb79b58a012952950a34421a5" },
      { path: "tests/internal-production/baseline-post-handoff-cli.test.ts", blobHash: "177992dff1f0f554b7026844f41f3823b003227b" },
      { path: "tests/internal-production/owner-admission-v1.test.ts", blobHash: "18cfb10973e7212e42ac452830ae59eac0fc37cd" },
      { path: "tests/internal-production/baseline-post-handoff-receipt-v1.test.ts", blobHash: "a232b52eb999004b2d28bf9dcdc5cee9c4a6a86c" },
      { path: "tests/internal-production/baseline-restart-authority-retirement-v1.test.ts", blobHash: "b468f5080d955306311a31a03c810bd1b712b26f" },
      { path: "tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts", blobHash: "a23c9b3ae853f36a97efd0523824aeb844ad5970" },
      { path: "tests/internal-production/baseline-spawner-startup-admission-v1.test.ts", blobHash: "43c3a99b49efe6cd28cfe1ad8f0ac720a4f34495" },
      { path: "tests/internal-production/baseline-service-restart-sequence-v1.test.ts", blobHash: "e717e08df2e237fd0d2cfc9cd3abf0678ce1a39f" },
      { path: "tests/execution-attempts/runtime-completion.test.ts", blobHash: "09856184cca940a2e8afb44e5111ac75d3571cba" },
      { path: "tests/execution-attempts/run-protocol.test.ts", blobHash: "c6a7e8050267cfef14b53e3348b0a6ba4602a0a8" },
      { path: "tests/execution-attempts/run-terminal-transition.test.ts", blobHash: "175a7d7870597687eaac74b522edae22c6bf367b" },
      { path: "tests/claim-log-lifecycle.test.ts", blobHash: "7d62803475e4acf06769bd0bbc623606a7ffc39b" },
    ],
    orderedCommands: [[
      "env", "-u", "SETFARM_PG_URL", "-u", "SETFARM_TEST_PG_ADMIN_URL",
      "node", "--import", "tsx", "--test", "--test-concurrency=1", "--test-name-pattern=^P4 ",
      "tests/internal-production/baseline-post-handoff-cli.test.ts",
      "tests/internal-production/owner-admission-v1.test.ts",
      "tests/internal-production/baseline-post-handoff-receipt-v1.test.ts",
      "tests/internal-production/baseline-restart-authority-retirement-v1.test.ts",
      "tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts",
      "tests/internal-production/baseline-spawner-startup-admission-v1.test.ts",
      "tests/internal-production/baseline-service-restart-sequence-v1.test.ts",
      "tests/execution-attempts/runtime-completion.test.ts",
      "tests/execution-attempts/run-protocol.test.ts",
      "tests/execution-attempts/run-terminal-transition.test.ts",
      "tests/claim-log-lifecycle.test.ts",
    ]],
    orderedTestPathBlobs: [
      { path: "tests/internal-production/baseline-post-handoff-cli.test.ts", blobHash: "177992dff1f0f554b7026844f41f3823b003227b" },
      { path: "tests/internal-production/owner-admission-v1.test.ts", blobHash: "18cfb10973e7212e42ac452830ae59eac0fc37cd" },
      { path: "tests/internal-production/baseline-post-handoff-receipt-v1.test.ts", blobHash: "a232b52eb999004b2d28bf9dcdc5cee9c4a6a86c" },
      { path: "tests/internal-production/baseline-restart-authority-retirement-v1.test.ts", blobHash: "b468f5080d955306311a31a03c810bd1b712b26f" },
      { path: "tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts", blobHash: "a23c9b3ae853f36a97efd0523824aeb844ad5970" },
      { path: "tests/internal-production/baseline-spawner-startup-admission-v1.test.ts", blobHash: "43c3a99b49efe6cd28cfe1ad8f0ac720a4f34495" },
      { path: "tests/internal-production/baseline-service-restart-sequence-v1.test.ts", blobHash: "e717e08df2e237fd0d2cfc9cd3abf0678ce1a39f" },
      { path: "tests/execution-attempts/runtime-completion.test.ts", blobHash: "09856184cca940a2e8afb44e5111ac75d3571cba" },
      { path: "tests/execution-attempts/run-protocol.test.ts", blobHash: "c6a7e8050267cfef14b53e3348b0a6ba4602a0a8" },
      { path: "tests/execution-attempts/run-terminal-transition.test.ts", blobHash: "175a7d7870597687eaac74b522edae22c6bf367b" },
      { path: "tests/claim-log-lifecycle.test.ts", blobHash: "7d62803475e4acf06769bd0bbc623606a7ffc39b" },
    ],
    exitCode: 0,
    passed: true,
  });
}

export type InternalProductionRecoverySourceBootstrapPendingInputV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-source-bootstrap-pending-input.v1";
  purpose: "recovery-d-source-delivery-v1";
  repository: "setfarm";
  workflow: "feature-dev";
  protocol: "v3";
  promptManifestHash: string;
  pendingInputRef: string;
  pendingInputHash: string;
}>;

export type InternalProductionRecoverySourceBootstrapOperationV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-source-bootstrap-operation.v1";
  purpose: "recovery-d-source-delivery-v1";
  repository: "setfarm";
  workflow: "feature-dev";
  protocol: "v3";
  promptManifestHash: string;
  pendingInputRef: string;
  pendingInputHash: string;
  baseSourceSha: string;
  baseSourceTreeHash: string;
  buildHash: string;
  activationPreflightHash: string;
  releaseAdmissionHash: string;
  targetSourceRunReservationRef: string;
  targetSourceRunReservationHash: string;
  targetRunReservationRef: string;
  targetRunReservationHash: string;
  targetRunLaunchCompositeHash: string;
  ownerAdmissionFenceRef: string;
  ownerAdmissionFenceHash: string;
  startIntentRef: string;
  startIntentHash: string;
  startOutboxRef: string;
  startOutboxHash: string;
  operationRef: string;
  operationHash: string;
}>;

export type InternalProductionRecoverySourceBootstrapRunReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-source-bootstrap-run-receipt.v1";
  purpose: "recovery-d-source-delivery-v1";
  pendingInputRef: string; pendingInputHash: string;
  operationRef: string; operationHash: string;
  targetSourceRunReservationRef: string; targetSourceRunReservationHash: string;
  targetRunReservationRef: string; targetRunReservationHash: string;
  targetRunLaunchCompositeHash: string;
  ownerAdmissionFenceRef: string; ownerAdmissionFenceHash: string;
  startIntentRef: string; startIntentHash: string;
  startOutboxRef: string; startOutboxHash: string;
  runId: string;
  operationRunBindingHash: string; reciprocalRunOperationBindingHash: string;
  terminalOwnerRef: string; terminalOwnerHash: string;
  terminalSourceRunRef: string; terminalSourceRunHash: string;
  terminalRunLaunchRef: string; terminalRunLaunchHash: string;
  targetReservationPairCloseRef: string; targetReservationPairCloseHash: string;
  fenceReleaseRef: string; fenceReleaseHash: string;
  sourceRunRef: string; sourceRunHash: string;
}>;

export type InternalProductionRecoverySourceRunTerminalAuthorityV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-source-run-terminal-authority.v1";
  operationRef: string; operationHash: string;
  targetSourceRunReservationRef: string; targetSourceRunReservationHash: string;
  targetRunLaunchCompositeHash: string; runId: string;
  operationRunBindingHash: string; reciprocalRunOperationBindingHash: string;
  unrelatedReservationCount: 0; unrelatedOwnerCount: 0;
  terminalOwnerRef: string; terminalOwnerHash: string;
  terminalSourceRunRef: string; terminalSourceRunHash: string;
}>;

export type InternalProductionRecoveryRunLaunchTerminalAuthorityV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-run-launch-terminal-authority.v1";
  operationRef: string; operationHash: string;
  targetRunReservationRef: string; targetRunReservationHash: string;
  targetRunLaunchCompositeHash: string; runId: string;
  operationRunBindingHash: string; reciprocalRunOperationBindingHash: string;
  runReservationTerminalOwnerRef: string; runReservationTerminalOwnerHash: string;
  terminalRunLaunchRef: string; terminalRunLaunchHash: string;
}>;

export type InternalProductionRecoverySourceBootstrapStatusV1 = Readonly<Record<string, unknown>> &
  Readonly<{ state: "absent" | "pending-input" | "prepared" | "recovery-required" | "terminal"; statusHash: string }>;

type DirectoryIdentityV1 = Readonly<{
  realpath: string;
  devDecimal: string;
  inoDecimal: string;
  mode: number;
}>;

type DirectorySnapshot = Readonly<{
  identity: DirectoryIdentityV1;
  device: bigint;
}>;

type PinnedEntry = Readonly<{
  locator: string;
  gitMode: "100644" | "100755";
  gitBlobHash: string;
}>;

type PinnedSet = Readonly<{
  schema: "setfarm.internal-production-pinned-build-input-set.v1";
  sourceSha: string;
  sourceTreeHash: string;
  entries: readonly PinnedEntry[];
  buildInputSetHash: string;
  blobs: ReadonlyMap<string, Buffer>;
}>;

type SourceObservation = Readonly<{
  pinned: PinnedSet;
  originMainSha: string;
  repository: DirectorySnapshot;
  packageVersion: string;
  outputs: readonly string[];
  directories: readonly string[];
}>;

type StableRegular = Readonly<{
  bytes: Buffer;
  mode: number;
  stats: BigIntStats;
}>;

type FileSnapshot = Readonly<{
  locator: string;
  observed: StableRegular;
}>;

function fail(message: string): never {
  throw new Error(`INTERNAL_PRODUCTION_SETFARM_SOURCE_BUILD_INVALID:${message}`);
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalComparable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalComparable).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalComparable(record[key])}`).join(",")}}`;
}

function compareBytes(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function strictUtf8(bytes: Buffer, label: string): string {
  let text: string;
  try {
    text = UTF8.decode(bytes);
  } catch {
    return fail(`${label} is not strict UTF-8`);
  }
  if (!Buffer.from(text, "utf8").equals(bytes)) fail(`${label} does not round-trip as UTF-8`);
  return text;
}

function canonicalLocator(locator: string): string {
  const segments = locator.split("/");
  if (segments.length - 1 > MAX_BUILD_TREE_DEPTH_V1) fail(`build locator exceeds the depth cap: ${JSON.stringify(locator)}`);
  if (
    !locator
    || locator !== locator.normalize("NFC")
    || Buffer.byteLength(locator, "utf8") > MAX_BUILD_LOCATOR_UTF8_OCTETS_V1
    || locator.startsWith("/")
    || locator.includes("\\")
    || /[\0-\x1f\x7f-\x9f]/.test(locator)
    || segments.some((segment) => !segment || segment === "." || segment === "..")
  ) fail(`noncanonical locator ${JSON.stringify(locator)}`);
  return locator;
}

function directorySnapshot(directoryPath: string, label: string, expectedDevice?: bigint): DirectorySnapshot {
  const real = realpathSync(directoryPath);
  const stats = lstatSync(directoryPath, { bigint: true });
  if (!stats.isDirectory() || stats.isSymbolicLink() || real !== directoryPath) fail(`${label} must be one real directory`);
  if (expectedDevice !== undefined && stats.dev !== expectedDevice) fail(`${label} is on the wrong device`);
  return Object.freeze({
    identity: Object.freeze({
      realpath: real,
      devDecimal: stats.dev.toString(10),
      inoDecimal: stats.ino.toString(10),
      mode: Number(stats.mode & 0o7777n),
    }),
    device: stats.dev,
  });
}

function sameDirectory(left: DirectoryIdentityV1, right: DirectoryIdentityV1): boolean {
  return left.realpath === right.realpath
    && left.devDecimal === right.devDecimal
    && left.inoDecimal === right.inoDecimal
    && left.mode === right.mode;
}

function assertDirectory(directoryPath: string, expected: DirectorySnapshot, label: string): void {
  const observed = directorySnapshot(directoryPath, label, expected.device);
  if (!sameDirectory(observed.identity, expected.identity)) fail(`${label} identity changed`);
}

function sameRegularMetadata(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function runGit(root: string, args: readonly string[], acceptedStatuses: readonly number[] = [0], input?: Buffer) {
  const result = spawnSync("/usr/bin/git", [...GIT_PREFIX, ...args], {
    cwd: root,
    env: GIT_ENV,
    shell: false,
    input,
    timeout: 60_000,
    maxBuffer: MAX_BUILD_TOTAL_BYTES_V1 + 8 * 1024 * 1024,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? "");
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.from(result.stderr ?? "");
  if (
    result.error
    || result.status === null
    || !acceptedStatuses.includes(result.status)
    || result.signal
    || stderr.length !== 0
  ) fail(`Git command failed (${args.join(" ")})`);
  return Object.freeze({ status: result.status, stdout });
}

function gitLine(root: string, args: readonly string[], label: string): string {
  const text = strictUtf8(runGit(root, args).stdout, label);
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n") || text.slice(0, -1).includes("\r")) {
    fail(`${label} must be exactly one line`);
  }
  return text.slice(0, -1);
}

function fixedRepositoryRoot(): string {
  const modulePath = realpathSync(fileURLToPath(import.meta.url));
  const expectedBasenames = new Set([
    "baseline-post-handoff-receipt-v1.ts",
    "baseline-post-handoff-receipt-v1.js",
  ]);
  if (!expectedBasenames.has(path.basename(modulePath))) fail("observer module basename is not code-owned");
  const internalProduction = path.dirname(modulePath);
  if (path.basename(internalProduction) !== "internal-production") fail("observer module directory is invalid");
  const sourceOrDist = path.dirname(internalProduction);
  if (!["src", "dist"].includes(path.basename(sourceOrDist))) fail("observer module is outside src/dist");
  return realpathSync(path.dirname(sourceOrDist));
}

function fixedWorkspaceAuthorityPathV1(...segments: string[]): string {
  const relative = segments.join("/");
  if (
    segments.length === 0
    || path.isAbsolute(relative)
    || relative.includes("\\")
    || path.posix.normalize(relative) !== relative
    || !relative.startsWith("data/internal-production-baseline/")
    || relative.split("/").some((segment) => segment.length === 0 || segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment))
  ) fail("workspace authority locator is not code-owned");
  const repository = fixedRepositoryRoot();
  const workspace = path.dirname(repository);
  const target = path.resolve(workspace, ...segments);
  const workspaceRelative = path.relative(workspace, target);
  const repositoryRelative = path.relative(repository, target);
  if (
    workspaceRelative === ""
    || workspaceRelative === ".."
    || workspaceRelative.startsWith(`..${path.sep}`)
    || path.isAbsolute(workspaceRelative)
    || (repositoryRelative !== ".." && !repositoryRelative.startsWith(`..${path.sep}`))
  ) fail("workspace authority locator escapes its sibling root");
  return target;
}

function readStableRegular(
  filePath: string,
  maxBytes: number,
  device: bigint,
  expectedLinkCount = 1,
): StableRegular {
  const parentPath = path.dirname(filePath);
  const parentBefore = directorySnapshot(parentPath, `parent of ${filePath}`, device);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.dev !== device || before.nlink !== BigInt(expectedLinkCount)) {
      fail(`${filePath} is not one same-device regular link-count-${expectedLinkCount} file`);
    }
    if (before.size > BigInt(maxBytes)) fail(`${filePath} exceeds the file cap`);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (
      before.dev !== after.dev
      || before.ino !== after.ino
      || before.mode !== after.mode
      || before.nlink !== after.nlink
      || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs
      || before.ctimeNs !== after.ctimeNs
      || BigInt(bytes.length) !== after.size
    ) fail(`${filePath} changed during read`);
    const reopened = lstatSync(filePath, { bigint: true });
    if (reopened.isSymbolicLink() || !reopened.isFile() || reopened.dev !== after.dev || reopened.ino !== after.ino) {
      fail(`${filePath} changed before reopen`);
    }
    assertDirectory(parentPath, parentBefore, `parent of ${filePath}`);
    const secondDescriptor = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const secondBefore = fstatSync(secondDescriptor, { bigint: true });
      if (!secondBefore.isFile() || !sameRegularMetadata(after, secondBefore)) fail(`${filePath} changed before second open`);
      const secondBytes = readFileSync(secondDescriptor);
      const secondAfter = fstatSync(secondDescriptor, { bigint: true });
      if (!sameRegularMetadata(secondBefore, secondAfter) || BigInt(secondBytes.length) !== secondAfter.size || !secondBytes.equals(bytes)) {
        fail(`${filePath} changed during second read`);
      }
      const secondReopen = lstatSync(filePath, { bigint: true });
      if (secondReopen.isSymbolicLink() || !secondReopen.isFile() || !sameRegularMetadata(secondAfter, secondReopen)) {
        fail(`${filePath} changed after second read`);
      }
      assertDirectory(parentPath, parentBefore, `parent of ${filePath}`);
      return Object.freeze({ bytes: secondBytes, mode: Number(secondAfter.mode & 0o7777n), stats: secondAfter });
    } finally {
      closeSync(secondDescriptor);
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function readPinnedBlobs(root: string, entries: readonly PinnedEntry[]): ReadonlyMap<string, Buffer> {
  const input = Buffer.from(`${entries.map((entry) => entry.gitBlobHash).join("\n")}\n`, "ascii");
  const output = runGit(root, ["cat-file", "--batch"], [0], input).stdout;
  const blobs = new Map<string, Buffer>();
  let offset = 0;
  for (const entry of entries) {
    const newline = output.indexOf(0x0a, offset);
    if (newline < 0) fail("Git blob batch header is truncated");
    const match = /^([a-f0-9]{40}|[a-f0-9]{64}) blob ([0-9]+)$/.exec(output.subarray(offset, newline).toString("ascii"));
    if (!match || match[1] !== entry.gitBlobHash) fail("Git blob batch returned the wrong object");
    const size = Number(match[2]);
    if (!Number.isSafeInteger(size) || size > MAX_BUILD_FILE_BYTES_V1) fail("Pinned Git blob exceeds its cap");
    const start = newline + 1;
    const end = start + size;
    if (end >= output.length || output[end] !== 0x0a) fail("Git blob batch body is truncated");
    blobs.set(entry.gitBlobHash, Buffer.from(output.subarray(start, end)));
    offset = end + 1;
  }
  if (offset !== output.length) fail("Git blob batch emitted trailing bytes");
  return blobs;
}

function derivePinnedSet(root: string): PinnedSet {
  const sourceSha = gitLine(root, ["rev-parse", "--verify", "HEAD^{commit}"], "HEAD commit");
  const sourceTreeHash = gitLine(root, ["rev-parse", "--verify", "HEAD^{tree}"], "HEAD tree");
  if (!FULL_HASH.test(sourceSha) || !FULL_HASH.test(sourceTreeHash) || sourceSha.length !== sourceTreeHash.length) {
    fail("HEAD commit/tree hashes are invalid");
  }
  const listingBytes = runGit(root, ["ls-tree", "-r", "-z", "--full-tree", sourceSha]).stdout;
  const records = strictUtf8(listingBytes, "Git tree listing").split("\0");
  if (records.pop() !== "") fail("Git tree listing has no terminal NUL");
  if (records.length > MAX_BUILD_INPUT_ENTRIES_V1) fail("Pinned input set exceeds the entry cap");
  const entries = records.map((record): PinnedEntry => {
    const tab = record.indexOf("\t");
    const header = tab < 0 ? [] : record.slice(0, tab).split(" ");
    const locator = tab < 0 ? "" : canonicalLocator(record.slice(tab + 1));
    if (
      header.length !== 3
      || (header[0] !== "100644" && header[0] !== "100755")
      || header[1] !== "blob"
      || !FULL_HASH.test(header[2] ?? "")
    ) fail(`unsupported tracked Git entry ${record.slice(0, 200)}`);
    return Object.freeze({ locator, gitMode: header[0], gitBlobHash: header[2]! });
  }).sort((left, right) => compareBytes(left.locator, right.locator));
  const raw = new Set<string>();
  const folded = new Set<string>();
  for (const entry of entries) {
    const fold = entry.locator.normalize("NFC").toLocaleLowerCase("en-US");
    if (raw.has(entry.locator) || folded.has(fold)) fail(`colliding pinned locator ${entry.locator}`);
    raw.add(entry.locator);
    folded.add(fold);
  }
  const blobs = readPinnedBlobs(root, entries);
  let totalBytes = 0;
  for (const entry of entries) {
    totalBytes += blobs.get(entry.gitBlobHash)!.length;
    if (totalBytes > MAX_BUILD_TOTAL_BYTES_V1) fail("Pinned input set exceeds the total-byte cap");
  }
  const body = Object.freeze({
    schema: "setfarm.internal-production-pinned-build-input-set.v1" as const,
    sourceSha,
    sourceTreeHash,
    entries,
  });
  return Object.freeze({ ...body, buildInputSetHash: hashCanonicalJson(body), blobs });
}

function verifyLiveInputs(root: string, pinned: PinnedSet, device: bigint): void {
  for (const entry of pinned.entries) {
    const filePath = path.join(root, ...entry.locator.split("/"));
    if (!filePath.startsWith(`${root}${path.sep}`)) fail("Pinned input escaped the repository");
    const observed = readStableRegular(filePath, MAX_BUILD_FILE_BYTES_V1, device);
    const expectedMode = entry.gitMode === "100755" ? 0o755 : 0o644;
    if (observed.mode !== expectedMode) fail(`live tracked mode differs from pinned Git mode: ${entry.locator}`);
    if (!observed.bytes.equals(pinned.blobs.get(entry.gitBlobHash)!)) {
      fail(`live tracked bytes do not match pinned Git blob: ${entry.locator}`);
    }
  }
}

function pinnedJson(pinned: PinnedSet, locator: string): Record<string, unknown> {
  const entry = pinned.entries.find((candidate) => candidate.locator === locator);
  if (!entry) fail(`Pinned input lacks ${locator}`);
  let value: unknown;
  try {
    value = JSON.parse(strictUtf8(pinned.blobs.get(entry.gitBlobHash)!, locator));
  } catch {
    return fail(`${locator} is not strict JSON`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${locator} is not one object`);
  return value as Record<string, unknown>;
}

function verifyTopology(pinned: PinnedSet): string {
  const pkg = pinnedJson(pinned, "package.json");
  const scripts = pkg.scripts as Record<string, unknown> | undefined;
  for (const [name, expected] of Object.entries(EXACT_SCRIPTS)) {
    if (scripts?.[name] !== expected) fail(`package build topology differs at ${name}`);
  }
  if (typeof pkg.version !== "string" || pkg.version.length === 0) fail("package version is invalid");
  if (canonicalComparable(pinnedJson(pinned, "tsconfig.json")) !== canonicalComparable(EXACT_TSCONFIG)) {
    fail("tsconfig build topology differs");
  }
  const ignoreEntry = pinned.entries.find((entry) => entry.locator === ".gitignore");
  if (!ignoreEntry) fail("Pinned input lacks .gitignore");
  const ignoreText = strictUtf8(pinned.blobs.get(ignoreEntry.gitBlobHash)!, ".gitignore");
  if (ignoreText.split("\n").filter((line) => line === ".setfarm/").length !== 1) {
    fail(".gitignore must contain the exact .setfarm/ rule once");
  }
  const copyStepEntry = pinned.entries.find((entry) => entry.locator === "scripts/copy-step-assets.mjs");
  if (!copyStepEntry || copyStepEntry.gitMode !== "100755") fail("Pinned copy-step-assets source is missing or non-executable");
  const copyStepBytes = pinned.blobs.get(copyStepEntry.gitBlobHash)!;
  if (
    copyStepBytes.length !== COPY_STEP_ASSETS_SOURCE_BYTES_V1
    || sha256(copyStepBytes) !== COPY_STEP_ASSETS_SOURCE_SHA256_V1
  ) fail("copy-step-assets recursive Markdown topology semantic/source projection differs");
  return pkg.version;
}

function expectedTopology(pinned: PinnedSet): Readonly<{ outputs: readonly string[]; directories: readonly string[] }> {
  const outputs: string[] = [];
  for (const entry of pinned.entries) {
    const locator = entry.locator;
    if (locator.startsWith("src/") && locator.endsWith(".ts") && !/\.(?:d|m|c)\.ts$/.test(locator)) {
      outputs.push(`dist/${locator.slice(4, -3)}.js`);
    } else if (locator === "src/server/index.html" || locator === "src/installer/compat-rules.json") {
      outputs.push(`dist/${locator.slice(4)}`);
    } else if (/^src\/installer\/prompts\/[^/]+\.md$/.test(locator) || /^src\/installer\/steps\/.+\.md$/.test(locator)) {
      outputs.push(`dist/${locator.slice(4)}`);
    }
  }
  outputs.sort(compareBytes);
  const seen = new Set<string>();
  const folded = new Set<string>();
  for (const locator of outputs) {
    canonicalLocator(locator);
    const fold = locator.normalize("NFC").toLocaleLowerCase("en-US");
    if (seen.has(locator) || folded.has(fold)) fail(`colliding expected output ${locator}`);
    seen.add(locator);
    folded.add(fold);
  }
  if (!seen.has("dist/cli/cli.js")) fail("expected output topology lacks the CLI");
  const directories = new Set<string>();
  for (const locator of outputs) {
    let parent = path.posix.dirname(locator);
    while (parent !== "dist" && parent !== ".") {
      directories.add(parent);
      parent = path.posix.dirname(parent);
    }
  }
  if (outputs.length + directories.size + 4 > MAX_BUILD_OUTPUT_ENTRIES_V1) {
    fail("derived output file/directory closure exceeds the combined output-entry cap");
  }
  return Object.freeze({ outputs: Object.freeze(outputs), directories: Object.freeze([...directories].sort(compareBytes)) });
}

function observeSource(root: string): SourceObservation {
  const repository = directorySnapshot(root, "Setfarm repository");
  if ((repository.identity.mode & 0o022) !== 0) fail("Setfarm repository is group/world-writable");
  const topLevel = gitLine(root, ["rev-parse", "--show-toplevel"], "Git top-level");
  if (realpathSync(topLevel) !== root) fail("observer module root differs from Git top-level");
  const include = runGit(root, ["config", "--local", "--no-includes", "--name-only", "--get-regexp", "^include"], [0, 1]);
  if (include.status !== 1 || include.stdout.length !== 0) fail("local Git include/includeIf configuration is forbidden");
  const origin = runGit(root, ["config", "--local", "--no-includes", "--get-all", "remote.origin.url"]);
  if (!origin.stdout.equals(Buffer.from(CANONICAL_ORIGIN, "utf8"))) fail("canonical origin must have exactly one byte-identical value");
  if (gitLine(root, ["branch", "--show-current"], "current branch") !== "main") fail("current branch is not main");
  if (runGit(root, ["status", "--porcelain=v2", "--untracked-files=all"]).stdout.length !== 0) fail("current Setfarm worktree is dirty");
  const pinned = derivePinnedSet(root);
  const originMainSha = gitLine(root, ["rev-parse", "--verify", "refs/remotes/origin/main^{commit}"], "origin/main commit");
  if (originMainSha !== pinned.sourceSha) fail("HEAD does not equal origin/main");
  verifyLiveInputs(root, pinned, repository.device);
  const packageVersion = verifyTopology(pinned);
  const topology = expectedTopology(pinned);
  assertDirectory(root, repository, "Setfarm repository");
  return Object.freeze({ pinned, originMainSha, repository, packageVersion, ...topology });
}

function strictObject(
  bytes: Buffer,
  keys: readonly string[],
  label: string,
  pretty: boolean,
): Record<string, unknown> {
  const text = strictUtf8(bytes, label);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fail(`${label} is not JSON`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} is not one object`);
  const record = value as Record<string, unknown>;
  if (canonicalComparable(Object.keys(record)) !== canonicalComparable(keys)) fail(`${label} has unknown, missing, or reordered fields`);
  const exact = `${JSON.stringify(record, null, pretty ? 2 : undefined)}\n`;
  if (text !== exact) fail(`${label} raw bytes are not exact`);
  return record;
}

function expectedManifest(source: SourceObservation): Record<string, unknown> {
  const entry = source.pinned.entries.find((candidate) => candidate.locator === "scripts/stitch-to-jsx.mjs");
  if (!entry || entry.gitMode !== "100644") fail("Pinned Stitch converter is missing or executable");
  const bytes = source.pinned.blobs.get(entry.gitBlobHash)!;
  if (bytes.length < 1 || bytes.length > MAX_STITCH_CONVERTER_BYTES_V1) fail("Pinned Stitch converter has invalid size");
  strictUtf8(bytes, "Pinned Stitch converter");
  return {
    schema: "setfarm.platform-release-manifest.v1",
    releaseSha: source.pinned.sourceSha,
    branch: "main",
    dirty: false,
    stitchConverter: {
      converterId: "setfarm.stitch-to-jsx",
      source: {
        schema: "setfarm.source-artifact-ref.v1",
        hash: sha256(bytes),
        mediaType: "text/javascript",
        locator: "scripts/stitch-to-jsx.mjs",
        byteLength: bytes.length,
      },
    },
  };
}

function observeArtifacts(root: string, source: SourceObservation): Readonly<{
  buildInfo: Record<string, unknown>;
  outputTree: Record<string, unknown>;
  manifest: Record<string, unknown>;
  buildHash: string;
  bytes: readonly Buffer[];
  fileSnapshots: readonly FileSnapshot[];
  dist: DirectorySnapshot;
  directoryIdentities: readonly Readonly<{ locator: string; snapshot: DirectorySnapshot }>[];
}> {
  const distPath = path.join(root, "dist");
  const dist = directorySnapshot(distPath, "finalized dist", source.repository.device);
  if (dist.identity.mode !== 0o755) fail("finalized dist has wrong mode");
  let entryCount = 0;
  let totalBytes = 0;
  const files: string[] = [];
  const enumeratedFiles = new Map<string, StableRegular>();
  const directories: string[] = [];
  const directoryIdentities: Array<Readonly<{ locator: string; snapshot: DirectorySnapshot }>> = [];
  function visit(directoryPath: string, relative: string, depth: number): void {
    if (depth > MAX_BUILD_TREE_DEPTH_V1) fail("finalized dist exceeds depth cap");
    for (const name of readdirSync(directoryPath).sort(compareBytes)) {
      entryCount += 1;
      if (entryCount > MAX_BUILD_OUTPUT_ENTRIES_V1) fail("finalized dist exceeds entry cap");
      const locator = relative ? `${relative}/${name}` : `dist/${name}`;
      canonicalLocator(locator);
      const child = path.join(directoryPath, name);
      const stats = lstatSync(child, { bigint: true });
      if (stats.dev !== source.repository.device || stats.isSymbolicLink()) fail(`invalid finalized dist entry ${locator}`);
      if (stats.isDirectory()) {
        const identity = directorySnapshot(child, locator, source.repository.device);
        if (identity.identity.mode !== 0o755) fail(`wrong finalized directory mode ${locator}`);
        directories.push(locator);
        directoryIdentities.push(Object.freeze({ locator, snapshot: identity }));
        visit(child, locator, depth + 1);
      } else if (stats.isFile()) {
        if (stats.nlink !== 1n || stats.size > BigInt(MAX_BUILD_FILE_BYTES_V1)) fail(`invalid finalized file ${locator}`);
        const observed = readStableRegular(child, MAX_BUILD_FILE_BYTES_V1, source.repository.device);
        totalBytes += observed.bytes.length;
        if (totalBytes > MAX_BUILD_TOTAL_BYTES_V1) fail("finalized dist exceeds total-byte cap");
        files.push(locator);
        enumeratedFiles.set(locator, observed);
      } else fail(`special finalized dist entry ${locator}`);
    }
  }
  visit(distPath, "", 0);
  directories.sort(compareBytes);
  if (canonicalComparable(directories) !== canonicalComparable(source.directories)) fail("finalized directory topology is not exact");
  const expectedFiles = [...source.outputs, "dist/BUILD_INFO.json", "dist/PLATFORM_BUILD_OUTPUT_TREE.json", "dist/PLATFORM_RELEASE_MANIFEST.json"].sort(compareBytes);
  files.sort(compareBytes);
  if (canonicalComparable(files) !== canonicalComparable(expectedFiles)) fail("finalized file topology is not exact");

  const ordinarySnapshots: FileSnapshot[] = [];
  const outputEntries = source.outputs.map((locator) => {
    const observed = readStableRegular(path.join(root, ...locator.split("/")), MAX_BUILD_FILE_BYTES_V1, source.repository.device);
    const enumerated = enumeratedFiles.get(locator);
    if (!enumerated || !sameRegularMetadata(observed.stats, enumerated.stats) || !observed.bytes.equals(enumerated.bytes)) {
      fail(`ordinary output changed after enumeration ${locator}`);
    }
    const expectedMode = locator === "dist/cli/cli.js" ? 0o755 : 0o644;
    if (observed.mode !== expectedMode) fail(`wrong ordinary output mode ${locator}`);
    ordinarySnapshots.push(Object.freeze({ locator, observed }));
    return Object.freeze({ locator, mode: expectedMode, byteLength: observed.bytes.length, sha256: sha256(observed.bytes) });
  });

  const infoObserved = readStableRegular(path.join(distPath, "BUILD_INFO.json"), MAX_BUILD_FILE_BYTES_V1, source.repository.device);
  const enumeratedInfo = enumeratedFiles.get("dist/BUILD_INFO.json");
  if (!enumeratedInfo || !sameRegularMetadata(infoObserved.stats, enumeratedInfo.stats) || !infoObserved.bytes.equals(enumeratedInfo.bytes)) {
    fail("BUILD_INFO changed after enumeration");
  }
  if (infoObserved.mode !== 0o444) fail("BUILD_INFO has wrong mode");
  const buildInfo = strictObject(infoObserved.bytes, ["sha", "shortSha", "branch", "dirty", "packageVersion", "displayVersion", "builtAt"], "BUILD_INFO", true);
  if (
    buildInfo.sha !== source.pinned.sourceSha
    || buildInfo.shortSha !== source.pinned.sourceSha.slice(0, 8)
    || buildInfo.branch !== "main"
    || buildInfo.dirty !== false
    || buildInfo.packageVersion !== source.packageVersion
    || buildInfo.displayVersion !== `${source.packageVersion}+${source.pinned.sourceSha.slice(0, 8)}`
    || typeof buildInfo.builtAt !== "string"
    || !RFC3339_MILLIS.test(buildInfo.builtAt)
    || new Date(buildInfo.builtAt).toISOString() !== buildInfo.builtAt
  ) fail("BUILD_INFO fields are invalid");

  const outputObserved = readStableRegular(path.join(distPath, "PLATFORM_BUILD_OUTPUT_TREE.json"), MAX_BUILD_FILE_BYTES_V1, source.repository.device);
  const enumeratedOutputTree = enumeratedFiles.get("dist/PLATFORM_BUILD_OUTPUT_TREE.json");
  if (!enumeratedOutputTree || !sameRegularMetadata(outputObserved.stats, enumeratedOutputTree.stats) || !outputObserved.bytes.equals(enumeratedOutputTree.bytes)) {
    fail("output tree changed after enumeration");
  }
  if (outputObserved.mode !== 0o444) fail("output tree has wrong mode");
  const outputTree = strictObject(outputObserved.bytes, ["schema", "sourceSha", "sourceTreeHash", "entries", "outputTreeHash"], "output tree", false);
  if (
    outputTree.schema !== "setfarm.platform-build-output-tree.v1"
    || outputTree.sourceSha !== source.pinned.sourceSha
    || outputTree.sourceTreeHash !== source.pinned.sourceTreeHash
    || !Array.isArray(outputTree.entries)
    || canonicalComparable(outputTree.entries) !== canonicalComparable(outputEntries)
    || typeof outputTree.outputTreeHash !== "string"
    || !SHA256.test(outputTree.outputTreeHash)
  ) fail("output tree fields or entries are invalid");
  for (const entry of outputTree.entries) {
    if (
      !entry
      || typeof entry !== "object"
      || Array.isArray(entry)
      || canonicalComparable(Object.keys(entry as Record<string, unknown>))
        !== canonicalComparable(["locator", "mode", "byteLength", "sha256"])
    ) fail("output tree entry has unknown, missing, or reordered fields");
  }
  const outputProjection = {
    schema: outputTree.schema,
    sourceSha: outputTree.sourceSha,
    sourceTreeHash: outputTree.sourceTreeHash,
    entries: outputTree.entries,
  };
  if (outputTree.outputTreeHash !== hashCanonicalJson(outputProjection)) fail("output tree hash is invalid");

  const manifestObserved = readStableRegular(path.join(distPath, "PLATFORM_RELEASE_MANIFEST.json"), MAX_BUILD_FILE_BYTES_V1, source.repository.device);
  const enumeratedManifest = enumeratedFiles.get("dist/PLATFORM_RELEASE_MANIFEST.json");
  if (!enumeratedManifest || !sameRegularMetadata(manifestObserved.stats, enumeratedManifest.stats) || !manifestObserved.bytes.equals(enumeratedManifest.bytes)) {
    fail("release manifest changed after enumeration");
  }
  if (manifestObserved.mode !== 0o444) fail("release manifest has wrong mode");
  const manifest = strictObject(manifestObserved.bytes, ["schema", "releaseSha", "branch", "dirty", "stitchConverter"], "release manifest", false);
  const manifestCandidate = expectedManifest(source);
  const expectedManifestBytes = Buffer.from(`${JSON.stringify(manifestCandidate)}\n`, "utf8");
  if (!manifestObserved.bytes.equals(expectedManifestBytes) || canonicalComparable(manifest) !== canonicalComparable(manifestCandidate)) {
    fail("release manifest bytes differ from pinned source authority");
  }

  const stableBuildInfo = {
    schema: "setfarm.internal-production-stable-setfarm-build-info.v1",
    sha: buildInfo.sha,
    shortSha: buildInfo.shortSha,
    branch: buildInfo.branch,
    dirty: buildInfo.dirty,
    packageVersion: buildInfo.packageVersion,
    displayVersion: buildInfo.displayVersion,
  };
  const buildHash = hashCanonicalJson({
    schema: "setfarm.internal-production-controller-build.v1",
    stableBuildInfo,
    buildInputSetHash: source.pinned.buildInputSetHash,
    outputTreeHash: outputTree.outputTreeHash,
    releaseManifestHash: hashCanonicalJson(manifest),
  });
  const fileSnapshots = Object.freeze([
    ...ordinarySnapshots,
    Object.freeze({ locator: "dist/BUILD_INFO.json", observed: infoObserved }),
    Object.freeze({ locator: "dist/PLATFORM_BUILD_OUTPUT_TREE.json", observed: outputObserved }),
    Object.freeze({ locator: "dist/PLATFORM_RELEASE_MANIFEST.json", observed: manifestObserved }),
  ].sort((left, right) => compareBytes(left.locator, right.locator)));
  const stableTotalBytes = fileSnapshots.reduce((sum, snapshot) => sum + snapshot.observed.bytes.length, 0);
  if (stableTotalBytes !== totalBytes || stableTotalBytes > MAX_BUILD_TOTAL_BYTES_V1) {
    fail("finalized file totals changed across stable reads");
  }
  for (const item of directoryIdentities) {
    assertDirectory(path.join(root, ...item.locator.split("/")), item.snapshot, item.locator);
  }
  assertDirectory(distPath, dist, "finalized dist");
  return Object.freeze({
    buildInfo,
    outputTree,
    manifest,
    buildHash,
    bytes: Object.freeze([infoObserved.bytes, outputObserved.bytes, manifestObserved.bytes]),
    fileSnapshots,
    dist,
    directoryIdentities: Object.freeze(directoryIdentities),
  });
}

/** Observes only the code-relative current clean Setfarm checkout and build. */
export function observeCurrentInternalProductionCleanSetfarmSourceBuildV1(): InternalProductionCleanSetfarmSourceBuildV1 {
  const root = fixedRepositoryRoot();
  const before = observeSource(root);
  const artifactsBefore = observeArtifacts(root, before);
  const after = observeSource(root);
  if (
    after.pinned.sourceSha !== before.pinned.sourceSha
    || after.pinned.sourceTreeHash !== before.pinned.sourceTreeHash
    || after.pinned.buildInputSetHash !== before.pinned.buildInputSetHash
    || after.originMainSha !== before.originMainSha
  ) fail("source authority changed across artifact observation");
  const artifactsAfter = observeArtifacts(root, after);
  for (let index = 0; index < artifactsBefore.bytes.length; index += 1) {
    if (!artifactsBefore.bytes[index]!.equals(artifactsAfter.bytes[index]!)) fail("artifact authority changed across observation");
  }
  if (artifactsAfter.buildHash !== artifactsBefore.buildHash) fail("controller build hash changed across observation");
  if (artifactsBefore.fileSnapshots.length !== artifactsAfter.fileSnapshots.length) {
    fail("finalized file snapshots changed across observation");
  }
  for (let index = 0; index < artifactsBefore.fileSnapshots.length; index += 1) {
    const left = artifactsBefore.fileSnapshots[index]!;
    const right = artifactsAfter.fileSnapshots[index]!;
    if (
      left.locator !== right.locator
      || !sameRegularMetadata(left.observed.stats, right.observed.stats)
      || !left.observed.bytes.equals(right.observed.bytes)
    ) fail("finalized ordinary/authority file snapshots changed across observation");
  }
  if (artifactsBefore.directoryIdentities.length !== artifactsAfter.directoryIdentities.length) {
    fail("finalized directory identities changed across observation");
  }
  for (let index = 0; index < artifactsBefore.directoryIdentities.length; index += 1) {
    const left = artifactsBefore.directoryIdentities[index]!;
    const right = artifactsAfter.directoryIdentities[index]!;
    if (left.locator !== right.locator || !sameDirectory(left.snapshot.identity, right.snapshot.identity)) {
      fail("finalized directory identities changed across observation");
    }
  }
  assertDirectory(root, before.repository, "Setfarm repository");
  assertDirectory(path.join(root, "dist"), artifactsBefore.dist, "finalized dist");
  return Object.freeze({
    branch: "main",
    clean: true,
    sha: before.pinned.sourceSha,
    treeHash: before.pinned.sourceTreeHash,
    buildHash: artifactsBefore.buildHash,
    originMainSha: before.originMainSha,
  });
}

type Sha256V1 = string;
type CanonicalRefV1 = string;

const TASK12_P0_EXACT24_PATHS_V1 = Object.freeze([
  "package.json",
  "src/db-pg.ts",
  "src/execution/run-persistence.ts",
  "src/execution/run-terminal-transition.ts",
  "src/installer/run.ts",
  "src/internal-production/owner-admission-v1.ts",
  "src/internal-production/baseline-post-handoff-receipt-v1.ts",
  "src/internal-production/baseline-restart-authority-retirement-v1.ts",
  "src/internal-production/baseline-post-handoff-cli.ts",
  "src/internal-production/baseline-spawner-startup-admission-v1.ts",
  "src/internal-production/baseline-service-restart-sequence-v1.ts",
  "src/execution/runtime-completion.ts",
  "src/spawner.ts",
  "tests/internal-production/baseline-post-handoff-cli.test.ts",
  "tests/internal-production/owner-admission-v1.test.ts",
  "tests/internal-production/baseline-post-handoff-receipt-v1.test.ts",
  "tests/internal-production/baseline-restart-authority-retirement-v1.test.ts",
  "tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts",
  "tests/internal-production/baseline-spawner-startup-admission-v1.test.ts",
  "tests/internal-production/baseline-service-restart-sequence-v1.test.ts",
  "tests/execution-attempts/runtime-completion.test.ts",
  "tests/execution-attempts/run-protocol.test.ts",
  "tests/execution-attempts/run-terminal-transition.test.ts",
  "tests/claim-log-lifecycle.test.ts",
] as const);

const TASK12_P0_FOCUSED_TEST_PATHS_V1 = Object.freeze([
  "tests/internal-production/baseline-post-handoff-cli.test.ts",
  "tests/internal-production/owner-admission-v1.test.ts",
  "tests/internal-production/baseline-post-handoff-receipt-v1.test.ts",
  "tests/internal-production/baseline-restart-authority-retirement-v1.test.ts",
  "tests/internal-production/baseline-owner-producer-manifest-activation-controller-v1.test.ts",
  "tests/internal-production/baseline-spawner-startup-admission-v1.test.ts",
  "tests/internal-production/baseline-service-restart-sequence-v1.test.ts",
  "tests/execution-attempts/runtime-completion.test.ts",
  "tests/execution-attempts/run-protocol.test.ts",
  "tests/execution-attempts/run-terminal-transition.test.ts",
  "tests/claim-log-lifecycle.test.ts",
] as const);

const TASK12_P0_FOCUSED_COMMAND_V1 = Object.freeze([
  "env", "-u", "SETFARM_PG_URL", "-u", "SETFARM_TEST_PG_ADMIN_URL",
  "node", "--import", "tsx", "--test", "--test-concurrency=1",
  "--test-name-pattern=^P4 ", ...TASK12_P0_FOCUSED_TEST_PATHS_V1,
] as const);

function task12P0DeliveryPathV1(hash: string): string {
  return fixedWorkspaceAuthorityPathV1(CURRENT_ENTRY_STORE_DIRECTORY, "task12-p0-delivery-authorities", "sha256", hash.slice(0, 2), `${hash}.json`);
}

export async function resolveInternalProductionBaselineTask12P0DeliveryAuthorityV1(
  input: Readonly<{ deliveryAuthorityRef: CanonicalRefV1; deliveryAuthorityHash: string }>,
): Promise<InternalProductionBaselineTask12P0DeliveryAuthorityV1> {
  const pair = requirePair(input, "deliveryAuthorityRef", "deliveryAuthorityHash", TASK12_P0_DELIVERY_PREFIX_V1);
  const target = task12P0DeliveryPathV1(pair.deliveryAuthorityHash!);
  const value = strictCanonicalRecord(readTask12ReceiptStoreBytesV1(target), "Task12 P0 delivery authority");
  const keys = ["schema", "deliveryCommitSha", "deliveryTreeHash", "deliveryAncestorOfCurrentSource", "currentSourceSha", "currentSourceTreeHash", "currentSourceBuildHash", "exact24PathBlobSetHash", "focusedVerificationHash", "deliveryAuthorityRef", "deliveryAuthorityHash"] as const;
  if (!hasExactKeys(value, keys) || value.schema !== "setfarm.internal-production-baseline-task12-p0-delivery-authority.v1" || value.deliveryAncestorOfCurrentSource !== true) currentEntryFail("Task12 P0 delivery authority shape is invalid");
  const body = Object.fromEntries(keys.slice(0, -2).map((key) => [key, value[key]]));
  const hash = requireSha256(value.deliveryAuthorityHash, "Task12 P0 delivery authority hash");
  if (
    requireGitHash(value.deliveryCommitSha, "Task12 P0 delivery commit") !== value.deliveryCommitSha
    || requireGitHash(value.deliveryTreeHash, "Task12 P0 delivery tree") !== value.deliveryTreeHash
    || requireGitHash(value.currentSourceSha, "Task12 P0 current source") !== value.currentSourceSha
    || requireGitHash(value.currentSourceTreeHash, "Task12 P0 current tree") !== value.currentSourceTreeHash
    || requireSha256(value.currentSourceBuildHash, "Task12 P0 current build") !== value.currentSourceBuildHash
    || requireSha256(value.exact24PathBlobSetHash, "Task12 P0 path set") !== value.exact24PathBlobSetHash
    || requireSha256(value.focusedVerificationHash, "Task12 P0 focused verification") !== value.focusedVerificationHash
    || hashCanonicalJson(body) !== hash
    || value.deliveryAuthorityRef !== pair.deliveryAuthorityRef
    || hash !== pair.deliveryAuthorityHash
  ) currentEntryFail("Task12 P0 delivery authority is crossed");
  return recursivelyFreeze(value as unknown as InternalProductionBaselineTask12P0DeliveryAuthorityV1);
}

export async function observeCurrentInternalProductionBaselineTask12P0DeliveryAuthorityV1(
): Promise<InternalProductionBaselineTask12P0DeliveryAuthorityV1> {
  const constants = task12P0DeliveryConstantsV1();
  const source = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  if (source.sha !== source.originMainSha) currentEntryFail("Task12 P0 delivery source is not synchronized to origin/main");
  if (gitLine(fixedRepositoryRoot(), ["merge-base", constants.deliveryCommitSha, source.sha], "Task12 P0 delivery merge base") !== constants.deliveryCommitSha) currentEntryFail("Task12 P0 delivery is not an ancestor of current source");
  if (gitLine(fixedRepositoryRoot(), ["rev-parse", `${constants.deliveryCommitSha}^{tree}`], "Task12 P0 delivery tree") !== constants.deliveryTreeHash) currentEntryFail("Task12 P0 delivery tree drifted");
  if (constants.orderedPathBlobs.length !== TASK12_P0_EXACT24_PATHS_V1.length || constants.orderedPathBlobs.some((entry, index) => entry.path !== TASK12_P0_EXACT24_PATHS_V1[index] || !FULL_HASH.test(entry.blobHash) || gitLine(fixedRepositoryRoot(), ["rev-parse", `${constants.deliveryCommitSha}:${entry.path}`], `Task12 P0 delivery blob ${entry.path}`) !== entry.blobHash)) currentEntryFail("Task12 P0 exact24 path/blob set drifted");
  const exact24PathBlobSetHash = hashCanonicalJson({ schema: "setfarm.internal-production-baseline-task12-p0-path-blob-set.v1", orderedPathBlobs: constants.orderedPathBlobs });
  if (constants.orderedCommands.length !== 1 || canonicalComparable(constants.orderedCommands[0]) !== canonicalComparable(TASK12_P0_FOCUSED_COMMAND_V1) || constants.orderedTestPathBlobs.length !== TASK12_P0_FOCUSED_TEST_PATHS_V1.length || constants.orderedTestPathBlobs.some((entry, index) => entry.path !== TASK12_P0_FOCUSED_TEST_PATHS_V1[index] || !FULL_HASH.test(entry.blobHash) || constants.orderedPathBlobs.find((candidate) => candidate.path === entry.path)?.blobHash !== entry.blobHash) || constants.exitCode !== 0 || constants.passed !== true) currentEntryFail("Task12 P0 focused verification inputs drifted");
  const focusedBody = { schema: "setfarm.internal-production-baseline-task12-p0-focused-verification.v1", orderedCommands: constants.orderedCommands, orderedTestPathBlobs: constants.orderedTestPathBlobs, exact24PathBlobSetHash, exitCode: constants.exitCode, passed: constants.passed };
  const focusedVerificationHash = hashCanonicalJson(focusedBody);
  const body = { schema: "setfarm.internal-production-baseline-task12-p0-delivery-authority.v1" as const, deliveryCommitSha: constants.deliveryCommitSha, deliveryTreeHash: constants.deliveryTreeHash, deliveryAncestorOfCurrentSource: true as const, currentSourceSha: source.sha, currentSourceTreeHash: source.treeHash, currentSourceBuildHash: source.buildHash, exact24PathBlobSetHash, focusedVerificationHash };
  const deliveryAuthorityHash = hashCanonicalJson(body);
  const deliveryAuthorityRef = `${TASK12_P0_DELIVERY_PREFIX_V1}${deliveryAuthorityHash}`;
  const authority = recursivelyFreeze({ ...body, deliveryAuthorityRef, deliveryAuthorityHash });
  publishLegacyZeroRecordV1(task12P0DeliveryPathV1(deliveryAuthorityHash), await canonicalRecordBytes(authority));
  return resolveInternalProductionBaselineTask12P0DeliveryAuthorityV1({ deliveryAuthorityRef, deliveryAuthorityHash });
}

export type InternalProductionAuthorityV3Migration31AuditPairV1 = Readonly<{
  authorityV3Migration31AuditRef: CanonicalRefV1;
  authorityV3Migration31AuditHash: Sha256V1;
}>;

export type InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1 = Readonly<{
  pendingBootstrapHandoffMigrationRef: CanonicalRefV1;
  pendingBootstrapHandoffMigrationHash: Sha256V1;
}>;

export type InternalProductionCurrentEntryOperationPairV1 = Readonly<{
  operationRef: CanonicalRefV1;
  operationHash: Sha256V1;
}>;

type CurrentAuthorityAuditV1 = Readonly<Record<string, unknown>>;
type Migration31AuditDataV1 = Readonly<Record<string, unknown>>;
type PendingSuccessorV1 = Readonly<Record<string, unknown>>;
type ProductBuildAuthorityObservationV1 = Readonly<{
  schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1";
  observationTransport: "source-cli";
  response: Readonly<Record<string, unknown>>;
}>;

export type InternalProductionAuthorityV3Migration31AuditV1 = Readonly<{
  schema: "setfarm.internal-production-authority-v3-migration31-audit.v1";
  currentStatus: "current";
  controllerSource: InternalProductionCleanSetfarmSourceBuildV1;
  pr86Delivery: Readonly<{
    pullRequestNumber: 86;
    mergeSha: "1d691c89760339ea905dfe17f8e9188e62603c1c";
    mergeTreeHash: "04f1d95a58360d06e866fe816138655efa916284";
    descendantSha: string;
    descendantTreeHash: string;
    expectedMergeBase: "1d691c89760339ea905dfe17f8e9188e62603c1c";
  }>;
  authorityV3ContractSpineThroughMigration31: Migration31AuditDataV1;
  currentAuthorityAudit: CurrentAuthorityAuditV1;
  currentAuthorityAuditHash: Sha256V1;
  migration31SemanticDigest: Sha256V1;
  migration31SourceManifestEntryHash: Sha256V1;
  authorityV3Migration31AuditRef: CanonicalRefV1;
  authorityV3Migration31AuditHash: Sha256V1;
}>;

export type InternalProductionPendingBootstrapHandoffMigrationProjectionV1 = Readonly<{
  schema: "setfarm.internal-production-pending-bootstrap-handoff-migration-projection.v1";
  currentStatus: "current";
  controllerSource: InternalProductionCleanSetfarmSourceBuildV1;
  pendingSuccessor: PendingSuccessorV1;
  migrationImplementation: Readonly<{
    locator: "src/db/bootstrap-main-claim-handoff-v1-migration.ts";
    gitMode: "100644";
    gitBlobHash: string;
  }>;
  pendingBootstrapHandoffMigrationRef: CanonicalRefV1;
  pendingBootstrapHandoffMigrationHash: Sha256V1;
}>;

export type InternalProductionCurrentEntryOperationV1 = Readonly<{
  schema: "setfarm.internal-production-current-entry-operation.v1";
  purpose: "task6a-internal-production-current-entry-v1";
  controllerSource: InternalProductionCleanSetfarmSourceBuildV1;
  productBuildAuthorityV2DeliveryEvidence: Readonly<{
    deliveryEvidenceRef: CanonicalRefV1;
    deliveryEvidenceHash: Sha256V1;
  }>;
  productBuildAuthorityV2Observation: ProductBuildAuthorityObservationV1;
  authorityV3Migration31Audit: InternalProductionAuthorityV3Migration31AuditPairV1;
  pendingBootstrapHandoffMigration: InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1;
  operationRef: CanonicalRefV1;
  operationHash: Sha256V1;
}>;

const CURRENT_ENTRY_STORE_DIRECTORY = "data/internal-production-baseline/current-entry-v1";
const CURRENT_ENTRY_MAX_BYTES = 1_048_576;
const TASK12_P0_DELIVERY_PREFIX_V1 = "setfarm://internal-production/baseline-task12-p0-delivery-authority/sha256/";
const PR86_SHA: "1d691c89760339ea905dfe17f8e9188e62603c1c" = "1d691c89760339ea905dfe17f8e9188e62603c1c";
const PR86_TREE: "04f1d95a58360d06e866fe816138655efa916284" = "04f1d95a58360d06e866fe816138655efa916284";
const V31_MIGRATION_IDENTITIES = Object.freeze([
  ["001_execution_attempts", "a48083e6d48d0072a36f255f02d05708606053edc38aa140dea8a58c7b48a32e"], ["002_run_protocol_identity", "993e11cff9a7e641c8de2e1c08d2591675df9ca18dfb78c304a37dd0e9d14ea4"], ["003_migration_release_attestation", "57e24f73ee6d3ce0272dae83893b1a7090fb9b80e476fe48d794ab22ee0fda8f"], ["004_compiler_preflight_identity", "09b9b471a27100baf58466ffd119b0780c259d525bd42dfe3177d069aab60b84"], ["005_claim_attempt_relational_binding", "96f89ef4277159b29835423a68ff35f94e1d56a3f98ec876e93a87ce295563b4"], ["006_durable_runtime_ownership", "7cec2991286163c7da8390d880635beebc362682ae391fdc22dd4dedb888b872"], ["007_manager_owned_completion", "acf77eb33c6854dcaa86c5b8bf2c80fd74db96985bb0ae497350a9d9d407696d"], ["008_runtime_completion_effect_ledger", "c312da49662daa1c96f0637142711bdc83eb9e901a6632121ab1a499c44f7aa2"], ["009_product_artifact_index", "400e0d5f5b8a9263590e3c9e03a2e7198cc969219ef664b753daed23be461f54"], ["010_finding_recovery_evidence_ledger", "f659f09b904de01d3d0a361ee5fcd8fb28e9ca916be4567ef146114b6a836114"], ["011_revisioned_recovery_delivery_ledger", "8397a861b8355b18781f44c89806a624bcf315656b6c1c9cc33b17648a5fd243"], ["012_canonical_operational_event_projection", "0339b0d90d9e2c5c2c0d81bbae51a622a113e68343cab3413bbdaf2ddbb02778"], ["013_accepted_candidate_ledger", "e3c4f5d3a46ece129be1961780afcb9d4d0a49e12c7868c5a3d754e3c2061616"], ["014_v3_deploy_receipt_ledger", "3d03d4401412ad68359bb8ae8041f5310ee4bbb7ecb534781be036191acfcc34"], ["015_v3_release_admission_ledger", "4a99286d68ab8711b092c1356778016af38bb83e552f11426cb4e59bfd078b33"], ["016_v3_preparation_block_ledger", "63b90ee3af285600e25f957cfd5fb0b183bcfca7384294c0e40622204561db70"], ["017_v3_github_review_resolution_evidence", "68ef6910f3b1b5c5237594e84560570a106f439be374d6fd84398db6fa94ec7e"], ["018_v3_project_transfer_ack_ledger", "3570c459ab60cf7bae539c6492097d9c03949ce1db407e79eefab6a31e8b2f83"], ["019_runtime_completion_submission_evidence", "bb707d9f15fa7ae95a2c3989ee06121c16d364ce5bdfaba923584153fb9bac22"], ["020_recovery_terminal_lease_identity", "d572e4832ad41bd748f46b361dd2787eb76cd7e1901501ccfa94d26186975c33"], ["021_operational_failure_cause_seal", "b7c6ad4a60d4f3203cf44ffd23a795284985e88d99761885632c8af66bdfc735"], ["022_product_compilation_attempt_ledger", "0bf46cc0dd468e6d9d47df76b289b98e0a7ae60072e99d64fdab7f43d0894646"], ["023_artifact_publication_batch_ledger", "11325a4362172f995607ca8494aeeac397c86d3310a26832b51f62245a1f17fe"], ["024_artifact_store_authority_ledger", "a1b1126a58a6c7b8d845e65cc958401a7f9be43df3c261e1b28ca6999f3e399e"], ["025_v3_preparation_authority_v2_ledger", "6342434911b27cd47eccae2408af1c3f7820bc431e00ece0ec46cca070ddb51d"], ["026_artifact_publication_batch_plan_ledger", "c60d91230dc5ff0704ce2dfef5134a94d91e6d63e3e34cfeb1998dfb897a0155"], ["027_platform_release_store_record_ledger_v3", "53fc69b28238b2bc27d092c2da620b653cbfee378b2d2808f2fd3e4c593eb1ff"], ["028_runtime_completion_manifest_authority", "6c759b27e39e1d482c6531c50475e48cabf1be12e539d81f795532c70b073de9"], ["029_v3_story_claim_runtime_binding_v1", "5d854397e305aa3bbacff85cee184b7db7566b8e2805ea2a7641273f2d018fcb"], ["030_operational_failure_cause_authority_v2", "ee9644b0c3fd20290902fb62d336e851d7b6f4e32e8956d6f07a52156a3c4dc1"], ["031_operational_failure_cause_authority_v3", "7fba6cf62e2201dc12e64175611e3a77fe780bc5af98a62f5f353281e075ab8f"],
] as const);
const PENDING_MIGRATION_32 = Object.freeze({
  checksum: "d152ec3d70de4221dc2a5bc79ccf46b4a6b89a3f5e8b966b8002a129d9e8c71d",
  migrationDigest: "8cbaab0c47bf3639033442d2df9a1c15d421eb34adbab72fa82951712cafe4e2",
  namedMigrationDigestEntryHash: "81d9164ca0f2c0be1cece391fc654a854c28ccfce905b87c3ad680202f95557c",
  orderedStatementsHash: "ccfcfdb6ed9e9d87add9e28394b2e67bf9ed55347841fe0529cdde4d6a5b34c9",
  expectedSchemaProjectionHash: "9f44b6312ba62fb7b48da153e70fa7f19ce543dbeec500b9111d750847a7eed1",
});
const CURRENT_ENTRY_FILES = Object.freeze({
  authorityV3Migration31Audit: "authority-v3-migration31-audit.json",
  pendingBootstrapHandoffMigration: "pending-bootstrap-handoff-migration.json",
  operation: "current-entry-operation.json",
});
const CURRENT_ENTRY_AUTHORITY_DIRECTORIES_V1 = Object.freeze([
  "operations",
  "records",
  "recovery-source-bootstrap-v1",
  "task12-p0-delivery-authorities",
] as const);

function currentEntryFail(message: string): never {
  throw new Error(`INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:${message}`);
}

function isEnoent(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function recursivelyFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && "value" in descriptor) recursivelyFreeze(descriptor.value);
    }
    Object.freeze(value);
  }
  return value;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return canonicalComparable([...Object.keys(value)].sort(compareBytes)) === canonicalComparable([...keys].sort(compareBytes));
}

function requireSha256(value: unknown, label: string): Sha256V1 {
  if (typeof value !== "string" || !SHA256.test(value)) currentEntryFail(`${label} is not SHA-256`);
  return value;
}

function requireGitHash(value: unknown, label: string): string {
  if (typeof value !== "string" || !FULL_HASH.test(value)) currentEntryFail(`${label} is not a Git object hash`);
  return value;
}

function isNaturalNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function requirePair(
  value: unknown,
  refKey: string,
  hashKey: string,
  prefix: string,
): Readonly<Record<string, string>> {
  if (!isPlainRecord(value) || !hasExactKeys(value, [refKey, hashKey])) currentEntryFail(`${refKey} pair shape is invalid`);
  const hash = requireSha256(value[hashKey], hashKey);
  const ref = value[refKey];
  if (typeof ref !== "string" || ref !== `${prefix}${hash}`) currentEntryFail(`${refKey} does not match its hash`);
  return Object.freeze({ [refKey]: ref, [hashKey]: hash });
}

function requireSource(value: unknown): InternalProductionCleanSetfarmSourceBuildV1 {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["branch", "clean", "sha", "treeHash", "buildHash", "originMainSha"])) {
    currentEntryFail("controller source shape is invalid");
  }
  if (value.branch !== "main" || value.clean !== true) currentEntryFail("controller source is not clean main");
  const sha = requireGitHash(value.sha, "controller source SHA");
  const treeHash = requireGitHash(value.treeHash, "controller source tree");
  const buildHash = requireSha256(value.buildHash, "controller build hash");
  const originMainSha = requireGitHash(value.originMainSha, "controller origin/main SHA");
  if (sha !== originMainSha) currentEntryFail("controller source is not synchronized to origin/main");
  return Object.freeze({ branch: "main", clean: true, sha, treeHash, buildHash, originMainSha });
}

function requireMigrationPlanRecord(
  value: unknown,
  expectedVersion: number,
  expectedClass: "automatic" | "guarded",
  expectedStates: readonly string[],
  expectedName?: string,
): void {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["version", "name", "migrationClass", "checksum", "state"])) currentEntryFail("migration record shape is invalid");
  if (
    value.version !== expectedVersion
    || value.migrationClass !== expectedClass
    || !expectedStates.includes(value.state as string)
    || typeof value.name !== "string"
    || !/^[a-z0-9][a-z0-9._-]{0,254}$/.test(value.name)
    || (expectedName !== undefined && value.name !== expectedName)
  ) currentEntryFail(`migration ${expectedVersion} record is invalid`);
  requireSha256(value.checksum, `migration ${expectedVersion} checksum`);
}

function requireAuthorityV3Migration31Audit(value: unknown): void {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["schema", "status", "throughVersion", "migrations"])) currentEntryFail("v31 predecessor audit shape is invalid");
  if (value.schema !== "setfarm.authority-v3-contract-spine-through-migration-31-audit.v1" || value.status !== "verified" || value.throughVersion !== 31 || !Array.isArray(value.migrations) || value.migrations.length !== 31) currentEntryFail("v31 predecessor audit is invalid");
  for (let index = 0; index < value.migrations.length; index += 1) {
    const [name, checksum] = V31_MIGRATION_IDENTITIES[index]!;
    requireMigrationPlanRecord(value.migrations[index], index + 1, "automatic", ["applied", "adopted"], name);
    if ((value.migrations[index] as Record<string, unknown>).checksum !== checksum) currentEntryFail(`migration ${index + 1} checksum is invalid`);
  }
}

function requireCurrentAuthorityAudit(value: unknown): void {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["schema", "version", "scope", "status", "authorityState", "productionAuthority", "productionAdmission", "mutationAuthority", "storeAuthority", "restartAuthority", "trustConclusion", "artifactPublicationAuthorityLedger", "platformReleaseStoreRecordLedger", "v3StoryClaimRuntimeBinding"])) currentEntryFail("current-authority audit shape is invalid");
  if (
    value.schema !== "setfarm.contract-spine-current-authority-ledgers-audit.v2"
    || value.version !== "2.0.0"
    || value.scope !== "database-current-authority-ledgers-only"
    || value.status !== "verified"
    || value.authorityState !== "database_integrity_audit_only"
    || value.productionAuthority !== false
    || value.productionAdmission !== "forbidden"
    || value.mutationAuthority !== false
    || value.storeAuthority !== false
    || value.restartAuthority !== false
    || value.trustConclusion !== "characterization_only"
    || !isPlainRecord(value.artifactPublicationAuthorityLedger)
    || !isPlainRecord(value.platformReleaseStoreRecordLedger)
    || !isPlainRecord(value.v3StoryClaimRuntimeBinding)
  ) currentEntryFail("current-authority audit is invalid");
  const artifact = value.artifactPublicationAuthorityLedger;
  if (!hasExactKeys(artifact, ["schema", "scope", "status", "batchPlanCount", "authority"]) || artifact.schema !== "setfarm.artifact-publication-authority-ledger-audit.v2" || artifact.scope !== "database-ledger-only" || artifact.status !== "verified" || !isNaturalNumber(artifact.batchPlanCount)) currentEntryFail("current-authority artifact audit is invalid");
  if (artifact.authority !== null) {
    if (!isPlainRecord(artifact.authority) || !hasExactKeys(artifact.authority, ["authorityKey", "authoritySchema", "authorityId", "rootLocatorHash", "state", "diagnostic", "createdAt", "updatedAt"]) || typeof artifact.authority.authorityKey !== "string" || typeof artifact.authority.authoritySchema !== "string" || typeof artifact.authority.authorityId !== "string" || !SHA256.test(typeof artifact.authority.rootLocatorHash === "string" ? artifact.authority.rootLocatorHash : "") || !["binding", "ready", "quarantined"].includes(artifact.authority.state as string) || !(artifact.authority.diagnostic === null || typeof artifact.authority.diagnostic === "string") || typeof artifact.authority.createdAt !== "string" || typeof artifact.authority.updatedAt !== "string") currentEntryFail("current-authority artifact binding is invalid");
  }
  const platform = value.platformReleaseStoreRecordLedger;
  if (!hasExactKeys(platform, ["schema", "scope", "status", "authorityState", "productionAuthority", "productionAdmission", "mutationAuthority", "storeAuthority", "restartAuthority", "trustConclusion", "recordCount", "tailRecordHash", "tailPublishedCensusHash"]) || platform.schema !== "setfarm.platform-release-store-record-ledger-current-audit.v3" || platform.scope !== "database-record-integrity-only" || platform.status !== "integrity_verified" || platform.authorityState !== "database_record_integrity_audit_only" || platform.productionAuthority !== false || platform.productionAdmission !== "forbidden" || platform.mutationAuthority !== false || platform.storeAuthority !== false || platform.restartAuthority !== false || platform.trustConclusion !== "characterization_only" || !isNaturalNumber(platform.recordCount) || !(platform.tailRecordHash === null || SHA256.test(typeof platform.tailRecordHash === "string" ? platform.tailRecordHash : "")) || !(platform.tailPublishedCensusHash === null || SHA256.test(typeof platform.tailPublishedCensusHash === "string" ? platform.tailPublishedCensusHash : ""))) currentEntryFail("current-authority platform audit is invalid");
  const binding = value.v3StoryClaimRuntimeBinding;
  if (!hasExactKeys(binding, ["schema", "scope", "status", "authorityState", "productionAuthority", "productionAdmission", "mutationAuthority", "bindingCount", "requiredOwnerCount"]) || binding.schema !== "setfarm.v3-story-claim-runtime-binding-current-audit.v1" || binding.scope !== "database-binding-integrity-only" || binding.status !== "integrity_verified" || binding.authorityState !== "database_binding_integrity_audit_only" || binding.productionAuthority !== false || binding.productionAdmission !== "forbidden" || binding.mutationAuthority !== false || !isNaturalNumber(binding.bindingCount) || !isNaturalNumber(binding.requiredOwnerCount)) currentEntryFail("current-authority binding audit is invalid");
}

function requirePendingSuccessor(value: unknown): void {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["schema", "status", "migration", "migrationDigest", "namedMigrationDigestEntryHash", "orderedStatementsHash", "expectedSchemaProjectionHash"])) currentEntryFail("pending successor shape is invalid");
  if (value.schema !== "setfarm.pending-bootstrap-main-claim-handoff-guarded-successor.v1" || value.status !== "exact_pending_guarded_successor") currentEntryFail("pending successor is invalid");
  requireMigrationPlanRecord(value.migration, 32, "guarded", ["pending"], "contract-spine-bootstrap-main-claim-handoff-v1");
  if ((value.migration as Record<string, unknown>).checksum !== PENDING_MIGRATION_32.checksum) currentEntryFail("pending migration checksum is invalid");
  if (requireSha256(value.migrationDigest, "pending migration digest") !== PENDING_MIGRATION_32.migrationDigest) currentEntryFail("pending migration digest is invalid");
  if (requireSha256(value.namedMigrationDigestEntryHash, "pending named migration digest entry hash") !== PENDING_MIGRATION_32.namedMigrationDigestEntryHash) currentEntryFail("pending named migration digest entry hash is invalid");
  if (requireSha256(value.orderedStatementsHash, "pending ordered statements hash") !== PENDING_MIGRATION_32.orderedStatementsHash) currentEntryFail("pending ordered statements hash is invalid");
  if (requireSha256(value.expectedSchemaProjectionHash, "pending expected schema projection hash") !== PENDING_MIGRATION_32.expectedSchemaProjectionHash) currentEntryFail("pending expected schema projection hash is invalid");
}

type NoReplacePlannerV1 = (input: Readonly<{
  basename: string;
  candidateBytes: Buffer;
  entries: readonly Readonly<{
    name: string;
    bytes: Buffer;
    mode: number;
    linkCount: number;
    devDecimal: string;
    inoDecimal: string;
  }>[];
}>) => Readonly<{
  state: "block" | "resume" | "cleanup" | "adopt";
  fixedName: string | null;
  selectedTempName: string | null;
  cleanupTempNames: readonly string[];
  reason?: string;
  terminalState?: "resume" | "adopt";
}>;

type NoReplacePlanV1 = ReturnType<NoReplacePlannerV1>;

async function currentEntryPublisherPlannerV1(): Promise<NoReplacePlannerV1> {
  const url = new URL("../../scripts/build-generation-retention.mjs", import.meta.url).href;
  const loaded = await import(url) as Readonly<{ planNoReplacePublisherRecoveryV1?: unknown }>;
  if (typeof loaded.planNoReplacePublisherRecoveryV1 !== "function") currentEntryFail("shared no-replace planner is unavailable");
  return loaded.planNoReplacePublisherRecoveryV1 as NoReplacePlannerV1;
}

function ensureCurrentEntryStore(): Readonly<{ directory: string; device: bigint }> {
  const repository = directorySnapshot(fixedRepositoryRoot(), "Setfarm repository");
  const workspace = path.dirname(fixedRepositoryRoot());
  const workspaceSnapshot = directorySnapshot(workspace, "Setfarm workspace", repository.device);
  const segments = CURRENT_ENTRY_STORE_DIRECTORY.split("/");
  let directory = workspace;
  for (const segment of segments) {
    directory = path.join(directory, segment);
    try {
      mkdirSync(directory, { mode: 0o700 });
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
    }
    const observed = directorySnapshot(directory, `current-entry store ${segment}`, workspaceSnapshot.device);
    if (observed.identity.mode !== 0o700) currentEntryFail(`current-entry store ${segment} has wrong mode`);
  }
  return Object.freeze({ directory, device: workspaceSnapshot.device });
}

function readCurrentEntryStore(): Readonly<{ directory: string; device: bigint }>;
function readCurrentEntryStore(allowAbsent: true): Readonly<{ directory: string; device: bigint }> | null;
function readCurrentEntryStore(allowAbsent = false): Readonly<{ directory: string; device: bigint }> | null {
  const repository = directorySnapshot(fixedRepositoryRoot(), "Setfarm repository");
  const workspace = path.dirname(fixedRepositoryRoot());
  const workspaceSnapshot = directorySnapshot(workspace, "Setfarm workspace", repository.device);
  let directory = workspace;
  let parentDirectory = workspace;
  let parentSnapshot = workspaceSnapshot;
  for (const segment of CURRENT_ENTRY_STORE_DIRECTORY.split("/")) {
    directory = path.join(directory, segment);
    try {
      lstatSync(directory, { bigint: true });
    } catch (error) {
      if (!allowAbsent || !isEnoent(error)) throw error;
      assertDirectory(parentDirectory, parentSnapshot, `parent of absent current-entry store ${segment}`);
      try {
        lstatSync(directory, { bigint: true });
      } catch (reobservedError) {
        if (!isEnoent(reobservedError)) throw reobservedError;
        assertDirectory(parentDirectory, parentSnapshot, `parent of absent current-entry store ${segment}`);
        return null;
      }
      currentEntryFail(`absent current-entry store ${segment} appeared while observed`);
    }
    const observed = directorySnapshot(directory, `current-entry store ${segment}`, workspaceSnapshot.device);
    if (observed.identity.mode !== 0o700) currentEntryFail(`current-entry store ${segment} has wrong mode`);
    parentDirectory = directory;
    parentSnapshot = observed;
  }
  return Object.freeze({ directory, device: workspaceSnapshot.device });
}

function publisherEntry(
  directory: string,
  name: string,
  device: bigint,
): Readonly<{ name: string; bytes: Buffer; mode: number; linkCount: number; devDecimal: string; inoDecimal: string }> {
  const file = path.join(directory, name);
  const descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.dev !== device || (before.mode & 0o7777n) !== 0o600n || ![1n, 2n].includes(before.nlink) || before.size > BigInt(CURRENT_ENTRY_MAX_BYTES)) {
      currentEntryFail(`publisher record ${name} has invalid identity`);
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (!sameRegularMetadata(before, after) || BigInt(bytes.length) !== after.size) currentEntryFail(`publisher record ${name} changed while read`);
    return Object.freeze({
      name,
      bytes,
      mode: 0o600,
      linkCount: Number(after.nlink),
      devDecimal: after.dev.toString(10),
      inoDecimal: after.ino.toString(10),
    });
  } finally {
    closeSync(descriptor);
  }
}

function readCurrentEntryRecord(directory: string, basename: string, device: bigint): Buffer {
  void device;
  return readTask12ReceiptStoreBytesV1(path.join(directory, basename));
}

function unlinkPlannedPublisherEntry(
  directory: string,
  expected: Readonly<{ name: string; bytes: Buffer; mode: number; linkCount: number; devDecimal: string; inoDecimal: string }>,
  device: bigint,
): void {
  const reopened = publisherEntry(directory, expected.name, device);
  if (
    reopened.mode !== expected.mode
    || reopened.linkCount !== expected.linkCount
    || reopened.devDecimal !== expected.devDecimal
    || reopened.inoDecimal !== expected.inoDecimal
    || !reopened.bytes.equals(expected.bytes)
  ) currentEntryFail(`publisher record ${expected.name} changed before cleanup`);
  unlinkSync(path.join(directory, expected.name));
  const directoryDescriptor = openSync(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    fsyncSync(directoryDescriptor);
  } finally {
    closeSync(directoryDescriptor);
  }
}

function fsyncCurrentEntryDirectory(directory: string): void {
  const descriptor = openSync(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function normalizeExistingCurrentEntryFamily(
  store: Readonly<{ directory: string; device: bigint }>,
  basename: string,
  bytes: Buffer,
  entries: readonly Readonly<{ name: string; bytes: Buffer; mode: number; linkCount: number; devDecimal: string; inoDecimal: string }>[],
  plan: NoReplacePlanV1,
): boolean {
  if (plan.state === "adopt") return false;
  if (plan.state === "block" || plan.fixedName !== basename) currentEntryFail(`publisher family ${basename} cannot normalize`);
  try {
    if (plan.state === "cleanup" && plan.selectedTempName === null) {
      for (const name of plan.cleanupTempNames) {
        const entry = entries.find((candidate) => candidate.name === name);
        if (!entry) currentEntryFail(`publisher family ${basename} cleanup member is absent`);
        unlinkPlannedPublisherEntry(store.directory, entry, store.device);
      }
      return plan.cleanupTempNames.length > 0;
    }
    const selected = plan.selectedTempName;
    if (!selected) currentEntryFail(`publisher family ${basename} recovery temp is absent`);
    const selectedEntry = entries.find((entry) => entry.name === selected);
    if (!selectedEntry || selectedEntry.linkCount !== 1) currentEntryFail(`publisher family ${basename} recovery temp is invalid`);
    linkSync(path.join(store.directory, selected), path.join(store.directory, basename));
    fsyncCurrentEntryDirectory(store.directory);
    const fixedAfterLink = publisherEntry(store.directory, basename, store.device);
    const selectedAfterLink = publisherEntry(store.directory, selected, store.device);
    if (
      fixedAfterLink.linkCount !== 2
      || selectedAfterLink.linkCount !== 2
      || fixedAfterLink.devDecimal !== selectedAfterLink.devDecimal
      || fixedAfterLink.inoDecimal !== selectedAfterLink.inoDecimal
      || !fixedAfterLink.bytes.equals(bytes)
      || !selectedAfterLink.bytes.equals(bytes)
    ) currentEntryFail(`publisher family ${basename} recovery link is invalid`);
    for (const name of [...plan.cleanupTempNames, selected]) {
      const entry = name === selected ? selectedAfterLink : entries.find((candidate) => candidate.name === name);
      if (!entry) currentEntryFail(`publisher family ${basename} cleanup member is absent`);
      unlinkPlannedPublisherEntry(store.directory, entry, store.device);
    }
    fsyncCurrentEntryDirectory(store.directory);
    const reopened = readCurrentEntryRecord(store.directory, basename, store.device);
    if (!reopened.equals(bytes)) currentEntryFail(`publisher family ${basename} did not normalize exactly`);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error.code === "EEXIST" || error.code === "ENOENT")) return true;
    throw error;
  }
}

async function publishCurrentEntryRecord(basename: string, bytes: Buffer): Promise<void> {
  if (bytes.length === 0 || bytes.length > CURRENT_ENTRY_MAX_BYTES) currentEntryFail("record bytes exceed the cap");
  const targetKind = (Object.entries(CURRENT_ENTRY_FILES) as readonly ["authorityV3Migration31Audit" | "pendingBootstrapHandoffMigration" | "operation", string][]).find(([, fixedName]) => fixedName === basename)?.[0];
  if (!targetKind) currentEntryFail("publisher target family is invalid");
  await validateCurrentEntryRecordBytes(targetKind, bytes);
  const store = ensureCurrentEntryStore();
  const planner = await currentEntryPublisherPlannerV1();
  const directoryGuard = authenticateTask12ReceiptDirectoryChainV1(store.directory);
  const currentEntryWriterTarget = path.join(store.directory, "current-entry-store");
  let writer: Readonly<{ close: () => void }> | null = null;
  try {
   writer = acquireTask12ReceiptLocatorWriterV1(currentEntryWriterTarget);
   directoryGuard.assertStable();
   for (let attempt = 0; attempt < 4; attempt += 1) {
    const tempPattern = new RegExp(`^\\.${basename.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.tmp$`);
    const families = (Object.entries(CURRENT_ENTRY_FILES) as readonly ["authorityV3Migration31Audit" | "pendingBootstrapHandoffMigration" | "operation", string][]).map(([kind, fixedName]) => Object.freeze({
      kind,
      fixedName,
      pattern: new RegExp(`^(?:${fixedName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}|\\.${fixedName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.tmp)$`),
    }));
    directoryGuard.assertStable();
    const writerLockName = `.${path.basename(currentEntryWriterTarget)}.writer.lock`;
    const inventory = readdirSync(store.directory).filter((name) => name !== writerLockName && !name.startsWith(`${writerLockName}.tmp-`)).sort(compareBytes);
    const authorityDirectories = new Set<string>(CURRENT_ENTRY_AUTHORITY_DIRECTORIES_V1);
    for (const name of inventory.filter((entry) => authorityDirectories.has(entry))) {
      const observed = directorySnapshot(path.join(store.directory, name), `current-entry authority directory ${name}`, store.device);
      if (observed.identity.mode !== 0o700) currentEntryFail(`current-entry authority directory ${name} has wrong mode`);
    }
    const publisherInventory = inventory.filter((name) => !authorityDirectories.has(name));
    if (publisherInventory.some((name) => !families.some((family) => family.pattern.test(name)))) currentEntryFail("current-entry store has an unknown or foreign dirent");
    const familyStates = families.map((family) => {
      const entries = publisherInventory.filter((name) => family.pattern.test(name)).map((name) => publisherEntry(store.directory, name, store.device));
      if (entries.length === 0) return Object.freeze({ family, entries, bytes: null, topology: null });
      const fixed = entries.find((entry) => entry.name === family.fixedName);
      const familyBytes = (fixed ?? entries[0]!).bytes;
      const topology = planner({ basename: family.fixedName, candidateBytes: familyBytes, entries });
      if (topology.state === "block" || topology.fixedName !== family.fixedName) currentEntryFail(`publisher family ${family.fixedName} has invalid topology: ${topology.reason ?? "invalid plan"}`);
      return Object.freeze({ family, entries, bytes: familyBytes, topology });
    });
    const invalidSoleTemps: Array<Readonly<{ name: string; bytes: Buffer; mode: number; linkCount: number; devDecimal: string; inoDecimal: string }>> = [];
    const parsedDependencies: Partial<{ v31Body: Record<string, unknown>; pendingBody: Record<string, unknown> }> = {};
    for (const state of familyStates.filter((candidate) => candidate.family.kind !== "operation")) {
      for (const entry of state.entries) {
        try {
          await validateCurrentEntryRecordBytes(state.family.kind, entry.bytes);
          if (state.family.kind === "authorityV3Migration31Audit") parsedDependencies.v31Body = strictCanonicalRecord(entry.bytes, "publisher v31 dependency");
          else parsedDependencies.pendingBody = strictCanonicalRecord(entry.bytes, "publisher pending dependency");
        } catch (error) {
          const invalidAuthenticatedSoleTemp = entry.name !== state.family.fixedName && state.entries.length === 1 && entry.linkCount === 1;
          if (!invalidAuthenticatedSoleTemp) throw error;
          invalidSoleTemps.push(entry);
        }
      }
    }
    const operationState = familyStates.find((state) => state.family.kind === "operation");
    if (operationState) {
      for (const entry of operationState.entries) {
        try {
          const dependencies = parsedDependencies.v31Body && parsedDependencies.pendingBody
            ? Object.freeze({ v31Body: parsedDependencies.v31Body, pendingBody: parsedDependencies.pendingBody })
            : undefined;
          await validateCurrentEntryRecordBytes("operation", entry.bytes, dependencies);
        } catch (error) {
          const invalidAuthenticatedSoleTemp = entry.name !== operationState.family.fixedName && operationState.entries.length === 1 && entry.linkCount === 1;
          if (!invalidAuthenticatedSoleTemp) throw error;
          invalidSoleTemps.push(entry);
        }
      }
    }
    if (invalidSoleTemps.length > 0) {
      for (const entry of invalidSoleTemps) unlinkPlannedPublisherEntry(store.directory, entry, store.device);
      continue;
    }
    let normalizedExistingFamily = false;
    for (const state of familyStates) {
      if (state.topology && state.bytes) {
        normalizedExistingFamily = normalizeExistingCurrentEntryFamily(store, state.family.fixedName, state.bytes, state.entries, state.topology) || normalizedExistingFamily;
      }
    }
    if (normalizedExistingFamily) continue;
    const names = inventory.filter((name) => name === basename || name.startsWith(`.${basename}.`));
    if (names.some((name) => name !== basename && !tempPattern.test(name))) currentEntryFail("unknown publisher-like dirent");
    const entries = names.map((name) => publisherEntry(store.directory, name, store.device));
    if (entries.length === 1 && entries[0]!.name !== basename && !entries[0]!.bytes.equals(bytes)) {
      unlinkPlannedPublisherEntry(store.directory, entries[0]!, store.device);
      continue;
    }
    const plan = planner({ basename, candidateBytes: bytes, entries });
    if (plan.state === "block" || plan.fixedName !== basename) currentEntryFail(`no-replace publisher blocked: ${plan.reason ?? "invalid plan"}`);
    if (plan.state === "adopt") {
      if (!readCurrentEntryRecord(store.directory, basename, store.device).equals(bytes)) currentEntryFail("existing immutable record differs");
      return;
    }
    if (plan.state === "cleanup" && plan.selectedTempName === null) {
      for (const name of plan.cleanupTempNames) {
        const entry = entries.find((candidate) => candidate.name === name);
        if (!entry) currentEntryFail("no-replace publisher cleanup record is absent");
        unlinkPlannedPublisherEntry(store.directory, entry, store.device);
      }
      continue;
    }
    let selected = plan.selectedTempName;
    if (!selected) {
      selected = `.${basename}.${randomUUID()}.tmp`;
      const descriptor = openSync(path.join(store.directory, selected), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
      try {
        writeFileSync(descriptor, bytes);
        fchmodSync(descriptor, 0o600);
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
    }
    const selectedPath = path.join(store.directory, selected);
    try {
      linkSync(selectedPath, path.join(store.directory, basename));
      const directoryDescriptor = openSync(store.directory, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        fsyncSync(directoryDescriptor);
      } finally {
        closeSync(directoryDescriptor);
      }
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST" || attempt === 3) throw error;
      continue;
    }
    const fixedAfterLink = publisherEntry(store.directory, basename, store.device);
    const selectedAfterLink = publisherEntry(store.directory, selected, store.device);
    if (
      fixedAfterLink.linkCount !== 2
      || selectedAfterLink.linkCount !== 2
      || fixedAfterLink.devDecimal !== selectedAfterLink.devDecimal
      || fixedAfterLink.inoDecimal !== selectedAfterLink.inoDecimal
      || !fixedAfterLink.bytes.equals(bytes)
      || !selectedAfterLink.bytes.equals(bytes)
    ) currentEntryFail("no-replace publisher link publication is not one authenticated inode pair");
    for (const name of [...plan.cleanupTempNames, selected]) {
      try {
        const entry = name === selected ? selectedAfterLink : entries.find((candidate) => candidate.name === name);
        if (!entry) currentEntryFail("no-replace publisher cleanup record is absent");
        unlinkPlannedPublisherEntry(
          store.directory,
          entry,
          store.device,
        );
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      }
    }
    const directoryDescriptor = openSync(store.directory, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      fsyncSync(directoryDescriptor);
    } finally {
      closeSync(directoryDescriptor);
    }
    if (!readCurrentEntryRecord(store.directory, basename, store.device).equals(bytes)) currentEntryFail("published record does not reopen exactly");
    directoryGuard.assertStable();
    return;
   }
   currentEntryFail("no-replace publication did not converge");
  } finally {
    try { writer?.close(); } finally { directoryGuard.close(); }
  }
}

async function canonicalRecordBytes(value: unknown): Promise<Buffer> {
  const url = new URL("../../scripts/build-generation-retention.mjs", import.meta.url).href;
  const loaded = await import(url) as Readonly<{ canonicalJsonV1?: unknown }>;
  if (typeof loaded.canonicalJsonV1 !== "function") currentEntryFail("shared canonical JSON writer is unavailable");
  return Buffer.from(`${(loaded.canonicalJsonV1 as (input: unknown) => string)(value)}\n`, "utf8");
}

function strictCanonicalRecord(bytes: Buffer, label: string): Record<string, unknown> {
  if (bytes.length === 0 || bytes.length > CURRENT_ENTRY_MAX_BYTES) currentEntryFail(`${label} record size is invalid`);
  const text = strictUtf8(bytes, label);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    currentEntryFail(`${label} record is not JSON`);
  }
  if (!isPlainRecord(value) || text !== `${canonicalComparable(value)}\n`) currentEntryFail(`${label} record is not canonical JSON`);
  return value;
}

function fixedCurrentEntryPath(kind: "authorityV3Migration31Audit" | "pendingBootstrapHandoffMigration" | "operation"): Readonly<{ directory: string; basename: string; device: bigint }> {
  const store = readCurrentEntryStore();
  return Object.freeze({ ...store, basename: CURRENT_ENTRY_FILES[kind] });
}

async function validateStoredCurrentEntryFamily(kind: "authorityV3Migration31Audit" | "pendingBootstrapHandoffMigration" | "operation"): Promise<void> {
  const target = fixedCurrentEntryPath(kind);
  let body: Record<string, unknown>;
  try {
    body = strictCanonicalRecord(readCurrentEntryRecord(target.directory, target.basename, target.device), `stored ${kind}`);
  } catch (error) {
    if (isEnoent(error)) return;
    throw error;
  }
  if (kind === "authorityV3Migration31Audit") {
    await resolveInternalProductionAuthorityV3Migration31AuditV1(requirePair(Object.freeze({ authorityV3Migration31AuditRef: body.authorityV3Migration31AuditRef, authorityV3Migration31AuditHash: body.authorityV3Migration31AuditHash }), "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "setfarm://internal-production/authority-v3-migration31-audit/sha256/") as InternalProductionAuthorityV3Migration31AuditPairV1);
    return;
  }
  if (kind === "pendingBootstrapHandoffMigration") {
    await resolveInternalProductionPendingBootstrapHandoffMigrationV1(requirePair(Object.freeze({ pendingBootstrapHandoffMigrationRef: body.pendingBootstrapHandoffMigrationRef, pendingBootstrapHandoffMigrationHash: body.pendingBootstrapHandoffMigrationHash }), "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash", "setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/") as InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1);
    return;
  }
  await resolveInternalProductionCurrentEntryOperationV1(requirePair(Object.freeze({ operationRef: body.operationRef, operationHash: body.operationHash }), "operationRef", "operationHash", "setfarm://internal-production/current-entry-operation/sha256/") as InternalProductionCurrentEntryOperationPairV1);
}

async function validateCurrentEntryRecordBytes(
  kind: "authorityV3Migration31Audit" | "pendingBootstrapHandoffMigration" | "operation",
  bytes: Buffer,
  publisherDependencies?: Readonly<{ v31Body: Record<string, unknown>; pendingBody: Record<string, unknown> }>,
): Promise<void> {
  const body = strictCanonicalRecord(bytes, `current-entry ${kind}`);
  if (kind === "authorityV3Migration31Audit") {
    const expected = requirePair(Object.freeze({ authorityV3Migration31AuditRef: body.authorityV3Migration31AuditRef, authorityV3Migration31AuditHash: body.authorityV3Migration31AuditHash }), "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "setfarm://internal-production/authority-v3-migration31-audit/sha256/");
    await parseAuthorityV3Migration31AuditBody(body, expected);
    return;
  }
  if (kind === "pendingBootstrapHandoffMigration") {
    const expected = requirePair(Object.freeze({ pendingBootstrapHandoffMigrationRef: body.pendingBootstrapHandoffMigrationRef, pendingBootstrapHandoffMigrationHash: body.pendingBootstrapHandoffMigrationHash }), "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash", "setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/");
    parsePendingBootstrapHandoffMigrationBody(body, expected);
    return;
  }
  const expected = requirePair(Object.freeze({ operationRef: body.operationRef, operationHash: body.operationHash }), "operationRef", "operationHash", "setfarm://internal-production/current-entry-operation/sha256/");
  await parseCurrentEntryOperationBody(body, expected, true, publisherDependencies);
}

function v31Pair(value: InternalProductionAuthorityV3Migration31AuditV1): InternalProductionAuthorityV3Migration31AuditPairV1 {
  return Object.freeze({ authorityV3Migration31AuditRef: value.authorityV3Migration31AuditRef, authorityV3Migration31AuditHash: value.authorityV3Migration31AuditHash });
}

function pendingPair(value: InternalProductionPendingBootstrapHandoffMigrationProjectionV1): InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1 {
  return Object.freeze({ pendingBootstrapHandoffMigrationRef: value.pendingBootstrapHandoffMigrationRef, pendingBootstrapHandoffMigrationHash: value.pendingBootstrapHandoffMigrationHash });
}

function operationPair(value: InternalProductionCurrentEntryOperationV1): InternalProductionCurrentEntryOperationPairV1 {
  return Object.freeze({ operationRef: value.operationRef, operationHash: value.operationHash });
}

function migrationImplementationEntry(source: InternalProductionCleanSetfarmSourceBuildV1): Readonly<{ locator: "src/db/bootstrap-main-claim-handoff-v1-migration.ts"; gitMode: "100644"; gitBlobHash: string }> {
  const root = fixedRepositoryRoot();
  const text = gitLine(root, ["ls-tree", source.sha, "--", "src/db/bootstrap-main-claim-handoff-v1-migration.ts"], "migration implementation Git entry");
  const match = /^100644 blob ((?:[a-f0-9]{40}|[a-f0-9]{64}))\tsrc\/db\/bootstrap-main-claim-handoff-v1-migration\.ts$/.exec(text);
  if (!match) currentEntryFail("migration implementation Git entry is invalid");
  return Object.freeze({ locator: "src/db/bootstrap-main-claim-handoff-v1-migration.ts", gitMode: "100644", gitBlobHash: match[1]! });
}

async function migration31Digests(): Promise<Readonly<{ semanticDigest: Sha256V1; sourceManifestEntryHash: Sha256V1 }>> {
  const digests = await import("../db/contract-spine-migration-digests.generated.js") as unknown as Readonly<{
    CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS: Readonly<Record<number, string>>;
  }>;
  const sourceIntegrity = await import("../db/contract-spine-migration-source-integrity.js") as unknown as Readonly<{
    CONTRACT_SPINE_SEMANTIC_MIGRATION_SOURCE_MANIFEST: Readonly<Record<number, unknown>>;
  }>;
  return Object.freeze({
    semanticDigest: requireSha256(digests.CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[31], "migration 31 semantic digest"),
    sourceManifestEntryHash: requireSha256(hashCanonicalJson(sourceIntegrity.CONTRACT_SPINE_SEMANTIC_MIGRATION_SOURCE_MANIFEST[31]), "migration 31 source-manifest entry hash"),
  });
}

export async function observeCurrentInternalProductionAuthorityV3Migration31AuditV1(): Promise<InternalProductionAuthorityV3Migration31AuditV1> {
  const ports = await import("../db-pg.js") as Readonly<{
    auditCurrentInternalProductionAuthorityV3Migration31V1?: () => Promise<Readonly<{ authorityV3ContractSpineThroughMigration31: Migration31AuditDataV1; currentAuthorityAudit: CurrentAuthorityAuditV1 }>>;
  }>;
  if (typeof ports.auditCurrentInternalProductionAuthorityV3Migration31V1 !== "function") currentEntryFail("current v31 database port is unavailable");
  const controllerSource = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  const observed = await ports.auditCurrentInternalProductionAuthorityV3Migration31V1();
  const digests = await migration31Digests();
  const body = {
    schema: "setfarm.internal-production-authority-v3-migration31-audit.v1" as const,
    currentStatus: "current" as const,
    controllerSource,
    pr86Delivery: Object.freeze({
      pullRequestNumber: 86 as const,
      mergeSha: PR86_SHA,
      mergeTreeHash: PR86_TREE,
      descendantSha: controllerSource.sha,
      descendantTreeHash: controllerSource.treeHash,
      expectedMergeBase: PR86_SHA,
    }),
    authorityV3ContractSpineThroughMigration31: observed.authorityV3ContractSpineThroughMigration31,
    currentAuthorityAudit: observed.currentAuthorityAudit,
    currentAuthorityAuditHash: hashCanonicalJson(observed.currentAuthorityAudit),
    migration31SemanticDigest: digests.semanticDigest,
    migration31SourceManifestEntryHash: digests.sourceManifestEntryHash,
  };
  const authorityV3Migration31AuditHash = hashCanonicalJson(body);
  const value: InternalProductionAuthorityV3Migration31AuditV1 = Object.freeze({
    ...body,
    authorityV3Migration31AuditRef: `setfarm://internal-production/authority-v3-migration31-audit/sha256/${authorityV3Migration31AuditHash}`,
    authorityV3Migration31AuditHash,
  });
  await publishCurrentEntryRecord(CURRENT_ENTRY_FILES.authorityV3Migration31Audit, await canonicalRecordBytes(value));
  return resolveInternalProductionAuthorityV3Migration31AuditV1(v31Pair(value));
}

export async function observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1(): Promise<InternalProductionPendingBootstrapHandoffMigrationProjectionV1> {
  const ports = await import("../db-pg.js") as Readonly<{
    inspectCurrentInternalProductionPendingBootstrapHandoffMigrationV1?: () => Promise<PendingSuccessorV1>;
  }>;
  if (typeof ports.inspectCurrentInternalProductionPendingBootstrapHandoffMigrationV1 !== "function") currentEntryFail("current pending database port is unavailable");
  const controllerSource = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  const pendingSuccessor = await ports.inspectCurrentInternalProductionPendingBootstrapHandoffMigrationV1();
  const body = {
    schema: "setfarm.internal-production-pending-bootstrap-handoff-migration-projection.v1" as const,
    currentStatus: "current" as const,
    controllerSource,
    pendingSuccessor,
    migrationImplementation: migrationImplementationEntry(controllerSource),
  };
  const pendingBootstrapHandoffMigrationHash = hashCanonicalJson(body);
  const value: InternalProductionPendingBootstrapHandoffMigrationProjectionV1 = Object.freeze({
    ...body,
    pendingBootstrapHandoffMigrationRef: `setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/${pendingBootstrapHandoffMigrationHash}`,
    pendingBootstrapHandoffMigrationHash,
  });
  await publishCurrentEntryRecord(CURRENT_ENTRY_FILES.pendingBootstrapHandoffMigration, await canonicalRecordBytes(value));
  return resolveInternalProductionPendingBootstrapHandoffMigrationV1(pendingPair(value));
}

export async function resolveInternalProductionAuthorityV3Migration31AuditV1(
  pair: InternalProductionAuthorityV3Migration31AuditPairV1,
): Promise<InternalProductionAuthorityV3Migration31AuditV1> {
  const expected = requirePair(pair, "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "setfarm://internal-production/authority-v3-migration31-audit/sha256/");
  const target = fixedCurrentEntryPath("authorityV3Migration31Audit");
  const body = strictCanonicalRecord(readCurrentEntryRecord(target.directory, target.basename, target.device), "v31 audit");
  return parseAuthorityV3Migration31AuditBody(body, expected);
}

async function parseAuthorityV3Migration31AuditBody(
  body: Record<string, unknown>,
  expected: Readonly<Record<string, string>>,
): Promise<InternalProductionAuthorityV3Migration31AuditV1> {
  if (!hasExactKeys(body, ["schema", "currentStatus", "controllerSource", "pr86Delivery", "authorityV3ContractSpineThroughMigration31", "currentAuthorityAudit", "currentAuthorityAuditHash", "migration31SemanticDigest", "migration31SourceManifestEntryHash", "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash"])) currentEntryFail("v31 audit fields are invalid");
  if (body.schema !== "setfarm.internal-production-authority-v3-migration31-audit.v1" || body.currentStatus !== "current") currentEntryFail("v31 audit discriminator is invalid");
  const projection = { ...body };
  delete projection.authorityV3Migration31AuditRef;
  delete projection.authorityV3Migration31AuditHash;
  const hash = requireSha256(body.authorityV3Migration31AuditHash, "v31 audit hash");
  if (hashCanonicalJson(projection) !== hash || body.authorityV3Migration31AuditRef !== `setfarm://internal-production/authority-v3-migration31-audit/sha256/${hash}` || expected.authorityV3Migration31AuditHash !== hash || expected.authorityV3Migration31AuditRef !== body.authorityV3Migration31AuditRef) currentEntryFail("v31 audit pair/hash is invalid");
  const controllerSource = requireSource(body.controllerSource);
  if (!isPlainRecord(body.pr86Delivery) || !hasExactKeys(body.pr86Delivery, ["pullRequestNumber", "mergeSha", "mergeTreeHash", "descendantSha", "descendantTreeHash", "expectedMergeBase"]) || body.pr86Delivery.pullRequestNumber !== 86 || body.pr86Delivery.mergeSha !== PR86_SHA || body.pr86Delivery.mergeTreeHash !== PR86_TREE || body.pr86Delivery.expectedMergeBase !== PR86_SHA || body.pr86Delivery.descendantSha !== controllerSource.sha || body.pr86Delivery.descendantTreeHash !== controllerSource.treeHash) currentEntryFail("v31 audit PR86 binding is invalid");
  requireAuthorityV3Migration31Audit(body.authorityV3ContractSpineThroughMigration31);
  requireCurrentAuthorityAudit(body.currentAuthorityAudit);
  if (body.currentAuthorityAuditHash !== hashCanonicalJson(body.currentAuthorityAudit)) currentEntryFail("v31 current-authority audit hash is invalid");
  const migration31SemanticDigest = requireSha256(body.migration31SemanticDigest, "migration 31 semantic digest");
  const migration31SourceManifestEntryHash = requireSha256(body.migration31SourceManifestEntryHash, "migration 31 source-manifest entry hash");
  const expectedDigests = await migration31Digests();
  if (migration31SemanticDigest !== expectedDigests.semanticDigest || migration31SourceManifestEntryHash !== expectedDigests.sourceManifestEntryHash) currentEntryFail("v31 migration digest binding is invalid");
  const replay = await import("../execution/v3-git-revision.js") as unknown as Readonly<{ replayV3HistoricalGitCommitAncestryV1?: (input: Readonly<{
    repo: string;
    ancestorSha: string;
    descendantSha: string;
    expectedAncestorTreeHash: string;
    expectedDescendantTreeHash: string;
    expectedMergeBase: string;
  }>) => unknown }>;
  if (typeof replay.replayV3HistoricalGitCommitAncestryV1 !== "function") currentEntryFail("historical Git replay is unavailable");
  replay.replayV3HistoricalGitCommitAncestryV1({ repo: fixedRepositoryRoot(), ancestorSha: PR86_SHA, descendantSha: controllerSource.sha, expectedAncestorTreeHash: PR86_TREE, expectedDescendantTreeHash: controllerSource.treeHash, expectedMergeBase: PR86_SHA });
  return Object.freeze(body as unknown as InternalProductionAuthorityV3Migration31AuditV1);
}

export async function resolveInternalProductionPendingBootstrapHandoffMigrationV1(
  pair: InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1,
): Promise<InternalProductionPendingBootstrapHandoffMigrationProjectionV1> {
  const expected = requirePair(pair, "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash", "setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/");
  const target = fixedCurrentEntryPath("pendingBootstrapHandoffMigration");
  const body = strictCanonicalRecord(readCurrentEntryRecord(target.directory, target.basename, target.device), "pending migration");
  return parsePendingBootstrapHandoffMigrationBody(body, expected);
}

function parsePendingBootstrapHandoffMigrationBody(
  body: Record<string, unknown>,
  expected: Readonly<Record<string, string>>,
): InternalProductionPendingBootstrapHandoffMigrationProjectionV1 {
  if (!hasExactKeys(body, ["schema", "currentStatus", "controllerSource", "pendingSuccessor", "migrationImplementation", "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash"])) currentEntryFail("pending migration fields are invalid");
  if (body.schema !== "setfarm.internal-production-pending-bootstrap-handoff-migration-projection.v1" || body.currentStatus !== "current") currentEntryFail("pending migration discriminator is invalid");
  const projection = { ...body };
  delete projection.pendingBootstrapHandoffMigrationRef;
  delete projection.pendingBootstrapHandoffMigrationHash;
  const hash = requireSha256(body.pendingBootstrapHandoffMigrationHash, "pending migration hash");
  if (hashCanonicalJson(projection) !== hash || body.pendingBootstrapHandoffMigrationRef !== `setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/${hash}` || expected.pendingBootstrapHandoffMigrationHash !== hash || expected.pendingBootstrapHandoffMigrationRef !== body.pendingBootstrapHandoffMigrationRef) currentEntryFail("pending migration pair/hash is invalid");
  const controllerSource = requireSource(body.controllerSource);
  requirePendingSuccessor(body.pendingSuccessor);
  if (!isPlainRecord(body.migrationImplementation) || !hasExactKeys(body.migrationImplementation, ["locator", "gitMode", "gitBlobHash"]) || body.migrationImplementation.locator !== "src/db/bootstrap-main-claim-handoff-v1-migration.ts" || body.migrationImplementation.gitMode !== "100644") currentEntryFail("pending migration implementation is invalid");
  const implementationBlob = requireGitHash(body.migrationImplementation.gitBlobHash, "pending migration Git blob");
  if (migrationImplementationEntry(controllerSource).gitBlobHash !== implementationBlob) currentEntryFail("pending migration implementation does not match stored controller source");
  return Object.freeze(body as unknown as InternalProductionPendingBootstrapHandoffMigrationProjectionV1);
}

async function observeCurrentPba(): Promise<ProductBuildAuthorityObservationV1> {
  const pba = await import("./product-build-authority-v2-delivery-evidence-v1.js") as Readonly<{
    observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1?: () => Promise<ProductBuildAuthorityObservationV1>;
    parseProductBuildAuthorityV2DeliveryEvidenceResponseV1?: (value: unknown) => Readonly<Record<string, unknown>>;
  }>;
  if (typeof pba.observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1 !== "function" || typeof pba.parseProductBuildAuthorityV2DeliveryEvidenceResponseV1 !== "function") currentEntryFail("current PBA observer is unavailable");
  const observation = await pba.observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1();
  if (!isPlainRecord(observation) || !hasExactKeys(observation, ["schema", "observationTransport", "response"]) || observation.schema !== "setfarm.product-build-authority-v2-delivery-evidence-observation.v1" || observation.observationTransport !== "source-cli" || canonicalComparable(observation.response) !== canonicalComparable(pba.parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(observation.response))) currentEntryFail("current PBA observation is invalid");
  pbaPair(observation);
  return observation;
}

function pbaPair(observation: ProductBuildAuthorityObservationV1): Readonly<{ deliveryEvidenceRef: CanonicalRefV1; deliveryEvidenceHash: Sha256V1 }> {
  if (!isPlainRecord(observation.response) || !hasExactKeys(observation.response, ["schema", "currentStatus", "deliveryEvidenceRef", "deliveryEvidenceHash", "evidence"]) || observation.response.schema !== "mission-control.product-build-authority-v2-delivery-evidence-response.v1" || observation.response.currentStatus !== "current" || !isPlainRecord(observation.response.evidence)) currentEntryFail("PBA response is invalid");
  const ref = observation.response.deliveryEvidenceRef;
  const hash = observation.response.deliveryEvidenceHash;
  const evidence = observation.response.evidence;
  const evidenceProjection = { ...evidence };
  delete evidenceProjection.deliveryEvidenceRef;
  delete evidenceProjection.deliveryEvidenceHash;
  if (
    typeof ref !== "string"
    || !SHA256.test(typeof hash === "string" ? hash : "")
    || ref !== `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${hash}`
    || evidence.deliveryEvidenceRef !== ref
    || evidence.deliveryEvidenceHash !== hash
    || hashCanonicalJson(evidenceProjection) !== hash
  ) currentEntryFail("PBA pair/body is crossed");
  return Object.freeze({ deliveryEvidenceRef: ref, deliveryEvidenceHash: hash as string });
}

/** Reads an already prepared immutable operation without publishing or recovering state. */
export async function observePreparedInternalProductionCurrentEntryOperationV1(): Promise<
  InternalProductionCurrentEntryOperationV1 | null
> {
  const store = readCurrentEntryStore(true);
  if (store === null) return null;
  const storeBefore = directorySnapshot(store.directory, "prepared current-entry store", store.device);
  const authorityDirectories = new Set<string>(CURRENT_ENTRY_AUTHORITY_DIRECTORIES_V1);
  const allowed = new Set<string>([...Object.values(CURRENT_ENTRY_FILES), ...authorityDirectories]);
  const entries = readdirSync(store.directory).sort(compareBytes);
  if (entries.length > allowed.size || entries.some((entry) => !allowed.has(entry))) {
    currentEntryFail("prepared current-entry inventory is invalid");
  }
  const firstSnapshots = new Map<string, StableRegular>();
  const directorySnapshots = new Map<string, DirectorySnapshot>();
  for (const entry of entries) {
    if (authorityDirectories.has(entry)) {
      const directory = directorySnapshot(path.join(store.directory, entry), `prepared current-entry ${entry}`, store.device);
      if (directory.identity.mode !== 0o700) currentEntryFail(`prepared current-entry ${entry} mode is invalid`);
      directorySnapshots.set(entry, directory);
      continue;
    }
    const observed = readTask12ReceiptStoreSnapshotV1(path.join(store.directory, entry));
    if (observed.mode !== 0o600 || observed.bytes.length < 1) {
      currentEntryFail(`prepared current-entry member ${entry} is invalid`);
    }
    firstSnapshots.set(entry, observed);
  }
  assertDirectory(store.directory, storeBefore, "prepared current-entry store");
  let operation: InternalProductionCurrentEntryOperationV1 | null = null;
  if (!entries.includes(CURRENT_ENTRY_FILES.operation)) {
    for (const kind of ["authorityV3Migration31Audit", "pendingBootstrapHandoffMigration"] as const) {
      const snapshot = firstSnapshots.get(CURRENT_ENTRY_FILES[kind]);
      if (snapshot) await validateCurrentEntryRecordBytes(kind, snapshot.bytes);
    }
  } else {
    const operationSnapshot = firstSnapshots.get(CURRENT_ENTRY_FILES.operation);
    if (!operationSnapshot) currentEntryFail("prepared current-entry operation snapshot is absent");
    const body = strictCanonicalRecord(operationSnapshot.bytes, "prepared current-entry operation");
    const pair = requirePair(
      { operationRef: body.operationRef, operationHash: body.operationHash },
      "operationRef",
      "operationHash",
      "setfarm://internal-production/current-entry-operation/sha256/",
    ) as InternalProductionCurrentEntryOperationPairV1;
    const v31Snapshot = firstSnapshots.get(CURRENT_ENTRY_FILES.authorityV3Migration31Audit);
    const pendingSnapshot = firstSnapshots.get(CURRENT_ENTRY_FILES.pendingBootstrapHandoffMigration);
    if (!v31Snapshot || !pendingSnapshot) currentEntryFail("prepared current-entry operation dependencies are absent");
    operation = await parseCurrentEntryOperationBody(body, pair, true, {
      v31Body: strictCanonicalRecord(v31Snapshot.bytes, "prepared v31 audit"),
      pendingBody: strictCanonicalRecord(pendingSnapshot.bytes, "prepared pending migration"),
    });
  }
  const finalEntries = readdirSync(store.directory).sort(compareBytes);
  assertDirectory(store.directory, storeBefore, "prepared current-entry store");
  if (canonicalComparable(entries) !== canonicalComparable(finalEntries)) currentEntryFail("prepared current-entry inventory changed while observed");
  for (const entry of entries) {
    if (authorityDirectories.has(entry)) {
      const first = directorySnapshots.get(entry);
      if (!first) currentEntryFail(`prepared current-entry ${entry} directory snapshot is absent`);
      assertDirectory(path.join(store.directory, entry), first, `prepared current-entry ${entry}`);
      continue;
    }
    const first = firstSnapshots.get(entry)!;
    const final = readTask12ReceiptStoreSnapshotV1(path.join(store.directory, entry));
    if (final.mode !== 0o600 || !sameRegularMetadata(first.stats, final.stats) || !first.bytes.equals(final.bytes)) {
      currentEntryFail(`prepared current-entry member ${entry} changed after validation`);
    }
  }
  assertDirectory(store.directory, storeBefore, "prepared current-entry store");
  return operation;
}

export async function prepareInternalProductionCurrentEntryOperationV1(): Promise<InternalProductionCurrentEntryOperationV1> {
  try {
    const store = readCurrentEntryStore();
    const target = Object.freeze({ ...store, basename: CURRENT_ENTRY_FILES.operation });
    const existing = strictCanonicalRecord(readCurrentEntryRecord(target.directory, target.basename, target.device), "current-entry operation");
    const existingPair = Object.freeze({ operationRef: existing.operationRef, operationHash: existing.operationHash });
    const resolved = await resolveInternalProductionCurrentEntryOperationV1(
      requirePair(existingPair, "operationRef", "operationHash", "setfarm://internal-production/current-entry-operation/sha256/") as InternalProductionCurrentEntryOperationPairV1,
    );
    const controllerLock = await acquireTask12ControllerLockV1(resolved.operationHash);
    try { return await ensureTask12PreparedCurrentEntryStatusV1(resolved); }
    finally { releaseTask12ControllerLockV1(controllerLock); }
  } catch (error) {
    if (!isEnoent(error)) throw error;
  }
  const s0 = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  const pba0 = await observeCurrentPba();
  const v31 = await observeCurrentInternalProductionAuthorityV3Migration31AuditV1();
  const pending = await observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1();
  const s1 = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  const pba1 = await observeCurrentPba();
  const v31Again = await observeCurrentInternalProductionAuthorityV3Migration31AuditV1();
  const pendingAgain = await observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1();
  if (
    canonicalComparable(s0) !== canonicalComparable(s1)
    || canonicalComparable(pba0) !== canonicalComparable(pba1)
    || canonicalComparable(v31) !== canonicalComparable(v31Again)
    || canonicalComparable(pending) !== canonicalComparable(pendingAgain)
    || canonicalComparable(v31.controllerSource) !== canonicalComparable(s0)
    || canonicalComparable(pending.controllerSource) !== canonicalComparable(s0)
  ) currentEntryFail("current-entry prerequisites changed before publication");
  const body = {
    schema: "setfarm.internal-production-current-entry-operation.v1" as const,
    purpose: "task6a-internal-production-current-entry-v1" as const,
    controllerSource: s0,
    productBuildAuthorityV2DeliveryEvidence: pbaPair(pba0),
    productBuildAuthorityV2Observation: pba0,
    authorityV3Migration31Audit: v31Pair(v31),
    pendingBootstrapHandoffMigration: pendingPair(pending),
  };
  const operationHash = hashCanonicalJson(body);
  const value: InternalProductionCurrentEntryOperationV1 = Object.freeze({ ...body, operationRef: `setfarm://internal-production/current-entry-operation/sha256/${operationHash}`, operationHash });
  await publishCurrentEntryRecord(CURRENT_ENTRY_FILES.operation, await canonicalRecordBytes(value));
  const resolved = await resolveInternalProductionCurrentEntryOperationV1(operationPair(value));
  const finalV31 = await observeCurrentInternalProductionAuthorityV3Migration31AuditV1();
  const finalPending = await observeCurrentInternalProductionPendingBootstrapHandoffMigrationV1();
  const finalSource = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  const finalPba = await observeCurrentPba();
  if (canonicalComparable(finalSource) !== canonicalComparable(s0) || canonicalComparable(finalPba) !== canonicalComparable(pba0) || canonicalComparable(v31Pair(finalV31)) !== canonicalComparable(v31Pair(v31)) || canonicalComparable(pendingPair(finalPending)) !== canonicalComparable(pendingPair(pending))) currentEntryFail("current-entry final equality fence failed");
  const controllerLock = await acquireTask12ControllerLockV1(resolved.operationHash);
  try { return await ensureTask12PreparedCurrentEntryStatusV1(resolved); }
  finally { releaseTask12ControllerLockV1(controllerLock); }
}

export async function resolveInternalProductionCurrentEntryOperationV1(
  pair: InternalProductionCurrentEntryOperationPairV1,
): Promise<InternalProductionCurrentEntryOperationV1> {
  const expected = requirePair(pair, "operationRef", "operationHash", "setfarm://internal-production/current-entry-operation/sha256/");
  const target = fixedCurrentEntryPath("operation");
  const body = strictCanonicalRecord(readCurrentEntryRecord(target.directory, target.basename, target.device), "current-entry operation");
  return parseCurrentEntryOperationBody(body, expected);
}

async function parseCurrentEntryOperationBody(
  body: Record<string, unknown>,
  expected: Readonly<Record<string, string>>,
  publisherValidation = false,
  publisherDependencies?: Readonly<{ v31Body: Record<string, unknown>; pendingBody: Record<string, unknown> }>,
): Promise<InternalProductionCurrentEntryOperationV1> {
  if (!hasExactKeys(body, ["schema", "purpose", "controllerSource", "productBuildAuthorityV2DeliveryEvidence", "productBuildAuthorityV2Observation", "authorityV3Migration31Audit", "pendingBootstrapHandoffMigration", "operationRef", "operationHash"])) currentEntryFail("current-entry operation fields are invalid");
  if (body.schema !== "setfarm.internal-production-current-entry-operation.v1" || body.purpose !== "task6a-internal-production-current-entry-v1") currentEntryFail("current-entry operation discriminator is invalid");
  const projection = { ...body };
  delete projection.operationRef;
  delete projection.operationHash;
  const hash = requireSha256(body.operationHash, "current-entry operation hash");
  if (hashCanonicalJson(projection) !== hash || body.operationRef !== `setfarm://internal-production/current-entry-operation/sha256/${hash}` || expected.operationHash !== hash || expected.operationRef !== body.operationRef) currentEntryFail("current-entry operation pair/hash is invalid");
  const source = requireSource(body.controllerSource);
  let v31: InternalProductionAuthorityV3Migration31AuditV1;
  let pending: InternalProductionPendingBootstrapHandoffMigrationProjectionV1;
  if (publisherValidation) {
    const v31Expected = requirePair(body.authorityV3Migration31Audit, "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "setfarm://internal-production/authority-v3-migration31-audit/sha256/");
    const v31Body = publisherDependencies?.v31Body ?? (() => {
      const target = fixedCurrentEntryPath("authorityV3Migration31Audit");
      return strictCanonicalRecord(publisherEntry(target.directory, target.basename, target.device).bytes, "publisher v31 audit");
    })();
    v31 = await parseAuthorityV3Migration31AuditBody(v31Body, v31Expected);
    const pendingExpected = requirePair(body.pendingBootstrapHandoffMigration, "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash", "setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/");
    const pendingBody = publisherDependencies?.pendingBody ?? (() => {
      const target = fixedCurrentEntryPath("pendingBootstrapHandoffMigration");
      return strictCanonicalRecord(publisherEntry(target.directory, target.basename, target.device).bytes, "publisher pending migration");
    })();
    pending = parsePendingBootstrapHandoffMigrationBody(pendingBody, pendingExpected);
  } else {
    v31 = await resolveInternalProductionAuthorityV3Migration31AuditV1(body.authorityV3Migration31Audit as InternalProductionAuthorityV3Migration31AuditPairV1);
    pending = await resolveInternalProductionPendingBootstrapHandoffMigrationV1(body.pendingBootstrapHandoffMigration as InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1);
  }
  if (canonicalComparable(v31.controllerSource) !== canonicalComparable(source) || canonicalComparable(pending.controllerSource) !== canonicalComparable(source)) currentEntryFail("current-entry nested source is crossed");
  const pba = await import("./product-build-authority-v2-delivery-evidence-v1.js") as Readonly<{ parseProductBuildAuthorityV2DeliveryEvidenceResponseV1?: (value: unknown) => Readonly<Record<string, unknown>> }>;
  if (!isPlainRecord(body.productBuildAuthorityV2Observation) || !hasExactKeys(body.productBuildAuthorityV2Observation, ["schema", "observationTransport", "response"]) || body.productBuildAuthorityV2Observation.schema !== "setfarm.product-build-authority-v2-delivery-evidence-observation.v1" || body.productBuildAuthorityV2Observation.observationTransport !== "source-cli" || typeof pba.parseProductBuildAuthorityV2DeliveryEvidenceResponseV1 !== "function") currentEntryFail("stored PBA observation is invalid");
  const parsed = pba.parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(body.productBuildAuthorityV2Observation.response);
  const parsedPair = pbaPair(Object.freeze({ schema: "setfarm.product-build-authority-v2-delivery-evidence-observation.v1", observationTransport: "source-cli", response: parsed }) as ProductBuildAuthorityObservationV1);
  if (!isPlainRecord(body.productBuildAuthorityV2DeliveryEvidence) || !hasExactKeys(body.productBuildAuthorityV2DeliveryEvidence, ["deliveryEvidenceRef", "deliveryEvidenceHash"]) || body.productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceRef !== parsedPair.deliveryEvidenceRef || body.productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceHash !== parsedPair.deliveryEvidenceHash || canonicalComparable(body.productBuildAuthorityV2Observation.response) !== canonicalComparable(parsed)) currentEntryFail("stored PBA pair/response is crossed");
  return recursivelyFreeze(body as unknown as InternalProductionCurrentEntryOperationV1);
}

export type InternalProductionServiceCensusSpawnerV1 = Readonly<{
  pid: number;
  processStartTimeEpochMs: number;
  processIdentityHash: Sha256V1;
  serviceIdentityHash: Sha256V1;
  generationHash: Sha256V1;
  loadedSourceSha: string;
  loadedTreeHash: string;
  loadedBuildHash: Sha256V1;
  processOwnerCount: 1;
  listener: null;
}>;

type InternalProductionListeningServiceCensusV1 = Readonly<{
  pid: number;
  processStartTimeEpochMs: number;
  processIdentityHash: Sha256V1;
  serviceIdentityHash: Sha256V1;
  generationHash: Sha256V1;
  loadedSourceSha: string | null;
  loadedTreeHash: string | null;
  loadedBuildHash: Sha256V1 | null;
  processOwnerCount: 1;
  listenerOwnerCount: 1;
  listener: Readonly<{
    host: "127.0.0.1";
    port: 3333 | 3080 | 18789;
    listenerIdentityHash: Sha256V1;
  }>;
}>;

export type InternalProductionServiceCensusV1 = Readonly<{
  schema: "setfarm.internal-production-service-census.v1";
  spawner: InternalProductionServiceCensusSpawnerV1;
  dashboard: InternalProductionListeningServiceCensusV1;
  missionControl: InternalProductionListeningServiceCensusV1;
  openClaw: InternalProductionListeningServiceCensusV1;
  censusHash: Sha256V1;
}>;

export type InternalProductionLegacyPreManifestZeroOwnerObservationPairV1 = Readonly<{
  observationRef: CanonicalRefV1;
  observationHash: Sha256V1;
}>;

export type InternalProductionLegacyPreManifestZeroOwnerObservationV1 = Readonly<{
  schema: "setfarm.internal-production-legacy-pre-manifest-zero-owner-observation.v1";
  observationKind: "legacy-pre-manifest-existing-live-truth";
  authorityV3Migration31AuditRef: CanonicalRefV1;
  authorityV3Migration31AuditHash: Sha256V1;
  cleanSetfarmSourceSha: string;
  cleanSetfarmTreeHash: string;
  cleanSetfarmBuildHash: Sha256V1;
  observedSpawnerGenerationHash: Sha256V1;
  census: InternalProductionCompleteZeroOwnerCensusV1;
  allThirtySixScalarCountsZero: true;
  ownerReservationSidecarState: "absent-before-migration-32";
  ownerAdmissionHeadState: "absent-before-migration-32";
  manifestActivationState: "absent-before-initial-a-activation";
  observationRef: CanonicalRefV1;
  observationHash: Sha256V1;
}>;

const LEGACY_ZERO_STORE_V1 = "data/internal-production-baseline/legacy-pre-manifest-zero-owner-observation-v1";
const LEGACY_ZERO_PREFIX_V1 = "setfarm://internal-production/legacy-pre-manifest-zero-owner-observation/sha256/";
const COMPLETE_ZERO_CENSUS_KEYS_V1 = Object.freeze([
  "activeRunCount", "openClaimCount", "executionAttemptCount", "activeRuntimeSessionCount",
  "activeCompletionOwnerCount", "unsettledMandatoryEffectCount", "ordinaryStartingCount",
  "restartReservationCount", "serviceRestartOperationCount", "launchPreparationCount",
  "preparedLaunchCount", "stagedCaseCount", "fixtureAttemptCount", "artifactReservationCount",
  "publicationBatchCount", "artifactPublicationCount", "docsSessionCount", "docsLeaseCount",
  "fleetStageCount", "fleetInflightCount", "fleetPendingReviewCount", "matrixInflightCount",
  "launchOutboxCount", "terminationOwnerCount", "findingOwnerCount", "recoveryOwnerCount",
  "operationalDeliveryCount", "sourceRunOwnerCount", "coldRehearsalOwnerCount",
  "compilationLeaseCount", "executionLeaseCount", "ownedProcessCount", "ownedListenerCount",
  "ownedWorktreeCount", "dirtyWorktreeCount", "staleChildCount",
] as const satisfies readonly (keyof InternalProductionCompleteZeroOwnerCensusV1)[]);

const PHYSICAL_COMMAND_CAP_V1 = 1_048_576;
const PHYSICAL_ENTRY_CAP_V1 = 256;
const PHYSICAL_PROCESS_CAP_V1 = 4_096;
const PHYSICAL_ENV_V1 = Object.freeze({
  PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
  LANG: "C",
  LC_ALL: "C",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_NO_REPLACE_OBJECTS: "1",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_TERMINAL_PROMPT: "0",
});
const PHYSICAL_OWNER_HOME_V1 = userInfo().homedir;
const PHYSICAL_WORKSPACE_BASE_V1 = path.join(PHYSICAL_OWNER_HOME_V1, "ai", "setrox");
const FIXED_WORKTREE_BASES_V1 = Object.freeze([
  path.join(PHYSICAL_WORKSPACE_BASE_V1, ".worktrees"),
  path.join(PHYSICAL_WORKSPACE_BASE_V1, "setfarm", ".worktrees"),
  path.join(PHYSICAL_WORKSPACE_BASE_V1, "mission-control", ".worktrees"),
  path.join(PHYSICAL_OWNER_HOME_V1, ".openclaw", "workspace", "agent-scratch", "story-worktrees"),
]);
const WORKFLOW_BASE_V1 = path.join(PHYSICAL_OWNER_HOME_V1, ".openclaw", "workspaces", "workflows");
const PROJECTS_BASE_V1 = path.join(PHYSICAL_OWNER_HOME_V1, "projects");
const PHYSICAL_NAME_V1 = /^[A-Za-z0-9._-]+$/;

type PhysicalProcessV1 = Readonly<{
  uid: number; pid: number; ppid: number; pgid: number; stat: string;
  lstart: string; command: string; cwd: string | null;
}>;

type PhysicalInventoryV1 = Readonly<{
  worktrees: readonly Readonly<{ root: string; dirty: boolean }>[];
  processes: readonly PhysicalProcessV1[];
  listeners: readonly Readonly<{ pid: number; protocol: "TCP"; localAddress: string; port: number }>[];
  stale: readonly number[];
  ownedProcessCount: number; ownedListenerCount: number; ownedWorktreeCount: number;
  dirtyWorktreeCount: number; staleChildCount: number;
}>;

function runPhysicalCommandV1(executable: string, args: readonly string[], accepted: readonly number[] = [0]): Readonly<{ status: number; stdout: Buffer }> {
  const result = spawnSync(executable, [...args], {
    env: PHYSICAL_ENV_V1,
    shell: false,
    encoding: "buffer",
    timeout: 10_000,
    maxBuffer: PHYSICAL_COMMAND_CAP_V1,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? "");
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.from(result.stderr ?? "");
  if (result.error || result.signal || result.status === null || !accepted.includes(result.status) || stderr.length !== 0 || stdout.length > PHYSICAL_COMMAND_CAP_V1) {
    currentEntryFail(`physical command failed: ${executable} ${args.join(" ")}`);
  }
  return Object.freeze({ status: result.status, stdout });
}

function requirePhysicalDirectoryV1(target: string, label: string): void {
  let observed: BigIntStats;
  try { observed = lstatSync(target, { bigint: true }); } catch { return currentEntryFail(`${label} is absent`); }
  if (!observed.isDirectory() || observed.isSymbolicLink() || realpathSync(target) !== target) currentEntryFail(`${label} is not one real directory`);
}

function boundedPhysicalChildrenV1(root: string): readonly string[] {
  requirePhysicalDirectoryV1(root, `physical base ${root}`);
  const names = readdirSync(root).sort(compareBytes);
  if (names.length > PHYSICAL_ENTRY_CAP_V1) currentEntryFail(`physical base ${root} exceeds the entry cap`);
  const children: string[] = [];
  for (const name of names) {
    if (!PHYSICAL_NAME_V1.test(name)) currentEntryFail(`physical base ${root} contains a noncanonical child`);
    const child = path.join(root, name);
    const observed = lstatSync(child, { bigint: true });
    if (observed.isSymbolicLink()) currentEntryFail(`physical base ${root} contains a symlink child`);
    if (observed.isDirectory()) children.push(child);
  }
  return Object.freeze(children);
}

function physicalManagedBasesV1(): readonly string[] {
  const roots = [...FIXED_WORKTREE_BASES_V1];
  for (const workflow of boundedPhysicalChildrenV1(WORKFLOW_BASE_V1)) {
    const agents = path.join(workflow, "agents");
    for (const agent of boundedPhysicalChildrenV1(agents)) roots.push(path.join(agent, "story-worktrees"));
  }
  for (const project of boundedPhysicalChildrenV1(PROJECTS_BASE_V1)) roots.push(path.join(project, ".worktrees"));
  if (roots.length > PHYSICAL_ENTRY_CAP_V1) currentEntryFail("managed worktree root inventory exceeds the cap");
  for (const root of roots) requirePhysicalDirectoryV1(root, `managed worktree root ${root}`);
  return Object.freeze(roots.sort(compareBytes));
}

function physicalImmediateProjectsV1(): readonly string[] {
  return Object.freeze([...boundedPhysicalChildrenV1(PROJECTS_BASE_V1)].sort(compareBytes));
}

function parseGitWorktreeListV1(bytes: Buffer): readonly string[] {
  const text = strictUtf8(bytes, "Git worktree list");
  if (!text.endsWith("\0")) currentEntryFail("Git worktree list is truncated");
  const worktrees: string[] = [];
  for (const field of text.split("\0")) {
    if (!field) continue;
    if (field.startsWith("worktree ")) {
      const root = field.slice("worktree ".length);
      if (!path.isAbsolute(root) || root !== root.normalize("NFC")) currentEntryFail("Git worktree root is invalid");
      worktrees.push(root);
    }
  }
  if (new Set(worktrees).size !== worktrees.length) currentEntryFail("Git worktree list contains a duplicate");
  return Object.freeze(worktrees);
}

function observeManagedWorktreesV1(): readonly Readonly<{ root: string; dirty: boolean }>[] {
  const bases = physicalManagedBasesV1();
  const physical = bases.flatMap((base) => boundedPhysicalChildrenV1(base));
  if (physical.length > PHYSICAL_ENTRY_CAP_V1 || new Set(physical).size !== physical.length) currentEntryFail("managed worktree inventory is ambiguous");
  const physicalSet = new Set(physical);
  const seenListedNonPrimary = new Set<string>();
  const result: Array<Readonly<{ root: string; dirty: boolean }>> = [];
  for (const candidate of physical.sort(compareBytes)) {
    const listed = parseGitWorktreeListV1(runPhysicalCommandV1("/usr/bin/git", ["-C", candidate, "worktree", "list", "--porcelain", "-z"]).stdout);
    if (listed.length < 2 || listed[0] === candidate || !listed.slice(1).includes(candidate)) currentEntryFail(`Git does not authenticate managed non-primary worktree ${candidate}`);
    for (const item of listed.slice(1)) seenListedNonPrimary.add(item);
    const status = runPhysicalCommandV1("/usr/bin/git", ["-C", candidate, "status", "--porcelain=v2", "--untracked-files=all"]).stdout;
    result.push(Object.freeze({ root: candidate, dirty: status.length !== 0 }));
  }
  if (seenListedNonPrimary.size !== physicalSet.size || [...seenListedNonPrimary].some((item) => !physicalSet.has(item))) currentEntryFail("Git/physical worktree inventories disagree");
  return Object.freeze(result);
}

function parsePhysicalProcessesV1(bytes: Buffer): readonly PhysicalProcessV1[] {
  const text = strictUtf8(bytes, "global process census");
  if (text.includes("\r") || text.includes("\0") || !text.endsWith("\n")) currentEntryFail("global process census is malformed");
  const lines = text.slice(0, -1).split("\n").filter(Boolean);
  if (lines.length > PHYSICAL_PROCESS_CAP_V1) currentEntryFail("global process census exceeds the row cap");
  const result: PhysicalProcessV1[] = [];
  const pids = new Set<number>();
  for (const line of lines) {
    const match = /^\s*(-2|[0-9]+)\s+([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+(\S+)\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+[ 0-9][0-9]\s+[0-9]{2}:[0-9]{2}:[0-9]{2}\s+[0-9]{4})\s+(.+)$/.exec(line);
    if (!match) currentEntryFail("global process row is malformed");
    const [uid, pid, ppid, pgid] = match.slice(1, 5).map(Number);
    if (![uid, pid, ppid, pgid].every(Number.isSafeInteger) || (uid! < 0 && uid !== -2) || pid! < 1 || ppid! < 0 || pgid! < 0 || pids.has(pid!)) currentEntryFail("global process identity is invalid");
    pids.add(pid!);
    result.push(Object.freeze({ uid: uid!, pid: pid!, ppid: ppid!, pgid: pgid!, stat: match[5]!, lstart: match[6]!, command: match[7]!, cwd: null }));
  }
  return Object.freeze(result.sort((left, right) => left.pid - right.pid));
}

function lsofFieldsV1(bytes: Buffer, label: string): readonly string[] {
  const text = strictUtf8(bytes, label);
  if (text.includes("\r") || !text.endsWith("\0\n")) currentEntryFail(`${label} is truncated`);
  return Object.freeze(text.split("\0").map((field) => field.replace(/^\n+/, "")).filter(Boolean));
}

function parseLsofReferencesV1(bytes: Buffer, root: string): Readonly<{ pids: readonly number[]; deleted: readonly number[] }> {
  const pids = new Set<number>();
  const deleted = new Set<number>();
  let currentPid: number | null = null;
  for (const field of lsofFieldsV1(bytes, `lsof reference ${root}`)) {
    if (field[0] === "p") {
      if (!/^[0-9]+$/.test(field.slice(1))) currentEntryFail("lsof reference process identity is malformed");
      const pid = Number(field.slice(1));
      if (!Number.isSafeInteger(pid) || pid < 1 || pids.has(pid)) currentEntryFail("lsof reference process identity is ambiguous");
      currentPid = pid;
      pids.add(pid);
    } else if (field[0] === "n") {
      if (currentPid === null || field.length < 2) currentEntryFail("lsof reference name has no process");
      if (field.endsWith(" (deleted)")) deleted.add(currentPid);
    }
  }
  if (pids.size === 0) currentEntryFail("lsof reference inventory has no process record");
  return Object.freeze({ pids: Object.freeze([...pids].sort((a, b) => a - b)), deleted: Object.freeze([...deleted].sort((a, b) => a - b)) });
}

function lsofReferencedPidsV1(root: string): Readonly<{ pids: readonly number[]; deleted: readonly number[] }> {
  const result = runPhysicalCommandV1("/usr/sbin/lsof", ["-nP", "-F0", "+D", root], [0, 1]);
  if (result.status === 1 && result.stdout.length !== 0) currentEntryFail("empty lsof reference inventory has output");
  if (result.status === 1) return Object.freeze({ pids: Object.freeze([]), deleted: Object.freeze([]) });
  return parseLsofReferencesV1(result.stdout, root);
}

function observeProcessCwdV1(pid: number, expectedPpid: number): string {
  const fields = lsofFieldsV1(runPhysicalCommandV1("/usr/sbin/lsof", ["-a", "-p", String(pid), "-d", "cwd", "-F0pcRfn"]).stdout, `process ${pid} cwd`);
  const pids = fields.filter((field) => field[0] === "p").map((field) => Number(field.slice(1)));
  const parents = fields.filter((field) => field[0] === "R").map((field) => Number(field.slice(1)));
  const cwds = fields.filter((field) => field[0] === "n").map((field) => field.slice(1));
  if (pids.length !== 1 || pids[0] !== pid || parents.length !== 1 || parents[0] !== expectedPpid || cwds.length !== 1 || !path.isAbsolute(cwds[0]!)) currentEntryFail(`process ${pid} cwd identity is ambiguous`);
  return cwds[0]!;
}

function parseProcessListenersV1(bytes: Buffer, pid: number): readonly Readonly<{ pid: number; protocol: "TCP"; localAddress: string; port: number }>[] {
  const fields = lsofFieldsV1(bytes, `process ${pid} listeners`);
  const pids = fields.filter((field) => field[0] === "p").map((field) => Number(field.slice(1)));
  if (pids.length !== 1 || pids[0] !== pid) currentEntryFail(`process ${pid} listener identity is ambiguous`);
  const listeners = fields.filter((field) => field[0] === "n").map((field) => {
    const match = /^(?:TCP\s+)?(.+):([0-9]+)$/.exec(field.slice(1));
    if (!match) currentEntryFail(`process ${pid} listener endpoint is malformed`);
    const port = Number(match[2]);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) currentEntryFail(`process ${pid} listener port is invalid`);
    return Object.freeze({ pid, protocol: "TCP" as const, localAddress: match[1]!, port });
  });
  const keys = listeners.map((listener) => canonicalComparable(listener));
  if (new Set(keys).size !== keys.length) currentEntryFail(`process ${pid} listener inventory contains a duplicate`);
  return Object.freeze(listeners);
}

function observeProcessListenersV1(pid: number): readonly Readonly<{ pid: number; protocol: "TCP"; localAddress: string; port: number }>[] {
  const result = runPhysicalCommandV1("/usr/sbin/lsof", ["-nP", "-a", "-p", String(pid), "-iTCP", "-sTCP:LISTEN", "-F0pcfn"], [0, 1]);
  if (result.status === 1 && result.stdout.length === 0) return Object.freeze([]);
  return parseProcessListenersV1(result.stdout, pid);
}

function assertPhysicalInventoryPassStableV1(first: unknown, second: unknown): void {
  if (canonicalComparable(first) !== canonicalComparable(second)) currentEntryFail("physical inventory changed across observation passes");
}

function observePhysicalInventoryV1(services: InternalProductionServiceCensusV1, activeRunCount: number): PhysicalInventoryV1 {
  if (process.platform !== "darwin") currentEntryFail("physical census requires Darwin");
  const worktrees = observeManagedWorktreesV1();
  const processes = parsePhysicalProcessesV1(runPhysicalCommandV1("/bin/ps", ["-axo", "uid=,pid=,ppid=,pgid=,stat=,lstart=,command="]).stdout);
  const byPid = new Map(processes.map((entry) => [entry.pid, entry]));
  const persistent = [services.spawner, services.dashboard, services.missionControl, services.openClaw];
  for (const service of persistent) {
    const row = byPid.get(service.pid);
    if (!row || Date.parse(row.lstart) !== service.processStartTimeEpochMs || sha256(`${row.pid}\n${row.lstart}\n`) !== service.processIdentityHash) currentEntryFail("persistent service changed during physical census");
  }
  const managedRoots = physicalManagedBasesV1();
  const immediateProjects = physicalImmediateProjectsV1();
  const referencePids = new Set<number>();
  const deletedPids = new Set<number>();
  for (const root of [...managedRoots, ...worktrees.map((entry) => entry.root), ...immediateProjects]) {
    const refs = lsofReferencedPidsV1(root);
    refs.pids.forEach((pid) => referencePids.add(pid));
    refs.deleted.forEach((pid) => deletedPids.add(pid));
  }
  for (const pid of referencePids) if (!Number.isSafeInteger(pid) || pid < 1 || !byPid.has(pid)) currentEntryFail("lsof referenced process disappeared from the physical census");
  const persistentPids = new Set(persistent.map((service) => service.pid));
  const descendantPids = new Set<number>(persistentPids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of processes) if (!descendantPids.has(row.pid) && descendantPids.has(row.ppid)) { descendantPids.add(row.pid); changed = true; }
  }
  const managedPrefixes = [...managedRoots, ...worktrees.map((entry) => entry.root)].map((root) => `${root}/`);
  const projectPrefixes = immediateProjects.map((root) => `${root}/`);
  const commandReferencesExactPath = (command: string, target: string, requireChild: boolean): boolean => {
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const suffix = requireChild ? "\\/[A-Za-z0-9._-]+(?:\\/|$|[^A-Za-z0-9._-])" : "(?:\\/|$|[^A-Za-z0-9._-])";
    return new RegExp(`(?:^|[^A-Za-z0-9._/\\-])${escaped}${suffix}`).test(command);
  };
  const commandReferencesManagedStoryWorktree = (command: string): boolean => managedRoots.some((managedRoot) => {
    if (!managedRoot.endsWith("/story-worktrees")) return false;
    return commandReferencesExactPath(command, managedRoot, true);
  });
  const orphanPattern = /openclaw.*agent.*--session-id\s+spawner-/i;
  const seeds = processes.filter((row) => !persistentPids.has(row.pid) && (
    descendantPids.has(row.pid) || orphanPattern.test(row.command) || referencePids.has(row.pid)
    || commandReferencesManagedStoryWorktree(row.command)
  ));
  const owned: PhysicalProcessV1[] = [];
  const stale = new Set<number>();
  for (const row of seeds) {
    const cwd = observeProcessCwdV1(row.pid, row.ppid);
    const cwdOwned = managedPrefixes.some((prefix) => cwd === prefix.slice(0, -1) || cwd.startsWith(prefix))
      || projectPrefixes.some((prefix) => cwd === prefix.slice(0, -1) || cwd.startsWith(prefix));
    const managedStoryCommand = commandReferencesManagedStoryWorktree(row.command);
    const isOwned = descendantPids.has(row.pid) || orphanPattern.test(row.command) || referencePids.has(row.pid) || cwdOwned || managedStoryCommand;
    if (!isOwned) continue;
    const complete = Object.freeze({ ...row, cwd });
    owned.push(complete);
    const unresolvedStoryWorktree = managedStoryCommand
      && !worktrees.some((worktree) => commandReferencesExactPath(row.command, worktree.root, false));
    if ((orphanPattern.test(row.command) && activeRunCount === 0) || row.stat.includes("Z") || cwd.endsWith(" (deleted)") || deletedPids.has(row.pid) || unresolvedStoryWorktree) stale.add(row.pid);
  }
  const listenerPids = new Set([...persistentPids, ...owned.map((entry) => entry.pid)]);
  const listeners = [...listenerPids].sort((a, b) => a - b).flatMap((pid) => observeProcessListenersV1(pid));
  const expectedListeners = new Set([
    `${services.dashboard.pid}|127.0.0.1|3333`,
    `${services.missionControl.pid}|127.0.0.1|3080`,
    `${services.openClaw.pid}|127.0.0.1|18789`,
  ]);
  const extraListeners = listeners.filter((listener) => !expectedListeners.has(`${listener.pid}|${listener.localAddress}|${listener.port}`));
  const processesAgain = parsePhysicalProcessesV1(runPhysicalCommandV1("/bin/ps", ["-axo", "uid=,pid=,ppid=,pgid=,stat=,lstart=,command="]).stdout);
  assertPhysicalInventoryPassStableV1(processes, processesAgain);
  return recursivelyFreeze({
    worktrees,
    processes: owned.sort((left, right) => left.pid - right.pid),
    listeners: extraListeners.sort((left, right) => left.pid - right.pid || left.port - right.port),
    stale: [...stale].sort((a, b) => a - b),
    ownedProcessCount: owned.length,
    ownedListenerCount: extraListeners.length,
    ownedWorktreeCount: worktrees.length,
    dirtyWorktreeCount: worktrees.filter((entry) => entry.dirty).length,
    staleChildCount: stale.size,
  });
}

function boundedChildText(executable: string, args: readonly string[], label: string, input?: Buffer): string {
  const result = spawnSync(executable, [...args], {
    env: Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }),
    shell: false,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1_048_576,
    input,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
  if (result.error || result.signal || result.status !== 0 || result.stderr !== "") {
    currentEntryFail(`${label} observation failed`);
  }
  return result.stdout;
}

function loadedMissionControlSourceV1(): Readonly<{ sha: string; treeHash: string; buildHash: string }> {
  const identityPath = path.resolve(fixedRepositoryRoot(), "../mission-control/dist-server/internal-production-build-identity.v1.json");
  const value = strictCanonicalRecord(readStableRegular(identityPath, CURRENT_ENTRY_MAX_BYTES, lstatSync(path.dirname(identityPath), { bigint: true }).dev, 1).bytes, "Mission Control build identity");
  if (!hasExactKeys(value, ["schema", "sourceSha", "treeHash", "buildHash"]) || value.schema !== "mission-control.internal-production-build-identity.v1") {
    currentEntryFail("Mission Control build identity is invalid");
  }
  return Object.freeze({
    sha: requireGitHash(value.sourceSha, "Mission Control source SHA"),
    treeHash: requireGitHash(value.treeHash, "Mission Control tree hash"),
    buildHash: requireSha256(value.buildHash, "Mission Control build hash"),
  });
}

const PHASE_CLOSED_FUTURE_PRODUCERS_V1 = Object.freeze([
  ["src/internal-production/internal-production-service-restart-startup-v1.ts", "reserveInternalProductionOrdinaryServiceStartOwnerV1"],
  ["src/internal-production/internal-production-service-restart-authority-v1.ts", "reserveInternalProductionServiceRestartDispatchOwnerV1"],
  ["src/internal-production/internal-production-service-restart-authority-v1.ts", "reserveInternalProductionServiceRestartOperationOwnerV1"],
  ["src/internal-production/golden-run-phase-store.ts", "reserveGoldenLaunchPreparationOwnerV1"],
  ["src/internal-production/golden-run-phase-store.ts", "reserveGoldenPreparedLaunchOwnerV1"],
  ["src/internal-production/golden-run-phase-store.ts", "reserveGoldenLaunchOutboxOwnerV1"],
  ["src/internal-production/golden-matrix-runner.ts", "reserveGoldenStagedCaseOwnerV1"],
  ["src/internal-production/golden-run-harness.ts", "reserveGoldenFixtureAttemptOwnerV1"],
  ["src/internal-production/existing-repository-fixture-catalog.ts", "reserveGoldenExistingRepositoryFixtureAttemptOwnerV1"],
  ["src/internal-production/golden-run-report.ts", "reserveGoldenDocsSessionOwnerV1"],
  ["src/internal-production/golden-run-report.ts", "reserveGoldenDocsLeaseOwnerV1"],
  ["src/internal-production/golden-fleet-scheduler.ts", "reserveGoldenFleetStageOwnerV1"],
  ["src/internal-production/golden-fleet-status-store.ts", "reserveGoldenFleetInflightOwnerV1"],
  ["src/internal-production/golden-fleet-scheduler.ts", "reserveGoldenFleetReviewOwnerV1"],
  ["src/internal-production/golden-matrix-inflight-status-v1.ts", "reserveGoldenMatrixInflightOwnerV1"],
  ["src/internal-production/cold-rehearsal-v1.ts", "reserveColdRehearsalOwnerV1"],
  ["src/internal-production/golden-verifier-runtime.ts", "reserveGoldenCompilationLeaseOwnerV1"],
  ["src/internal-production/golden-verifier-runtime.ts", "reserveGoldenExecutionLeaseOwnerV1"],
] as const);

function requireAbsentPhasePathV1(target: string, label: string): void {
  try {
    lstatSync(target);
  } catch (error) {
    if (isEnoent(error)) return;
    currentEntryFail(`${label} absence is ambiguous`);
  }
  currentEntryFail(`${label} is present before its producer phase`);
}

function requireAbsentProducerLiteralV1(source: string, producer: string): void {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(producer) || source.includes(producer)) {
    currentEntryFail("future producer export is already active");
  }
}

function assertPhaseSourceEqualV1(expected: unknown, observed: unknown): void {
  if (canonicalComparable(expected) !== canonicalComparable(observed)) currentEntryFail("phase-closed source changed or crossed");
}

async function observePhaseClosedZeroV1(
  expectedSource: InternalProductionCleanSetfarmSourceBuildV1,
): Promise<Readonly<{
  ordinaryStartingCount: 0; restartReservationCount: 0; serviceRestartOperationCount: 0;
  launchPreparationCount: 0; preparedLaunchCount: 0; stagedCaseCount: 0; fixtureAttemptCount: 0;
  docsSessionCount: 0; docsLeaseCount: 0; fleetStageCount: 0; fleetInflightCount: 0;
  fleetPendingReviewCount: 0; matrixInflightCount: 0; launchOutboxCount: 0;
  sourceRunOwnerCount: 0; coldRehearsalOwnerCount: 0; compilationLeaseCount: 0; executionLeaseCount: 0;
}>> {
  const codeRoot = fixedRepositoryRoot();
  const before = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  assertPhaseSourceEqualV1(expectedSource, before);
  for (const [locator, producer] of PHASE_CLOSED_FUTURE_PRODUCERS_V1) {
    requireAbsentPhasePathV1(path.join(codeRoot, locator), `${producer} module`);
  }
  const ownBytes = strictUtf8(
    readStableRegular(fileURLToPath(import.meta.url), CURRENT_ENTRY_MAX_BYTES, lstatSync(fileURLToPath(import.meta.url), { bigint: true }).dev, 1).bytes,
    "phase-closed receipt source",
  );
  const sourceRunProducer = ["reserveRecovery", "SourceRunOwnerV1"].join("");
  requireAbsentProducerLiteralV1(ownBytes, sourceRunProducer);
  const runtime = await import("../runtime-config.js") as Readonly<{ runtimeConfig?: Readonly<{ setfarmDir?: unknown }> }>;
  const setfarmDir = runtime.runtimeConfig?.setfarmDir;
  if (typeof setfarmDir !== "string" || !path.isAbsolute(setfarmDir)) currentEntryFail("phase-closed Setfarm authority base is invalid");
  const authorityRoot = path.join(setfarmDir, "internal-production");
  requireAbsentPhasePathV1(authorityRoot, "future producer authority root");
  for (const child of ["golden-results", "fixtures", "recovery", "golden-fleet"]) {
    requireAbsentPhasePathV1(path.join(authorityRoot, child), `future producer authority child ${child}`);
  }
  const after = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  assertPhaseSourceEqualV1(before, after);
  return recursivelyFreeze({
    ordinaryStartingCount: 0, restartReservationCount: 0, serviceRestartOperationCount: 0,
    launchPreparationCount: 0, preparedLaunchCount: 0, stagedCaseCount: 0, fixtureAttemptCount: 0,
    docsSessionCount: 0, docsLeaseCount: 0, fleetStageCount: 0, fleetInflightCount: 0,
    fleetPendingReviewCount: 0, matrixInflightCount: 0, launchOutboxCount: 0,
    sourceRunOwnerCount: 0, coldRehearsalOwnerCount: 0, compilationLeaseCount: 0, executionLeaseCount: 0,
  });
}

type DetachedSetfarmServiceLabelV1 = "com.setrox.setfarm-spawner" | "com.setrox.setfarm-dashboard";

type DetachedSetfarmServiceProfileV1 = Readonly<{
  label: DetachedSetfarmServiceLabelV1;
  launchArguments: readonly string[];
  entrypoint: string;
  daemonArguments: readonly string[];
  port: null | 3333;
}>;

function detachedSetfarmServiceProfileV1(label: DetachedSetfarmServiceLabelV1): DetachedSetfarmServiceProfileV1 {
  const ownerHome = userInfo().homedir;
  const program = path.join(ownerHome, ".local", "bin", "setfarm");
  const repository = fixedRepositoryRoot();
  if (label === "com.setrox.setfarm-spawner") {
    return Object.freeze({
      label,
      launchArguments: Object.freeze([program, "spawner", "start"]),
      entrypoint: path.join(repository, "dist", "spawner.js"),
      daemonArguments: Object.freeze([]),
      port: null,
    });
  }
  return Object.freeze({
    label,
    launchArguments: Object.freeze([program, "dashboard", "start", "--port", "3333"]),
    entrypoint: path.join(repository, "dist", "server", "daemon.js"),
    daemonArguments: Object.freeze(["3333"]),
    port: 3333,
  });
}

function oneLaunchctlScalarV1(text: string, name: string, label: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...text.matchAll(new RegExp(`^\\t${escaped} = (.+)$`, "gm"))];
  if (matches.length !== 1 || !matches[0]![1]) currentEntryFail(`${label} launchctl ${name} is ambiguous`);
  return matches[0]![1];
}

function oneLaunchctlBlockV1(text: string, name: string, label: string): readonly string[] {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...text.matchAll(new RegExp(`^\\t${escaped} = \\{\\n([\\s\\S]*?)^\\t\\}$`, "gm"))];
  if (matches.length !== 1) currentEntryFail(`${label} launchctl ${name} is ambiguous`);
  const lines = matches[0]![1]!.split("\n").filter(Boolean);
  if (lines.some((line) => !line.startsWith("\t\t"))) currentEntryFail(`${label} launchctl ${name} is malformed`);
  return Object.freeze(lines.map((line) => line.slice(2)));
}

function launchctlEnvironmentBlockV1(text: string, name: string, label: string): Readonly<Record<string, string>> {
  const environment: Record<string, string> = {};
  for (const line of oneLaunchctlBlockV1(text, name, label)) {
    const match = /^([A-Za-z][A-Za-z0-9_]*) => (.+)$/.exec(line);
    if (!match || Object.hasOwn(environment, match[1]!)) currentEntryFail(`${label} launchctl ${name} is malformed`);
    environment[match[1]!] = match[2]!;
  }
  return Object.freeze(environment);
}

function observeDetachedLaunchProjectionV1(profile: DetachedSetfarmServiceProfileV1, uid: number): Readonly<{
  path: string; program: string; arguments: readonly string[]; environment: Readonly<Record<string, string>>;
  inheritedEnvironment: Readonly<Record<string, string>>; defaultEnvironment: Readonly<Record<string, string>>;
}> {
  const text = boundedChildText("/bin/launchctl", ["print", `gui/${uid}/${profile.label}`], `${profile.label} launchctl`);
  if (!text.endsWith("\n") || !text.startsWith(`gui/${uid}/${profile.label} = {\n`) || !text.endsWith("}\n")) currentEntryFail(`${profile.label} launchctl envelope is invalid`);
  const pathValue = oneLaunchctlScalarV1(text, "path", profile.label);
  const program = oneLaunchctlScalarV1(text, "program", profile.label);
  const state = oneLaunchctlScalarV1(text, "state", profile.label);
  const type = oneLaunchctlScalarV1(text, "type", profile.label);
  const pidMatches = [...text.matchAll(/^\tpid = ([0-9]+)$/gm)];
  if (state !== "not running" || pidMatches.length !== 0 || type !== "LaunchAgent") currentEntryFail(`${profile.label} launcher is not in its stable detached state`);
  const expectedPath = path.join(userInfo().homedir, "Library", "LaunchAgents", `${profile.label}.plist`);
  if (pathValue !== expectedPath || program !== profile.launchArguments[0]) currentEntryFail(`${profile.label} launchctl program is crossed`);
  const argumentsValue = oneLaunchctlBlockV1(text, "arguments", profile.label);
  if (canonicalComparable(argumentsValue) !== canonicalComparable(profile.launchArguments)) currentEntryFail(`${profile.label} launchctl arguments are crossed`);
  if (oneLaunchctlScalarV1(text, "run interval", profile.label) !== "60 seconds") currentEntryFail(`${profile.label} launch interval is invalid`);
  const properties = oneLaunchctlScalarV1(text, "properties", profile.label).split(" | ");
  if (!properties.includes("runatload")) currentEntryFail(`${profile.label} is not configured to run at load`);
  const environment = launchctlEnvironmentBlockV1(text, "environment", profile.label);
  const inheritedEnvironment = launchctlEnvironmentBlockV1(text, "inherited environment", profile.label);
  const defaultEnvironment = launchctlEnvironmentBlockV1(text, "default environment", profile.label);
  const expectedEnvironmentKeys = profile.label === "com.setrox.setfarm-dashboard"
    ? ["OSLogRateLimit", "PATH", "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL", "XPC_SERVICE_NAME"]
    : ["OSLogRateLimit", "PATH", "SETFARM_PG_URL", "XPC_SERVICE_NAME"];
  if (!hasExactKeys(environment, expectedEnvironmentKeys) || environment.OSLogRateLimit !== "64" || environment.XPC_SERVICE_NAME !== profile.label) currentEntryFail(`${profile.label} loaded launch environment is invalid`);
  const primarySetfarmScripts = path.join(userInfo().homedir, "ai", "setrox", "setfarm", "scripts");
  if (!hasExactKeys(inheritedEnvironment, ["SETFARM_ENV_DIR", "SSH_AUTH_SOCK"]) || inheritedEnvironment.SETFARM_ENV_DIR !== primarySetfarmScripts || !/^\/var\/run\/com\.apple\.launchd\.[A-Za-z0-9]+\/Listeners$/.test(inheritedEnvironment.SSH_AUTH_SOCK ?? "")) currentEntryFail(`${profile.label} inherited launch environment is invalid`);
  if (!hasExactKeys(defaultEnvironment, ["PATH"]) || defaultEnvironment.PATH !== "/usr/bin:/bin:/usr/sbin:/sbin") currentEntryFail(`${profile.label} default launch environment is invalid`);
  return recursivelyFreeze({ path: pathValue, program, arguments: argumentsValue, environment, inheritedEnvironment, defaultEnvironment });
}

function observeDetachedLaunchPlistV1(profile: DetachedSetfarmServiceProfileV1): Readonly<{ bytes: Buffer; stats: BigIntStats; environment: Readonly<Record<string, string>> }> {
  const plistPath = path.join(userInfo().homedir, "Library", "LaunchAgents", `${profile.label}.plist`);
  const parent = lstatSync(path.dirname(plistPath), { bigint: true });
  const observed = readStableRegular(plistPath, CURRENT_ENTRY_MAX_BYTES, parent.dev, 1);
  if ((Number(observed.stats.mode & 0o7777n) & 0o022) !== 0 || observed.stats.uid !== BigInt(process.getuid?.() ?? -1)) currentEntryFail(`${profile.label} plist ownership is invalid`);
  const converted = boundedChildText("/usr/bin/plutil", ["-convert", "json", "-o", "-", "-"], `${profile.label} plist`, observed.bytes);
  let parsed: unknown;
  try { parsed = JSON.parse(converted); } catch { currentEntryFail(`${profile.label} plist is not JSON`); }
  if (!isPlainRecord(parsed) || !hasExactKeys(parsed, ["EnvironmentVariables", "Label", "ProgramArguments", "RunAtLoad", "StandardErrorPath", "StandardOutPath", "StartInterval"])) currentEntryFail(`${profile.label} plist keys are invalid`);
  if (parsed.Label !== profile.label || parsed.RunAtLoad !== true || parsed.StartInterval !== 60 || canonicalComparable(parsed.ProgramArguments) !== canonicalComparable(profile.launchArguments)) currentEntryFail(`${profile.label} plist body is crossed`);
  if (!isPlainRecord(parsed.EnvironmentVariables)) currentEntryFail(`${profile.label} plist environment is invalid`);
  const environmentKeys = profile.label === "com.setrox.setfarm-dashboard"
    ? ["PATH", "SETFARM_OPERATIONAL_WRITE_TOKEN", "SETFARM_PG_URL"]
    : ["PATH", "SETFARM_PG_URL"];
  if (!hasExactKeys(parsed.EnvironmentVariables, environmentKeys)) currentEntryFail(`${profile.label} plist environment keys are invalid`);
  const environment: Record<string, string> = {};
  for (const key of environmentKeys) {
    if (typeof parsed.EnvironmentVariables[key] !== "string" || parsed.EnvironmentVariables[key].length === 0) currentEntryFail(`${profile.label} plist environment value is invalid`);
    environment[key] = parsed.EnvironmentVariables[key];
  }
  const expectedLog = path.join(userInfo().homedir, ".openclaw", "logs", profile.label === "com.setrox.setfarm-spawner" ? "setfarm-spawner.watch" : "setfarm-dashboard.watch");
  if (parsed.StandardOutPath !== `${expectedLog}.log` || parsed.StandardErrorPath !== `${expectedLog}.err.log`) currentEntryFail(`${profile.label} plist log path is crossed`);
  return Object.freeze({ bytes: observed.bytes, stats: observed.stats, environment: Object.freeze(environment) });
}

function sameStableRegularV1(left: Readonly<{ bytes: Buffer; stats: BigIntStats }>, right: Readonly<{ bytes: Buffer; stats: BigIntStats }>): boolean {
  return left.bytes.equals(right.bytes) && sameRegularMetadata(left.stats, right.stats);
}

function observeDetachedServiceListenersV1(pid: number, port: null | 3333): Readonly<{
  bytes: Buffer;
  listeners: readonly Readonly<{ pid: number; protocol: "TCP"; localAddress: string; port: number }>[];
}> {
  const network = port === null ? "-iTCP" : `-iTCP@127.0.0.1:${port}`;
  const result = runPhysicalCommandV1("/usr/sbin/lsof", ["-nP", "-a", "-p", String(pid), network, "-sTCP:LISTEN", "-F0pcfn"], [0, 1]);
  if (result.status === 1 && result.stdout.length === 0) return Object.freeze({ bytes: result.stdout, listeners: Object.freeze([]) });
  if (result.status !== 0) currentEntryFail(`process ${pid} listener inventory is partial`);
  return Object.freeze({ bytes: result.stdout, listeners: parseProcessListenersV1(result.stdout, pid) });
}

function observeDetachedSetfarmServiceV1(
  label: DetachedSetfarmServiceLabelV1,
  port: null | 3333,
  source: Readonly<{ sha: string; treeHash: string; buildHash: string }>,
): InternalProductionServiceCensusSpawnerV1 | InternalProductionListeningServiceCensusV1 {
  const uid = process.getuid?.();
  if (!Number.isSafeInteger(uid) || (uid ?? -1) < 0) currentEntryFail("service census UID is invalid");
  const profile = detachedSetfarmServiceProfileV1(label);
  if (profile.port !== port) currentEntryFail(`${label} listener profile is crossed`);
  const nodeExecutable = realpathSync(process.execPath);
  const cliLinkBefore = lstatSync(profile.launchArguments[0]!, { bigint: true });
  if (!cliLinkBefore.isSymbolicLink() || cliLinkBefore.nlink !== 1n || cliLinkBefore.uid !== BigInt(uid!)) currentEntryFail(`${label} launcher link is invalid`);
  const cliExecutable = realpathSync(profile.launchArguments[0]!);
  const repository = fixedRepositoryRoot();
  const expectedCli = path.join(repository, "dist", "cli", "cli.js");
  if (cliExecutable !== expectedCli) currentEntryFail(`${label} launcher program is outside the authenticated build root`);
  const entryParent = lstatSync(path.dirname(profile.entrypoint), { bigint: true });
  const entryBefore = readStableRegular(profile.entrypoint, MAX_BUILD_FILE_BYTES_V1, entryParent.dev, 1);
  const plistBefore = observeDetachedLaunchPlistV1(profile);
  const launchBefore = observeDetachedLaunchProjectionV1(profile, uid!);
  for (const [key, value] of Object.entries(plistBefore.environment)) if (launchBefore.environment[key] !== value) currentEntryFail(`${label} loaded launch environment is crossed`);
  const processesBefore = parsePhysicalProcessesV1(runPhysicalCommandV1("/bin/ps", ["-axo", "uid=,pid=,ppid=,pgid=,stat=,lstart=,command="]).stdout);
  const family = processesBefore.filter((candidate) => candidate.command.split(/\s+/).includes(profile.entrypoint));
  if (family.length !== 1) currentEntryFail(`${label} detached daemon family count is not exactly one`);
  const candidate = family[0]!;
  const expectedCommand = [nodeExecutable, profile.entrypoint, ...profile.daemonArguments].join(" ");
  if (candidate.command !== expectedCommand || candidate.uid !== uid || candidate.ppid !== 1 || candidate.pgid !== candidate.pid || candidate.stat.includes("Z")) currentEntryFail(`${label} detached daemon identity is invalid`);
  const startTime = Date.parse(candidate.lstart);
  if (!Number.isSafeInteger(startTime) || startTime < 1) currentEntryFail(`${label} detached daemon start is invalid`);
  const commBefore = boundedChildText("/bin/ps", ["-ww", "-p", String(candidate.pid), "-o", "comm="], `${label} executable`);
  if (commBefore !== `${nodeExecutable}\n`) currentEntryFail(`${label} detached daemon executable is crossed`);
  const listenersBefore = observeDetachedServiceListenersV1(candidate.pid, port);
  if (port === null) {
    if (listenersBefore.listeners.length !== 0) currentEntryFail(`${label} has an unexpected listener`);
  } else if (listenersBefore.listeners.length !== 1 || listenersBefore.listeners[0]!.pid !== candidate.pid || listenersBefore.listeners[0]!.localAddress !== "127.0.0.1" || listenersBefore.listeners[0]!.port !== port) {
    currentEntryFail(`${label} listener owner count is not exactly one`);
  }
  const processesAfter = parsePhysicalProcessesV1(runPhysicalCommandV1("/bin/ps", ["-axo", "uid=,pid=,ppid=,pgid=,stat=,lstart=,command="]).stdout);
  const familyAfter = processesAfter.filter((entry) => entry.command.split(/\s+/).includes(profile.entrypoint));
  if (familyAfter.length !== 1) currentEntryFail(`${label} detached daemon family changed during observation`);
  const candidateAfter = familyAfter[0]!;
  if (candidateAfter.stat.includes("Z") || candidateAfter.uid !== candidate.uid || candidateAfter.pid !== candidate.pid || candidateAfter.ppid !== candidate.ppid || candidateAfter.pgid !== candidate.pgid || candidateAfter.lstart !== candidate.lstart || candidateAfter.command !== candidate.command) currentEntryFail(`${label} detached daemon changed during observation`);
  const commAfter = boundedChildText("/bin/ps", ["-ww", "-p", String(candidate.pid), "-o", "comm="], `${label} executable`);
  const listenersAfter = observeDetachedServiceListenersV1(candidate.pid, port);
  const launchAfter = observeDetachedLaunchProjectionV1(profile, uid!);
  const plistAfter = observeDetachedLaunchPlistV1(profile);
  const entryAfter = readStableRegular(profile.entrypoint, MAX_BUILD_FILE_BYTES_V1, entryParent.dev, 1);
  const cliLinkAfter = lstatSync(profile.launchArguments[0]!, { bigint: true });
  if (commAfter !== commBefore || canonicalComparable(listenersAfter) !== canonicalComparable(listenersBefore) || canonicalComparable(launchAfter) !== canonicalComparable(launchBefore) || !sameStableRegularV1(plistBefore, plistAfter) || !sameStableRegularV1(entryBefore, entryAfter) || !cliLinkAfter.isSymbolicLink() || !sameRegularMetadata(cliLinkBefore, cliLinkAfter) || realpathSync(profile.launchArguments[0]!) !== cliExecutable) currentEntryFail(`${label} authority changed during observation`);
  const processIdentityHash = sha256(`${candidate.pid}\n${candidate.lstart}\n`);
  const serviceIdentityHash = hashCanonicalJson({ schema: "setfarm.internal-production-service-identity.v1", label, command: candidate.command });
  const generationHash = hashCanonicalJson({ schema: "setfarm.internal-production-loaded-service-generation.v1", label, serviceIdentityHash, source });
  const common = { pid: candidate.pid, processStartTimeEpochMs: startTime, processIdentityHash, serviceIdentityHash, generationHash, loadedSourceSha: source.sha, loadedTreeHash: source.treeHash, loadedBuildHash: source.buildHash, processOwnerCount: 1 as const };
  if (port === null) return recursivelyFreeze({ ...common, listener: null });
  return recursivelyFreeze({ ...common, listenerOwnerCount: 1 as const, listener: { host: "127.0.0.1" as const, port, listenerIdentityHash: sha256(listenersBefore.bytes) } });
}

function observeServiceProcessV1(
  label: "com.setrox.setfarm-spawner" | "com.setrox.setfarm-dashboard" | "com.setrox.mission-control" | "ai.openclaw.gateway",
  port: null | 3333 | 3080 | 18789,
  source: Readonly<{ sha: string; treeHash: string; buildHash: string }> | null,
): InternalProductionServiceCensusSpawnerV1 | InternalProductionListeningServiceCensusV1 {
  if (label === "com.setrox.setfarm-spawner" || label === "com.setrox.setfarm-dashboard") {
    if (!source) currentEntryFail(`${label} source is absent`);
    return observeDetachedSetfarmServiceV1(label, port as null | 3333, source);
  }
  const uid = process.getuid?.();
  if (!Number.isSafeInteger(uid) || (uid ?? -1) < 0) currentEntryFail("service census UID is invalid");
  const launchctl = boundedChildText("/bin/launchctl", ["print", `gui/${uid}/${label}`], `${label} launchctl`);
  const pidMatches = [...launchctl.matchAll(/^\s*pid = ([0-9]+)\s*$/gm)];
  if (pidMatches.length !== 1) currentEntryFail(`${label} PID is ambiguous`);
  const pid = Number(pidMatches[0]![1]);
  if (!Number.isSafeInteger(pid) || pid < 1) currentEntryFail(`${label} PID is invalid`);
  const ps = boundedChildText("/bin/ps", ["-p", String(pid), "-o", "lstart="], `${label} process`);
  if (!ps.endsWith("\n") || ps.trim().length === 0) currentEntryFail(`${label} process start is invalid`);
  const processStartTimeEpochMs = Date.parse(ps.trim());
  if (!Number.isSafeInteger(processStartTimeEpochMs) || processStartTimeEpochMs < 1) currentEntryFail(`${label} process start is invalid`);
  const processIdentityHash = sha256(`${pid}\n${ps}`);
  const command = boundedChildText("/bin/ps", ["-p", String(pid), "-o", "command="], `${label} command`);
  if (!command.endsWith("\n") || command.slice(0, -1).includes("\n")) currentEntryFail(`${label} command is ambiguous`);
  const allCommands = boundedChildText("/bin/ps", ["-axo", "command="], `${label} global process census`).split("\n");
  const processOwnerCount = allCommands.filter((candidate) => candidate === command.slice(0, -1)).length;
  if (processOwnerCount !== 1) currentEntryFail(`${label} process owner count is not exactly one`);
  if (source !== null) {
    const expectedRoot = label === "com.setrox.mission-control"
      ? path.resolve(fixedRepositoryRoot(), "../mission-control")
      : fixedRepositoryRoot();
    const expectedPrefixes = label === "com.setrox.mission-control"
      ? [`${expectedRoot}/dist-server/`, `${expectedRoot}/dist/`]
      : [`${expectedRoot}/dist/`];
    if (!expectedPrefixes.some((prefix) => command.includes(prefix))) currentEntryFail(`${label} loaded entrypoint is outside its authenticated build root`);
  }
  const serviceIdentityHash = hashCanonicalJson({ schema: "setfarm.internal-production-service-identity.v1", label, command: command.slice(0, -1) });
  const generationHash = hashCanonicalJson({ schema: "setfarm.internal-production-loaded-service-generation.v1", label, serviceIdentityHash, source });
  const common = { pid, processStartTimeEpochMs, processIdentityHash, serviceIdentityHash, generationHash };
  if (port === null) {
    if (!source) currentEntryFail("spawner source is absent");
    return recursivelyFreeze({ ...common, loadedSourceSha: source.sha, loadedTreeHash: source.treeHash, loadedBuildHash: source.buildHash, processOwnerCount: processOwnerCount as 1, listener: null });
  }
  const lsof = boundedChildText("/usr/sbin/lsof", ["-nP", "-a", "-p", String(pid), `-iTCP@127.0.0.1:${port}`, "-sTCP:LISTEN", "-F0pcfn"], `${label} listener`);
  const listenerPids = [...lsof.matchAll(/(?:^|\0\n?)p([0-9]+)\0/g)].map((match) => Number(match[1]));
  const listenerNames = [...lsof.matchAll(/(?:^|\0\n?)n(?:TCP )?127\.0\.0\.1:([0-9]+)\0/g)].map((match) => Number(match[1]));
  if (listenerPids.length !== 1 || listenerPids[0] !== pid || listenerNames.length !== 1 || listenerNames[0] !== port) currentEntryFail(`${label} listener owner count is not exactly one`);
  return recursivelyFreeze({
    ...common,
    loadedSourceSha: source?.sha ?? null,
    loadedTreeHash: source?.treeHash ?? null,
    loadedBuildHash: source?.buildHash ?? null,
    processOwnerCount: processOwnerCount as 1,
    listenerOwnerCount: listenerPids.length as 1,
    listener: { host: "127.0.0.1" as const, port, listenerIdentityHash: sha256(lsof) },
  });
}

export async function observeInternalProductionServiceCensusV1(): Promise<InternalProductionServiceCensusV1> {
  const setfarm = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  const source = Object.freeze({ sha: setfarm.sha, treeHash: setfarm.treeHash, buildHash: setfarm.buildHash });
  const body = {
    schema: "setfarm.internal-production-service-census.v1" as const,
    spawner: observeServiceProcessV1("com.setrox.setfarm-spawner", null, source) as InternalProductionServiceCensusSpawnerV1,
    dashboard: observeServiceProcessV1("com.setrox.setfarm-dashboard", 3333, source) as InternalProductionListeningServiceCensusV1,
    missionControl: observeServiceProcessV1("com.setrox.mission-control", 3080, loadedMissionControlSourceV1()) as InternalProductionListeningServiceCensusV1,
    openClaw: observeServiceProcessV1("ai.openclaw.gateway", 18789, null) as InternalProductionListeningServiceCensusV1,
  };
  return recursivelyFreeze({ ...body, censusHash: hashCanonicalJson(body) });
}

async function observeLegacyDatabaseCensusV1(): Promise<Readonly<{
  activeRunCount: number; openClaimCount: number; executionAttemptCount: number;
  activeRuntimeSessionCount: number; activeCompletionOwnerCount: number; unsettledMandatoryEffectCount: number;
  artifactReservationCount: number; publicationBatchCount: number; artifactPublicationCount: number;
  terminationOwnerCount: number; findingOwnerCount: number; recoveryOwnerCount: number; operationalDeliveryCount: number;
}>> {
  const postgresModule = await import("postgres");
  const databaseUrl = process.env.SETFARM_PG_URL;
  if (!databaseUrl) currentEntryFail("legacy zero-owner database is unavailable");
  const sql = postgresModule.default(databaseUrl, { max: 1, idle_timeout: 1, connect_timeout: 5 });
  try {
    return await sql.begin("isolation level repeatable read read only", async (tx) => {
      const connection = tx as unknown as typeof sql;
      await connection`SET LOCAL statement_timeout = '5s'`;
      await connection`SET LOCAL lock_timeout = '1s'`;
      const rows = await connection<Array<Record<string, unknown>>>`
        WITH required_columns(table_name,column_name,type_name,required_not_null) AS (
          VALUES
            ('runs','status','text',TRUE),
            ('claim_log','outcome','text',FALSE),
            ('execution_attempts','disposition','text',TRUE),
            ('runtime_sessions','state','text',TRUE),
            ('runtime_completion_requests','state','text',TRUE),
            ('runtime_completion_effects','mandatory','boolean',TRUE),
            ('runtime_completion_effects','state','text',TRUE),
            ('artifact_publication_reservations','reservation_id','text',TRUE),
            ('artifact_publication_reservations','artifact_hash','text',TRUE),
            ('artifact_publication_reservations','state','text',TRUE),
            ('artifact_publication_reservations','owner_instance_id','text',FALSE),
            ('artifact_publication_reservations','lease_token','text',FALSE),
            ('artifact_publication_reservations','lease_expires_at','timestamp with time zone',FALSE),
            ('artifact_publication_batches','batch_reservation_id','text',TRUE),
            ('artifact_publication_batches','state','text',TRUE),
            ('artifact_publication_batches','owner_instance_id','text',FALSE),
            ('artifact_publication_batches','lease_token','text',FALSE),
            ('artifact_publication_batches','lease_expires_at','timestamp with time zone',FALSE),
            ('artifact_publication_batch_items','batch_reservation_id','text',TRUE),
            ('artifact_publication_batch_items','artifact_hash','text',TRUE),
            ('artifact_publication_batch_items','reservation_id','text',FALSE),
            ('run_termination_requests','state','text',TRUE),
            ('findings','status','text',TRUE),
            ('recovery_cases','status','text',TRUE),
            ('recovery_dispatch_deliveries','state','text',TRUE),
            ('operational_event_deliveries','state','text',TRUE)
        ), catalog_violations AS (
          SELECT COUNT(*) AS count
          FROM required_columns expected
          LEFT JOIN pg_catalog.pg_class relation
            ON relation.relname=expected.table_name AND relation.relnamespace='public'::regnamespace
          LEFT JOIN pg_catalog.pg_attribute attribute
            ON attribute.attrelid=relation.oid AND attribute.attname=expected.column_name
              AND attribute.attnum>0 AND NOT attribute.attisdropped
          LEFT JOIN pg_catalog.pg_type data_type ON data_type.oid=attribute.atttypid
          WHERE relation.oid IS NULL OR attribute.attname IS NULL
             OR pg_catalog.format_type(data_type.oid,attribute.atttypmod)<>expected.type_name
             OR attribute.attnotnull<>expected.required_not_null
        ), aprb_child_violations AS (
          SELECT COUNT(*) AS count
          FROM public.artifact_publication_reservations reservation
          WHERE reservation.state='reserved' AND left(reservation.reservation_id,5)='APRB_'
            AND (SELECT COUNT(*)
                 FROM public.artifact_publication_batch_items item
                 JOIN public.artifact_publication_batches batch
                   ON batch.batch_reservation_id=item.batch_reservation_id AND batch.state='active'
                 WHERE (item.reservation_id,item.artifact_hash)=(reservation.reservation_id,reservation.artifact_hash)
                   AND reservation.owner_instance_id IS NOT DISTINCT FROM batch.owner_instance_id
                   AND reservation.lease_token IS NOT DISTINCT FROM batch.lease_token
                   AND reservation.lease_expires_at IS NOT DISTINCT FROM batch.lease_expires_at)<>1
        ), ordinary_batch_violations AS (
          SELECT COUNT(*) AS count
          FROM public.artifact_publication_reservations reservation
          JOIN public.artifact_publication_batch_items item
            ON (item.reservation_id,item.artifact_hash)=(reservation.reservation_id,reservation.artifact_hash)
          WHERE reservation.state='reserved' AND left(reservation.reservation_id,5)<>'APRB_'
        ), active_header_violations AS (
          SELECT COUNT(*) AS count
          FROM public.artifact_publication_batches batch
          WHERE batch.state='active' AND NOT EXISTS (
            SELECT 1 FROM public.artifact_publication_batch_items item
            JOIN public.artifact_publication_reservations reservation
              ON (reservation.reservation_id,reservation.artifact_hash)=(item.reservation_id,item.artifact_hash)
            WHERE item.batch_reservation_id=batch.batch_reservation_id
              AND reservation.state='reserved' AND left(reservation.reservation_id,5)='APRB_'
              AND reservation.owner_instance_id IS NOT DISTINCT FROM batch.owner_instance_id
              AND reservation.lease_token IS NOT DISTINCT FROM batch.lease_token
              AND reservation.lease_expires_at IS NOT DISTINCT FROM batch.lease_expires_at)
        )
        SELECT
          (SELECT count FROM catalog_violations)::text AS "catalogViolationCount",
          (SELECT count FROM aprb_child_violations)::text AS "aprbChildViolationCount",
          (SELECT count FROM ordinary_batch_violations)::text AS "ordinaryBatchViolationCount",
          (SELECT count FROM active_header_violations)::text AS "activeHeaderViolationCount",
          to_regclass('public.internal_production_owner_reservations_v1')::text AS "ownerReservationsRelation",
          to_regclass('public.internal_production_owner_admission_head_v1')::text AS "ownerAdmissionHeadRelation",
          to_regclass('public.internal_production_owner_producer_source_build_authorities_v1')::text AS "producerSourceRelation",
          to_regclass('public.internal_production_owner_producer_manifest_set_activations_v1')::text AS "producerActivationRelation",
          to_regclass('public.internal_production_owner_producer_manifest_activation_heads_v1')::text AS "producerActivationHeadRelation",
          to_regclass('public.internal_production_owner_producer_manifest_set_current_v1')::text AS "producerCurrentRelation",
          (SELECT COUNT(*) FROM public.runs WHERE status IN ('running','resuming','cancelling','failing'))::text AS "activeRunCount",
          (SELECT COUNT(*) FROM public.claim_log WHERE outcome IS NULL)::text AS "openClaimCount",
          (SELECT COUNT(*) FROM public.execution_attempts WHERE disposition IN ('claimed','running'))::text AS "executionAttemptCount",
          (SELECT COUNT(*) FROM public.runtime_sessions WHERE state NOT IN ('released','quarantined'))::text AS "activeRuntimeSessionCount",
          (SELECT COUNT(*) FROM public.runtime_completion_requests WHERE state NOT IN ('accepted','rejected','quarantined'))::text AS "activeCompletionOwnerCount",
          (SELECT COUNT(*) FROM public.runtime_completion_effects WHERE mandatory IS TRUE AND state NOT IN ('applied','reconciled'))::text AS "unsettledMandatoryEffectCount",
          (SELECT COUNT(*) FROM public.artifact_publication_reservations reservation WHERE reservation.state='reserved' AND left(reservation.reservation_id,5)<>'APRB_')::text AS "artifactReservationCount",
          (SELECT COUNT(*) FROM public.artifact_publication_batches WHERE state='active')::text AS "publicationBatchCount",
          (SELECT COUNT(*) FROM public.artifact_publication_batch_items item
             JOIN public.artifact_publication_reservations reservation
               ON (reservation.reservation_id,reservation.artifact_hash)=(item.reservation_id,item.artifact_hash)
             JOIN public.artifact_publication_batches batch
               ON batch.batch_reservation_id=item.batch_reservation_id
            WHERE reservation.state='reserved' AND left(reservation.reservation_id,5)='APRB_' AND batch.state='active')::text AS "artifactPublicationCount",
          (SELECT COUNT(*) FROM public.run_termination_requests WHERE state<>'terminalized')::text AS "terminationOwnerCount",
          (SELECT COUNT(*) FROM public.findings WHERE status='open')::text AS "findingOwnerCount",
          ((SELECT COUNT(*) FROM public.recovery_cases WHERE status IN ('open','repairing','evidencing'))
            +(SELECT COUNT(*) FROM public.recovery_dispatch_deliveries WHERE state IN ('authorized','leased','attempt_reserved','running')))::text AS "recoveryOwnerCount",
          (SELECT COUNT(*) FROM public.operational_event_deliveries WHERE state IN ('pending','leased'))::text AS "operationalDeliveryCount"
      `;
      if (rows.length !== 1 || !isPlainRecord(rows[0])) currentEntryFail("legacy zero-owner database aggregate must return exactly one row");
      const row = rows[0]!;
      for (const relationKey of [
        "ownerReservationsRelation", "ownerAdmissionHeadRelation", "producerSourceRelation",
        "producerActivationRelation", "producerActivationHeadRelation", "producerCurrentRelation",
      ]) if (row[relationKey] !== null) currentEntryFail(`legacy zero-owner database ${relationKey} is present`);
      const parseCount = (key: string): number => {
        const raw = row[key];
        if (typeof raw !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(raw)) currentEntryFail(`${key} is not a canonical nonnegative integer`);
        const count = Number(raw);
        if (!Number.isSafeInteger(count)) currentEntryFail(`${key} exceeds the safe-integer boundary`);
        return count;
      };
      for (const key of ["catalogViolationCount", "aprbChildViolationCount", "ordinaryBatchViolationCount", "activeHeaderViolationCount"]) {
        if (parseCount(key) !== 0) currentEntryFail(`${key} is nonzero`);
      }
      const observed = Object.freeze({
        activeRunCount: parseCount("activeRunCount"),
        openClaimCount: parseCount("openClaimCount"),
        executionAttemptCount: parseCount("executionAttemptCount"),
        activeRuntimeSessionCount: parseCount("activeRuntimeSessionCount"),
        activeCompletionOwnerCount: parseCount("activeCompletionOwnerCount"),
        unsettledMandatoryEffectCount: parseCount("unsettledMandatoryEffectCount"),
        artifactReservationCount: parseCount("artifactReservationCount"),
        publicationBatchCount: parseCount("publicationBatchCount"),
        artifactPublicationCount: parseCount("artifactPublicationCount"),
        terminationOwnerCount: parseCount("terminationOwnerCount"),
        findingOwnerCount: parseCount("findingOwnerCount"),
        recoveryOwnerCount: parseCount("recoveryOwnerCount"),
        operationalDeliveryCount: parseCount("operationalDeliveryCount"),
      });
      for (const [key, count] of Object.entries(observed)) if (count !== 0) currentEntryFail(`${key} is nonzero`);
      return recursivelyFreeze(observed);
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function reobserveStoredMigration31AuditV1(audit: InternalProductionAuthorityV3Migration31AuditV1): Promise<void> {
  const ports = await import("../db-pg.js") as Readonly<{
    auditCurrentInternalProductionAuthorityV3Migration31V1?: () => Promise<Readonly<{ authorityV3ContractSpineThroughMigration31: Migration31AuditDataV1; currentAuthorityAudit: CurrentAuthorityAuditV1 }>>;
  }>;
  if (typeof ports.auditCurrentInternalProductionAuthorityV3Migration31V1 !== "function") currentEntryFail("legacy zero-owner current v31 audit port is unavailable");
  const observed = await ports.auditCurrentInternalProductionAuthorityV3Migration31V1();
  requireAuthorityV3Migration31Audit(observed.authorityV3ContractSpineThroughMigration31);
  requireCurrentAuthorityAudit(observed.currentAuthorityAudit);
  if (canonicalComparable(observed.authorityV3ContractSpineThroughMigration31) !== canonicalComparable(audit.authorityV3ContractSpineThroughMigration31) || canonicalComparable(observed.currentAuthorityAudit) !== canonicalComparable(audit.currentAuthorityAudit) || hashCanonicalJson(observed.currentAuthorityAudit) !== audit.currentAuthorityAuditHash) currentEntryFail("legacy zero-owner current v31 audit drifted");
}

function legacyZeroPathV1(hash: string): string {
  return fixedWorkspaceAuthorityPathV1(LEGACY_ZERO_STORE_V1, "records", "sha256", hash.slice(0, 2), `${hash}.json`);
}

type Task12ReceiptDirectoryGuardV1 = Readonly<{ assertStable: () => void; close: () => void }>;

function task12ReceiptStoreAnchorV1(target: string): string {
  const repository = path.resolve(fixedRepositoryRoot());
  const workspace = path.dirname(repository);
  const resolved = path.resolve(target);
  const within = (anchor: string): boolean => {
    const relative = path.relative(anchor, resolved);
    return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  };
  if (within(repository)) return repository;
  if (within(workspace)) return workspace;
  currentEntryFail("Task12 receipt store escaped the workspace");
}

function authenticateTask12ReceiptDirectoryChainV1(target: string): Task12ReceiptDirectoryGuardV1 {
  const anchor = task12ReceiptStoreAnchorV1(target);
  const resolved = path.resolve(target);
  const relative = path.relative(anchor, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) currentEntryFail("Task12 receipt store escaped the repository");
  const segments = relative === "" ? [] : relative.split(path.sep);
  const paths = [anchor, ...segments.map((_, index) => path.join(anchor, ...segments.slice(0, index + 1)))];
  const descriptors: number[] = [];
  const identities: BigIntStats[] = [];
  let closed = false;
  const assertStable = (): void => {
    if (closed) currentEntryFail("Task12 receipt directory guard is closed");
    for (const [index, member] of paths.entries()) {
      const atPath = lstatSync(member, { bigint: true });
      const atDescriptor = fstatSync(descriptors[index]!, { bigint: true });
      const expected = identities[index]!;
      if (!atPath.isDirectory() || atPath.isSymbolicLink() || !atDescriptor.isDirectory() || atPath.dev !== expected.dev || atPath.ino !== expected.ino || atPath.mode !== expected.mode || atDescriptor.dev !== expected.dev || atDescriptor.ino !== expected.ino || atDescriptor.mode !== expected.mode) currentEntryFail("Task12 receipt directory chain changed");
    }
  };
  try {
    for (const [index, member] of paths.entries()) {
      const before = lstatSync(member, { bigint: true });
      const descriptor = openSync(member, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
      descriptors.push(descriptor);
      const observed = fstatSync(descriptor, { bigint: true });
      if (!before.isDirectory() || before.isSymbolicLink() || !observed.isDirectory() || before.dev !== observed.dev || before.ino !== observed.ino || before.mode !== observed.mode || before.nlink !== observed.nlink || before.nlink < 1n || (index > 0 && (observed.mode & 0o7777n) !== 0o700n) || (index > 0 && observed.dev !== identities[0]!.dev)) currentEntryFail("Task12 receipt private directory identity is invalid");
      identities.push(observed);
    }
    assertStable();
    return Object.freeze({
      assertStable,
      close: () => {
        if (closed) currentEntryFail("Task12 receipt directory guard closed twice");
        closed = true;
        for (const descriptor of descriptors.reverse()) closeSync(descriptor);
      },
    });
  } catch (error) {
    closed = true;
    for (const descriptor of descriptors.reverse()) closeSync(descriptor);
    throw error;
  }
}

function ensureTask12ReceiptPrivateDirectoryV1(target: string): Task12ReceiptDirectoryGuardV1 {
  const anchor = task12ReceiptStoreAnchorV1(target);
  const resolved = path.resolve(target);
  const relative = path.relative(anchor, resolved);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) currentEntryFail("Task12 receipt store escaped the repository");
  let current = anchor;
  for (const segment of relative.split(path.sep)) {
    if (!segment || segment === "." || segment === "..") currentEntryFail("Task12 receipt directory member is invalid");
    const parent = authenticateTask12ReceiptDirectoryChainV1(current);
    current = path.join(current, segment);
    try {
      parent.assertStable();
      try { mkdirSync(current, { mode: 0o700 }); } catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error; }
      parent.assertStable();
    } finally { parent.close(); }
    const created = authenticateTask12ReceiptDirectoryChainV1(current);
    created.close();
  }
  return authenticateTask12ReceiptDirectoryChainV1(resolved);
}

function task12ReceiptCanonicalBytesV1(value: unknown): Buffer {
  const bytes = Buffer.from(`${canonicalComparable(value)}\n`, "utf8");
  if (bytes.length < 1 || bytes.length > CURRENT_ENTRY_MAX_BYTES) currentEntryFail("Task12 receipt record size is invalid");
  return bytes;
}

function readTask12ReceiptDescriptorBytesV1(descriptor: number, size: bigint): Buffer {
  if (size < 0n || size > BigInt(CURRENT_ENTRY_MAX_BYTES)) currentEntryFail("Task12 receipt descriptor size is invalid");
  const bytes = Buffer.alloc(Number(size));
  if (readSync(descriptor, bytes, 0, bytes.length, 0) !== bytes.length) currentEntryFail("Task12 receipt descriptor read is incomplete");
  return bytes;
}

function readTask12ReceiptStoreSnapshotV1(target: string, expectedLinkCount = 1): StableRegular {
  const guard = authenticateTask12ReceiptDirectoryChainV1(path.dirname(target));
  let descriptor = -1;
  try {
    guard.assertStable();
    const parent = lstatSync(path.dirname(target), { bigint: true });
    descriptor = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = fstatSync(descriptor, { bigint: true });
    const atPath = lstatSync(target, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.dev !== parent.dev || before.dev !== atPath.dev || before.ino !== atPath.ino || before.nlink !== BigInt(expectedLinkCount) || atPath.nlink !== before.nlink || (before.mode & 0o7777n) !== 0o600n || before.size < 1n || before.size > BigInt(CURRENT_ENTRY_MAX_BYTES)) currentEntryFail("Task12 receipt record inode is invalid");
    const bytes = readTask12ReceiptDescriptorBytesV1(descriptor, before.size);
    const after = fstatSync(descriptor, { bigint: true });
    const reopened = lstatSync(target, { bigint: true });
    if (!sameRegularMetadata(before, after) || after.dev !== reopened.dev || after.ino !== reopened.ino || after.mode !== reopened.mode || after.nlink !== reopened.nlink || BigInt(bytes.length) !== after.size) currentEntryFail("Task12 receipt record changed while read");
    guard.assertStable();
    return Object.freeze({ bytes, mode: Number(after.mode & 0o7777n), stats: after });
  } finally {
    if (descriptor >= 0) closeSync(descriptor);
    guard.close();
  }
}

function readTask12ReceiptStoreBytesV1(target: string, expectedLinkCount = 1): Buffer {
  return readTask12ReceiptStoreSnapshotV1(target, expectedLinkCount).bytes;
}

function acquireTask12ReceiptLocatorWriterV1(target: string): Readonly<{ close: () => void }> {
  const directory = path.dirname(target);
  const lockPath = path.join(directory, `.${path.basename(target)}.writer.lock`);
  const tempPrefix = `${path.basename(lockPath)}.tmp-`;
  const targetHash = hashCanonicalJson({ schema: "setfarm.internal-production-task12-receipt-locator-writer-target.v1", target });
  const observe = (pid: number): Readonly<{ state: "live"; start: string; commandHash: string; identityHash: string } | { state: "dead" | "ambiguous" }> => {
    const result = spawnSync("/bin/ps", ["-p", String(pid), "-o", "lstart=", "-o", "command="], { env: Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }), shell: false, encoding: "utf8", timeout: 2_000, maxBuffer: 65_536, stdio: ["ignore", "pipe", "pipe"] });
    if (result.status === 1 && result.stdout === "" && result.stderr === "") return Object.freeze({ state: "dead" as const });
    if (result.error || result.signal || result.status !== 0 || result.stderr !== "" || typeof result.stdout !== "string") return Object.freeze({ state: "ambiguous" as const });
    const match = /^(.{24}) (.+)\n$/.exec(result.stdout);
    if (!match) return Object.freeze({ state: "ambiguous" as const });
    const start = match[1]!; const commandHash = hashCanonicalJson({ schema: "setfarm.internal-production-task12-receipt-writer-command.v1", command: match[2]! });
    return Object.freeze({ state: "live" as const, start, commandHash, identityHash: hashCanonicalJson({ schema: "setfarm.internal-production-task12-receipt-writer-process.v1", pid, start, commandHash }) });
  };
  const parse = (bytes: Buffer): Record<string, unknown> => {
    const value = strictCanonicalRecord(bytes, "Task12 receipt writer lock");
    if (!hasExactKeys(value, ["schema", "targetHash", "pid", "start", "commandHash", "identityHash", "nonce"]) || value.schema !== "setfarm.internal-production-task12-receipt-locator-writer-lock.v1" || value.targetHash !== targetHash || !Number.isSafeInteger(value.pid) || Number(value.pid) < 1 || typeof value.start !== "string" || !SHA256.test(String(value.commandHash)) || !SHA256.test(String(value.identityHash)) || typeof value.nonce !== "string") currentEntryFail("Task12 receipt writer lock authority is invalid");
    return value;
  };
  const unlinkPinned = (member: string, descriptor: number, identity: BigIntStats, bytes: Buffer, expectedLinkCount = 1n): void => {
    const atPath = lstatSync(member, { bigint: true }); const again = fstatSync(descriptor, { bigint: true }); const observed = readTask12ReceiptDescriptorBytesV1(descriptor, again.size);
    if (!again.isFile() || (again.mode & 0o7777n) !== 0o600n || again.nlink !== expectedLinkCount || atPath.nlink !== expectedLinkCount || again.dev !== identity.dev || again.ino !== identity.ino || again.size !== identity.size || atPath.dev !== identity.dev || atPath.ino !== identity.ino || !observed.equals(bytes)) currentEntryFail("Task12 receipt writer lock changed");
    unlinkSync(member);
  };
  const deadline = Date.now() + 10_000;
  for (;;) {
    const guard = authenticateTask12ReceiptDirectoryChainV1(directory);
    let guardTransferred = false;
    let descriptor = -1;
    let temp = "";
    let identity: BigIntStats | null = null;
    let bytes: Buffer | null = null;
    let linked = false;
    try {
      guard.assertStable();
      const candidates = readdirSync(directory).filter((entry) => entry.startsWith(tempPrefix)).sort(compareBytes);
      if (candidates.length > 8) currentEntryFail("Task12 receipt writer lock temp cap exceeded");
      let busy = false;
      const inspectOwner = (member: string): void => {
        const descriptor = openSync(member, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
          const identity = fstatSync(descriptor, { bigint: true }); const atPath = lstatSync(member, { bigint: true });
          if (!identity.isFile() || (identity.mode & 0o7777n) !== 0o600n || identity.nlink !== 1n || atPath.dev !== identity.dev || atPath.ino !== identity.ino || atPath.mode !== identity.mode || atPath.nlink !== 1n) currentEntryFail("Task12 receipt writer lock changed");
          const bytes = readTask12ReceiptDescriptorBytesV1(descriptor, identity.size); const owner = parse(bytes); const live = observe(Number(owner.pid));
          if (live.state === "ambiguous" || (live.state === "live" && live.start === owner.start && live.commandHash === owner.commandHash && live.identityHash === owner.identityHash)) busy = true;
          else unlinkPinned(member, descriptor, identity, bytes);
        } finally { closeSync(descriptor); }
      };
      for (const entry of candidates) {
        if (!new RegExp(`^${tempPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[1-9][0-9]*-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).test(entry)) currentEntryFail("Task12 receipt writer lock temp name is invalid");
        inspectOwner(path.join(directory, entry));
      }
      try { inspectOwner(lockPath); } catch (error) { if (!isEnoent(error)) throw error; }
      if (busy) {
        if (Date.now() >= deadline) currentEntryFail("Task12 receipt writer lock is busy");
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
        continue;
      }
      const owner = observe(process.pid);
      if (owner.state !== "live") currentEntryFail("Task12 receipt writer process is unavailable");
      const nonce = randomUUID(); const body = { schema: "setfarm.internal-production-task12-receipt-locator-writer-lock.v1", targetHash, pid: process.pid, start: owner.start, commandHash: owner.commandHash, identityHash: owner.identityHash, nonce }; bytes = task12ReceiptCanonicalBytesV1(body);
      temp = path.join(directory, `${tempPrefix}${process.pid}-${nonce}`); descriptor = openSync(temp, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
      writeFileSync(descriptor, bytes); fsyncSync(descriptor); identity = fstatSync(descriptor, { bigint: true });
      try {
        linkSync(temp, lockPath);
        linked = true;
      } catch (error) {
        unlinkPinned(temp, descriptor, identity, bytes);
        temp = "";
        closeSync(descriptor);
        descriptor = -1;
        if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
        if (Date.now() >= deadline) currentEntryFail("Task12 receipt writer lock is busy");
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
        continue;
      }
      unlinkPinned(temp, descriptor, identity, bytes, 2n); temp = ""; fsyncCurrentEntryDirectory(directory); guard.assertStable();
      const heldDescriptor = descriptor;
      const heldIdentity = identity;
      const heldBytes = bytes;
      descriptor = -1;
      guardTransferred = true;
      return Object.freeze({ close: () => {
        try {
          guard.assertStable(); const atPath = lstatSync(lockPath, { bigint: true }); const now = fstatSync(heldDescriptor, { bigint: true }); const reopened = readTask12ReceiptDescriptorBytesV1(heldDescriptor, now.size);
          if (!now.isFile() || (now.mode & 0o7777n) !== 0o600n || now.nlink !== 1n || atPath.dev !== heldIdentity.dev || atPath.ino !== heldIdentity.ino || now.dev !== heldIdentity.dev || now.ino !== heldIdentity.ino || !reopened.equals(heldBytes)) currentEntryFail("Task12 receipt writer lock changed before release");
          unlinkSync(lockPath); fsyncCurrentEntryDirectory(directory); guard.assertStable();
        } finally { closeSync(heldDescriptor); guard.close(); }
      } });
    } catch (error) {
      if (descriptor >= 0 && identity !== null && bytes !== null) {
        try {
          if (linked) {
            const current = fstatSync(descriptor, { bigint: true });
            const atLock = lstatSync(lockPath, { bigint: true });
            const expectedLinks = temp === "" ? 1n : 2n;
            if (!current.isFile() || (current.mode & 0o7777n) !== 0o600n || current.nlink !== expectedLinks || atLock.dev !== identity.dev || atLock.ino !== identity.ino || atLock.nlink !== expectedLinks || !readTask12ReceiptDescriptorBytesV1(descriptor, current.size).equals(bytes)) currentEntryFail("Task12 receipt writer lock changed after acquisition fault");
            unlinkSync(lockPath);
            linked = false;
          }
          if (temp !== "") {
            unlinkPinned(temp, descriptor, identity, bytes);
            temp = "";
          }
          fsyncCurrentEntryDirectory(directory);
        } catch {
          // The primary acquisition failure remains authoritative; crossed
          // cleanup evidence is retained for a later authenticated retry.
        }
      }
      throw error;
    } finally {
      if (descriptor >= 0) closeSync(descriptor);
      if (!guardTransferred) guard.close();
    }
  }
}

function publishLegacyZeroRecordV1(target: string, bytes: Buffer): void {
  if (bytes.length < 1 || bytes.length > CURRENT_ENTRY_MAX_BYTES) currentEntryFail("Task12 receipt publication size is invalid");
  const directory = path.dirname(target);
  const guard = ensureTask12ReceiptPrivateDirectoryV1(directory);
  let writer: Readonly<{ close: () => void }> | null = null;
  let tempDescriptor = -1;
  try {
    guard.assertStable();
    writer = acquireTask12ReceiptLocatorWriterV1(target);
    guard.assertStable();
    const basename = path.basename(target);
    const prefix = `${basename}.tmp-`;
    const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[1-9][0-9]*-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`);
    const candidates = readdirSync(directory).filter((entry) => entry.startsWith(prefix)).sort(compareBytes);
    if (candidates.length > 8) currentEntryFail("Task12 receipt publication temp cap exceeded");
    const pinned: Array<{ path: string; descriptor: number; identity: BigIntStats; bytes: Buffer }> = [];
    try {
      for (const entry of candidates) {
        if (!pattern.test(entry)) currentEntryFail("Task12 receipt publication temp name is invalid");
        const candidate = path.join(directory, entry); const descriptor = openSync(candidate, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); const identity = fstatSync(descriptor, { bigint: true }); const atPath = lstatSync(candidate, { bigint: true }); const observed = readTask12ReceiptDescriptorBytesV1(descriptor, identity.size);
        if (!identity.isFile() || identity.dev !== atPath.dev || identity.ino !== atPath.ino || (identity.mode & 0o7777n) !== 0o600n || ![1n, 2n].includes(identity.nlink) || !observed.equals(bytes)) currentEntryFail("Task12 receipt publication temp is invalid");
        pinned.push({ path: candidate, descriptor, identity, bytes: observed });
      }
      let finalStats: BigIntStats | null = null;
      try { finalStats = lstatSync(target, { bigint: true }); } catch (error) { if (!isEnoent(error)) throw error; }
      if (finalStats === null && pinned.length > 0) {
        const selected = pinned.find(({ identity }) => identity.nlink === 1n);
        if (!selected) currentEntryFail("Task12 receipt publication crash prefix is invalid");
        linkSync(selected.path, target); fsyncCurrentEntryDirectory(directory); finalStats = lstatSync(target, { bigint: true });
      }
      const finalIsPinned = finalStats !== null && pinned.some(({ identity }) => identity.dev === finalStats!.dev && identity.ino === finalStats!.ino);
      const finalIsIndependent = finalStats !== null && finalStats.nlink === 1n && readTask12ReceiptStoreBytesV1(target).equals(bytes);
      if (finalStats !== null && (!finalStats.isFile() || finalStats.isSymbolicLink() || (!finalIsPinned && !finalIsIndependent))) currentEntryFail("Task12 receipt publication final is crossed");
      for (const item of pinned) {
        const now = fstatSync(item.descriptor, { bigint: true }); const atPath = lstatSync(item.path, { bigint: true }); const observed = readTask12ReceiptDescriptorBytesV1(item.descriptor, now.size);
        const linked = finalStats !== null && finalStats.dev === now.dev && finalStats.ino === now.ino && now.nlink === 2n;
        const stale = finalIsIndependent && finalStats !== null && (finalStats.dev !== now.dev || finalStats.ino !== now.ino) && now.nlink === 1n;
        const duplicate = finalIsPinned && finalStats !== null && (finalStats.dev !== now.dev || finalStats.ino !== now.ino) && now.nlink === 1n;
        if (!now.isFile() || now.isSymbolicLink() || !atPath.isFile() || atPath.isSymbolicLink() || (now.mode & 0o7777n) !== 0o600n || (atPath.mode & 0o7777n) !== 0o600n || now.dev !== item.identity.dev || now.ino !== item.identity.ino || atPath.dev !== item.identity.dev || atPath.ino !== item.identity.ino || atPath.nlink !== now.nlink || !observed.equals(item.bytes) || !observed.equals(bytes) || (!linked && !stale && !duplicate)) currentEntryFail("Task12 receipt publication temp changed");
        unlinkSync(item.path);
        fsyncCurrentEntryDirectory(directory);
      }
    } finally { for (const item of pinned) closeSync(item.descriptor); }
    try {
      if (readTask12ReceiptStoreBytesV1(target).equals(bytes)) return;
      currentEntryFail("Task12 receipt immutable collision is crossed");
    } catch (error) { if (!isEnoent(error)) throw error; }
    const remaining = readdirSync(directory).filter((entry) => entry.startsWith(prefix));
    if (remaining.length >= 8) currentEntryFail("Task12 receipt publication temp cap exceeded");
    const temp = `${target}.tmp-${process.pid}-${randomUUID()}`;
    tempDescriptor = openSync(temp, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
    writeFileSync(tempDescriptor, bytes); fsyncSync(tempDescriptor);
    const identity = fstatSync(tempDescriptor, { bigint: true }); const atTemp = lstatSync(temp, { bigint: true }); const observed = readTask12ReceiptDescriptorBytesV1(tempDescriptor, identity.size);
    if (!identity.isFile() || (identity.mode & 0o7777n) !== 0o600n || identity.nlink !== 1n || atTemp.dev !== identity.dev || atTemp.ino !== identity.ino || !observed.equals(bytes)) currentEntryFail("Task12 receipt publication temp identity is invalid");
    linkSync(temp, target); fsyncCurrentEntryDirectory(directory);
    const finalStats = lstatSync(target, { bigint: true }); const linked = fstatSync(tempDescriptor, { bigint: true });
    if (finalStats.dev !== identity.dev || finalStats.ino !== identity.ino || finalStats.nlink !== 2n || linked.dev !== identity.dev || linked.ino !== identity.ino || linked.nlink !== 2n) currentEntryFail("Task12 receipt publication link proof failed");
    unlinkSync(temp); fsyncCurrentEntryDirectory(directory);
    if (!readTask12ReceiptStoreBytesV1(target).equals(bytes)) currentEntryFail("Task12 receipt publication did not reopen");
    guard.assertStable();
  } finally {
    if (tempDescriptor >= 0) closeSync(tempDescriptor);
    writer?.close();
    guard.close();
  }
}

function task12ReceiptExpectedPredecessorCasV1(target: string, predecessorBytes: Buffer, successorBytes: Buffer): void {
  const directory = path.dirname(target);
  const guard = ensureTask12ReceiptPrivateDirectoryV1(directory);
  let writer: Readonly<{ close: () => void }> | null = null;
  let predecessorDescriptor = -1;
  const candidates: Array<{ path: string; descriptor: number; identity: BigIntStats; bytes: Buffer }> = [];
  try {
    guard.assertStable(); writer = acquireTask12ReceiptLocatorWriterV1(target); guard.assertStable();
    const prefix = `${path.basename(target)}.tmp-`;
    const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[1-9][0-9]*-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`);
    const names = readdirSync(directory).filter((entry) => entry.startsWith(prefix));
    if (names.length > 8) currentEntryFail("Task12 receipt CAS temp cap exceeded");
    for (const name of names) {
      if (!pattern.test(name)) currentEntryFail("Task12 receipt CAS temp name is invalid");
      const candidate = path.join(directory, name); const descriptor = openSync(candidate, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); const identity = fstatSync(descriptor, { bigint: true }); const atPath = lstatSync(candidate, { bigint: true }); const bytes = readTask12ReceiptDescriptorBytesV1(descriptor, identity.size);
      if (!identity.isFile() || (identity.mode & 0o7777n) !== 0o600n || identity.nlink !== 1n || identity.dev !== atPath.dev || identity.ino !== atPath.ino || !bytes.equals(successorBytes)) currentEntryFail("Task12 receipt CAS temp is invalid");
      candidates.push({ path: candidate, descriptor, identity, bytes });
    }
    const currentBytes = readTask12ReceiptStoreBytesV1(target);
    if (currentBytes.equals(successorBytes)) {
      for (const candidate of candidates) {
        const now = fstatSync(candidate.descriptor, { bigint: true }); const atPath = lstatSync(candidate.path, { bigint: true });
        if (now.dev !== candidate.identity.dev || now.ino !== candidate.identity.ino || atPath.dev !== candidate.identity.dev || atPath.ino !== candidate.identity.ino || !readTask12ReceiptDescriptorBytesV1(candidate.descriptor, now.size).equals(successorBytes)) currentEntryFail("Task12 receipt CAS temp changed before cleanup");
        unlinkSync(candidate.path);
      }
      if (candidates.length > 0) fsyncCurrentEntryDirectory(directory);
      guard.assertStable();
      return;
    }
    if (!currentBytes.equals(predecessorBytes)) currentEntryFail("Task12 receipt CAS predecessor changed");
    predecessorDescriptor = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const predecessorIdentity = fstatSync(predecessorDescriptor, { bigint: true }); const predecessorAtPath = lstatSync(target, { bigint: true });
    if (!predecessorIdentity.isFile() || (predecessorIdentity.mode & 0o7777n) !== 0o600n || predecessorIdentity.nlink !== 1n || predecessorAtPath.dev !== predecessorIdentity.dev || predecessorAtPath.ino !== predecessorIdentity.ino || !readTask12ReceiptDescriptorBytesV1(predecessorDescriptor, predecessorIdentity.size).equals(predecessorBytes)) currentEntryFail("Task12 receipt CAS predecessor identity is invalid");
    let selected = candidates[0];
    if (!selected) {
      if (names.length >= 8) currentEntryFail("Task12 receipt CAS temp cap exceeded");
      const candidate = `${target}.tmp-${process.pid}-${randomUUID()}`; const descriptor = openSync(candidate, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
      writeFileSync(descriptor, successorBytes); fsyncSync(descriptor); const identity = fstatSync(descriptor, { bigint: true }); selected = { path: candidate, descriptor, identity, bytes: successorBytes }; candidates.push(selected);
    }
    guard.assertStable();
    const predecessorBefore = fstatSync(predecessorDescriptor, { bigint: true }); const predecessorPathBefore = lstatSync(target, { bigint: true }); const successorBefore = fstatSync(selected.descriptor, { bigint: true }); const successorPathBefore = lstatSync(selected.path, { bigint: true });
    if (predecessorBefore.dev !== predecessorIdentity.dev || predecessorBefore.ino !== predecessorIdentity.ino || predecessorPathBefore.dev !== predecessorIdentity.dev || predecessorPathBefore.ino !== predecessorIdentity.ino || predecessorBefore.nlink !== 1n || !readTask12ReceiptDescriptorBytesV1(predecessorDescriptor, predecessorBefore.size).equals(predecessorBytes)) currentEntryFail("Task12 receipt CAS predecessor changed before rename");
    if (successorBefore.dev !== selected.identity.dev || successorBefore.ino !== selected.identity.ino || successorPathBefore.dev !== selected.identity.dev || successorPathBefore.ino !== selected.identity.ino || successorBefore.nlink !== 1n || (successorBefore.mode & 0o7777n) !== 0o600n || !readTask12ReceiptDescriptorBytesV1(selected.descriptor, successorBefore.size).equals(successorBytes)) currentEntryFail("Task12 receipt CAS successor changed before rename");
    renameSync(selected.path, target);
    const predecessorAfter = fstatSync(predecessorDescriptor, { bigint: true }); const successorAfter = fstatSync(selected.descriptor, { bigint: true }); const successorAtPath = lstatSync(target, { bigint: true });
    if (predecessorAfter.dev !== predecessorIdentity.dev || predecessorAfter.ino !== predecessorIdentity.ino || predecessorAfter.nlink !== 0n || !readTask12ReceiptDescriptorBytesV1(predecessorDescriptor, predecessorAfter.size).equals(predecessorBytes)) currentEntryFail("Task12 receipt CAS predecessor replacement is invalid");
    if (successorAfter.dev !== selected.identity.dev || successorAfter.ino !== selected.identity.ino || successorAfter.nlink !== 1n || successorAtPath.dev !== selected.identity.dev || successorAtPath.ino !== selected.identity.ino || successorAtPath.nlink !== 1n || (successorAfter.mode & 0o7777n) !== 0o600n || !readTask12ReceiptDescriptorBytesV1(selected.descriptor, successorAfter.size).equals(successorBytes)) currentEntryFail("Task12 receipt CAS successor replacement is invalid");
    for (const candidate of candidates.slice(1)) {
      const now = fstatSync(candidate.descriptor, { bigint: true }); const atPath = lstatSync(candidate.path, { bigint: true });
      if (now.dev !== candidate.identity.dev || now.ino !== candidate.identity.ino || atPath.dev !== candidate.identity.dev || atPath.ino !== candidate.identity.ino || !readTask12ReceiptDescriptorBytesV1(candidate.descriptor, now.size).equals(successorBytes)) currentEntryFail("Task12 receipt CAS extra temp changed");
      unlinkSync(candidate.path);
    }
    fsyncCurrentEntryDirectory(directory); guard.assertStable();
    if (!readTask12ReceiptStoreBytesV1(target).equals(successorBytes)) currentEntryFail("Task12 receipt CAS successor did not reopen");
    guard.assertStable();
  } finally {
    if (predecessorDescriptor >= 0) closeSync(predecessorDescriptor);
    for (const candidate of candidates) closeSync(candidate.descriptor);
    writer?.close(); guard.close();
  }
}

async function parseLegacyZeroV1(value: Record<string, unknown>, pair: InternalProductionLegacyPreManifestZeroOwnerObservationPairV1): Promise<InternalProductionLegacyPreManifestZeroOwnerObservationV1> {
  if (!hasExactKeys(value, ["schema", "observationKind", "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "cleanSetfarmSourceSha", "cleanSetfarmTreeHash", "cleanSetfarmBuildHash", "observedSpawnerGenerationHash", "census", "allThirtySixScalarCountsZero", "ownerReservationSidecarState", "ownerAdmissionHeadState", "manifestActivationState", "observationRef", "observationHash"])) currentEntryFail("legacy zero-owner fields are invalid");
  const projection = { ...value };
  delete projection.observationRef;
  delete projection.observationHash;
  const hash = requireSha256(value.observationHash, "legacy zero-owner hash");
  if (hashCanonicalJson(projection) !== hash || value.observationRef !== `${LEGACY_ZERO_PREFIX_V1}${hash}` || pair.observationRef !== value.observationRef || pair.observationHash !== hash) currentEntryFail("legacy zero-owner pair/hash is invalid");
  const census = value.census;
  if (value.schema !== "setfarm.internal-production-legacy-pre-manifest-zero-owner-observation.v1" || value.observationKind !== "legacy-pre-manifest-existing-live-truth" || value.allThirtySixScalarCountsZero !== true || value.ownerReservationSidecarState !== "absent-before-migration-32" || value.ownerAdmissionHeadState !== "absent-before-migration-32" || value.manifestActivationState !== "absent-before-initial-a-activation" || !isPlainRecord(census) || !hasExactKeys(census, COMPLETE_ZERO_CENSUS_KEYS_V1) || COMPLETE_ZERO_CENSUS_KEYS_V1.some((key) => census[key] !== 0)) currentEntryFail("legacy zero-owner body is invalid");
  const auditPair = requirePair(
    { authorityV3Migration31AuditRef: value.authorityV3Migration31AuditRef, authorityV3Migration31AuditHash: value.authorityV3Migration31AuditHash },
    "authorityV3Migration31AuditRef",
    "authorityV3Migration31AuditHash",
    "setfarm://internal-production/authority-v3-migration31-audit/sha256/",
  ) as InternalProductionAuthorityV3Migration31AuditPairV1;
  const audit = await resolveInternalProductionAuthorityV3Migration31AuditV1(auditPair);
  const cleanSource = requireSource({
    branch: "main",
    clean: true,
    sha: value.cleanSetfarmSourceSha,
    treeHash: value.cleanSetfarmTreeHash,
    buildHash: value.cleanSetfarmBuildHash,
    originMainSha: value.cleanSetfarmSourceSha,
  });
  if (canonicalComparable(audit.controllerSource) !== canonicalComparable(cleanSource)) currentEntryFail("legacy zero-owner audit/source is crossed");
  requireSha256(value.observedSpawnerGenerationHash, "legacy zero-owner spawner generation");
  return recursivelyFreeze(value as unknown as InternalProductionLegacyPreManifestZeroOwnerObservationV1);
}

export async function observeInternalProductionLegacyPreManifestZeroOwnerV1(): Promise<InternalProductionLegacyPreManifestZeroOwnerObservationV1> {
  const operation = await observePreparedInternalProductionCurrentEntryOperationV1();
  if (operation === null) currentEntryFail("legacy zero-owner observation requires the prepared current-entry operation");
  const auditPair = requirePair(operation.authorityV3Migration31Audit, "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "setfarm://internal-production/authority-v3-migration31-audit/sha256/") as InternalProductionAuthorityV3Migration31AuditPairV1;
  const audit = await resolveInternalProductionAuthorityV3Migration31AuditV1(auditPair);
  const source = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  if (canonicalComparable(source) !== canonicalComparable(operation.controllerSource) || canonicalComparable(source) !== canonicalComparable(audit.controllerSource)) currentEntryFail("legacy zero-owner controller source is crossed");
  await reobserveStoredMigration31AuditV1(audit);
  const phaseA = await observePhaseClosedZeroV1(source);
  const servicesA = await observeInternalProductionServiceCensusV1();
  const physicalA = observePhysicalInventoryV1(servicesA, 0);
  const database = await observeLegacyDatabaseCensusV1();
  const servicesB = await observeInternalProductionServiceCensusV1();
  const physicalB = observePhysicalInventoryV1(servicesB, database.activeRunCount);
  const phaseB = await observePhaseClosedZeroV1(source);
  const auditAgain = await resolveInternalProductionAuthorityV3Migration31AuditV1(auditPair);
  await reobserveStoredMigration31AuditV1(auditAgain);
  if (
    canonicalComparable(servicesA) !== canonicalComparable(servicesB)
    || canonicalComparable(phaseA) !== canonicalComparable(phaseB)
    || canonicalComparable(audit) !== canonicalComparable(auditAgain)
  ) currentEntryFail("legacy zero-owner observation changed across its database snapshot");
  assertPhysicalInventoryPassStableV1(physicalA, physicalB);
  const census = recursivelyFreeze({
    activeRunCount: database.activeRunCount,
    openClaimCount: database.openClaimCount,
    executionAttemptCount: database.executionAttemptCount,
    activeRuntimeSessionCount: database.activeRuntimeSessionCount,
    activeCompletionOwnerCount: database.activeCompletionOwnerCount,
    unsettledMandatoryEffectCount: database.unsettledMandatoryEffectCount,
    ordinaryStartingCount: phaseA.ordinaryStartingCount,
    restartReservationCount: phaseA.restartReservationCount,
    serviceRestartOperationCount: phaseA.serviceRestartOperationCount,
    launchPreparationCount: phaseA.launchPreparationCount,
    preparedLaunchCount: phaseA.preparedLaunchCount,
    stagedCaseCount: phaseA.stagedCaseCount,
    fixtureAttemptCount: phaseA.fixtureAttemptCount,
    artifactReservationCount: database.artifactReservationCount,
    publicationBatchCount: database.publicationBatchCount,
    artifactPublicationCount: database.artifactPublicationCount,
    docsSessionCount: phaseA.docsSessionCount,
    docsLeaseCount: phaseA.docsLeaseCount,
    fleetStageCount: phaseA.fleetStageCount,
    fleetInflightCount: phaseA.fleetInflightCount,
    fleetPendingReviewCount: phaseA.fleetPendingReviewCount,
    matrixInflightCount: phaseA.matrixInflightCount,
    launchOutboxCount: phaseA.launchOutboxCount,
    terminationOwnerCount: database.terminationOwnerCount,
    findingOwnerCount: database.findingOwnerCount,
    recoveryOwnerCount: database.recoveryOwnerCount,
    operationalDeliveryCount: database.operationalDeliveryCount,
    sourceRunOwnerCount: phaseA.sourceRunOwnerCount,
    coldRehearsalOwnerCount: phaseA.coldRehearsalOwnerCount,
    compilationLeaseCount: phaseA.compilationLeaseCount,
    executionLeaseCount: phaseA.executionLeaseCount,
    ownedProcessCount: physicalA.ownedProcessCount,
    ownedListenerCount: physicalA.ownedListenerCount,
    ownedWorktreeCount: physicalA.ownedWorktreeCount,
    dirtyWorktreeCount: physicalA.dirtyWorktreeCount,
    staleChildCount: physicalA.staleChildCount,
  } satisfies InternalProductionCompleteZeroOwnerCensusV1);
  for (const key of COMPLETE_ZERO_CENSUS_KEYS_V1) if (census[key] !== 0) currentEntryFail(`${key} is nonzero`);
  const body = {
    schema: "setfarm.internal-production-legacy-pre-manifest-zero-owner-observation.v1" as const,
    observationKind: "legacy-pre-manifest-existing-live-truth" as const,
    authorityV3Migration31AuditRef: audit.authorityV3Migration31AuditRef,
    authorityV3Migration31AuditHash: audit.authorityV3Migration31AuditHash,
    cleanSetfarmSourceSha: audit.controllerSource.sha,
    cleanSetfarmTreeHash: audit.controllerSource.treeHash,
    cleanSetfarmBuildHash: audit.controllerSource.buildHash,
    observedSpawnerGenerationHash: servicesA.spawner.generationHash,
    census,
    allThirtySixScalarCountsZero: true as const,
    ownerReservationSidecarState: "absent-before-migration-32" as const,
    ownerAdmissionHeadState: "absent-before-migration-32" as const,
    manifestActivationState: "absent-before-initial-a-activation" as const,
  };
  const observationHash = hashCanonicalJson(body);
  const value = recursivelyFreeze({ ...body, observationRef: `${LEGACY_ZERO_PREFIX_V1}${observationHash}`, observationHash });
  const bytes = await canonicalRecordBytes(value);
  const target = legacyZeroPathV1(observationHash);
  publishLegacyZeroRecordV1(target, bytes);
  return resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1({ observationRef: value.observationRef, observationHash });
}

export async function resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1(
  pair: InternalProductionLegacyPreManifestZeroOwnerObservationPairV1,
): Promise<InternalProductionLegacyPreManifestZeroOwnerObservationV1> {
  const expected = requirePair(pair, "observationRef", "observationHash", LEGACY_ZERO_PREFIX_V1) as InternalProductionLegacyPreManifestZeroOwnerObservationPairV1;
  const target = legacyZeroPathV1(expected.observationHash);
  const bytes = readTask12ReceiptStoreBytesV1(target);
  return await parseLegacyZeroV1(strictCanonicalRecord(bytes, "legacy zero-owner observation"), expected);
}

const COMPLETE_ZERO_STORE_V1 = "data/internal-production-baseline/complete-zero-owner-census-observation-v1";
const COMPLETE_ZERO_PREFIX_V1 = "setfarm://internal-production/complete-zero-owner-census-observation/sha256/";

function completeZeroPathV1(hash: string): string {
  return fixedWorkspaceAuthorityPathV1(COMPLETE_ZERO_STORE_V1, "records", "sha256", hash.slice(0, 2), `${hash}.json`);
}

export async function resolveInternalProductionCompleteZeroOwnerCensusObservationV1(
  input: Readonly<{ observationRef: string; observationHash: string }>,
): Promise<Readonly<Record<string, unknown>>> {
  const pair = requirePair(input, "observationRef", "observationHash", COMPLETE_ZERO_PREFIX_V1);
  const target = completeZeroPathV1(pair.observationHash!);
  const value = strictCanonicalRecord(readTask12ReceiptStoreBytesV1(target), "complete zero-owner observation");
  const body = { ...value }; delete body.observationRef; delete body.observationHash;
  if (!hasExactKeys(value, ["schema", "census", "ownerCategoryRegistryHash", "ownerCategoryCensusMapHash", "activeProducerManifestSetActivationRef", "activeProducerManifestSetActivationHash", "activeProducerManifestSetHash", "reservationIdentitySetHash", "ownerIdentitySetHash", "observationRef", "observationHash"]) || value.schema !== "setfarm.internal-production-complete-zero-owner-census-observation.v1" || value.observationRef !== pair.observationRef || value.observationHash !== pair.observationHash || hashCanonicalJson(body) !== pair.observationHash) currentEntryFail("complete zero-owner observation pair/hash is crossed");
  if (!isPlainRecord(value.census)) currentEntryFail("complete zero-owner census is invalid");
  const census = value.census;
  if (!hasExactKeys(census, COMPLETE_ZERO_CENSUS_KEYS_V1) || COMPLETE_ZERO_CENSUS_KEYS_V1.some((key) => census[key] !== 0)) currentEntryFail("complete zero-owner census is not exactly zero");
  const db = await import("../db-pg.js") as unknown as Record<string, unknown>;
  const resolveCurrent = db.resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1;
  if (typeof resolveCurrent !== "function" || resolveCurrent.length !== 0) currentEntryFail("current manifest activation observer is unavailable");
  const current = await (resolveCurrent as () => Promise<Record<string, unknown> | null>)();
  if (!current || !isPlainRecord(current.receipt) || current.receipt.activationRef !== value.activeProducerManifestSetActivationRef || current.receipt.activationHash !== value.activeProducerManifestSetActivationHash || current.receipt.manifestSetHash !== value.activeProducerManifestSetHash || current.receipt.ownerCategoryRegistryHash !== value.ownerCategoryRegistryHash || current.receipt.ownerCategoryCensusMapHash !== value.ownerCategoryCensusMapHash) currentEntryFail("complete zero-owner manifest authority is crossed");
  requireSha256(value.reservationIdentitySetHash, "reservation identity-set hash");
  requireSha256(value.ownerIdentitySetHash, "owner identity-set hash");
  return recursivelyFreeze(value);
}

export async function observeCompleteInternalProductionZeroOwnerCensusV1(
): Promise<Readonly<Record<string, unknown>>> {
  const servicesA = await observeInternalProductionServiceCensusV1();
  const physicalA = observePhysicalInventoryV1(servicesA, 0);
  const db = await import("../db-pg.js") as unknown as Record<string, unknown>;
  const observeSnapshot = db.observeInternalProductionPostManifestOwnerCensusSnapshotV1;
  if (typeof observeSnapshot !== "function" || observeSnapshot.length !== 0) currentEntryFail("post-manifest complete owner census port is unavailable");
  const snapshot = await (observeSnapshot as () => Promise<Record<string, unknown>>)();
  if (!hasExactKeys(snapshot, ["census", "currentManifestActivation", "reservationIdentitySetHash", "ownerIdentitySetHash"]) || !isPlainRecord(snapshot.census) || !isPlainRecord(snapshot.currentManifestActivation)) currentEntryFail("post-manifest complete owner census snapshot is invalid");
  const database = snapshot.census;
  if (!hasExactKeys(database, COMPLETE_ZERO_CENSUS_KEYS_V1.slice(0, -5))) currentEntryFail("post-manifest complete owner database census is invalid");
  for (const key of COMPLETE_ZERO_CENSUS_KEYS_V1.slice(0, -5)) {
    const count = database[key];
    if (!Number.isSafeInteger(count) || (count as number) < 0) currentEntryFail(`${key} is not a canonical nonnegative integer`);
  }
  const servicesB = await observeInternalProductionServiceCensusV1();
  const physicalB = observePhysicalInventoryV1(servicesB, database.activeRunCount as number);
  if (canonicalComparable(servicesA) !== canonicalComparable(servicesB)) currentEntryFail("complete zero-owner service census drifted");
  assertPhysicalInventoryPassStableV1(physicalA, physicalB);
  const census = recursivelyFreeze({
    ...database,
    ownedProcessCount: physicalA.ownedProcessCount,
    ownedListenerCount: physicalA.ownedListenerCount,
    ownedWorktreeCount: physicalA.ownedWorktreeCount,
    dirtyWorktreeCount: physicalA.dirtyWorktreeCount,
    staleChildCount: physicalA.staleChildCount,
  } as InternalProductionCompleteZeroOwnerCensusV1);
  for (const key of COMPLETE_ZERO_CENSUS_KEYS_V1) if (census[key] !== 0) currentEntryFail(`${key} is nonzero`);
  const current = snapshot.currentManifestActivation;
  if (!current || !isPlainRecord(current.receipt)) currentEntryFail("active manifest set is unavailable");
  const owner = await import("./owner-admission-v1.js") as unknown as Record<string, unknown>;
  const body = {
    schema: "setfarm.internal-production-complete-zero-owner-census-observation.v1",
    census,
    ownerCategoryRegistryHash: owner.INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
    ownerCategoryCensusMapHash: owner.INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
    activeProducerManifestSetActivationRef: current.receipt.activationRef,
    activeProducerManifestSetActivationHash: current.receipt.activationHash,
    activeProducerManifestSetHash: current.receipt.manifestSetHash,
    reservationIdentitySetHash: snapshot.reservationIdentitySetHash,
    ownerIdentitySetHash: snapshot.ownerIdentitySetHash,
  };
  for (const key of ["ownerCategoryRegistryHash", "ownerCategoryCensusMapHash", "activeProducerManifestSetActivationHash", "activeProducerManifestSetHash", "reservationIdentitySetHash", "ownerIdentitySetHash"] as const) requireSha256(body[key], key);
  const observationHash = hashCanonicalJson(body);
  const value = recursivelyFreeze({ ...body, observationRef: `${COMPLETE_ZERO_PREFIX_V1}${observationHash}`, observationHash });
  publishLegacyZeroRecordV1(completeZeroPathV1(observationHash), await canonicalRecordBytes(value));
  return resolveInternalProductionCompleteZeroOwnerCensusObservationV1({ observationRef: value.observationRef, observationHash });
}

const ZERO_OWNER_GUARD_ROOT_V1 = "data/internal-production-baseline/zero-owner-mutation-guard-v1";
const ZERO_OWNER_GUARD_PREFIX_V1 = "setfarm://internal-production/baseline-zero-owner-mutation-guard/sha256/";
const CUTOVER_ZERO_OWNER_CONSUMPTION_PREFIX_V1 = "setfarm://internal-production/baseline-physical-service-restart-authority-cutover-zero-owner-guard-consumption/sha256/";

function zeroOwnerGuardPathV1(hash: string): string {
  return fixedWorkspaceAuthorityPathV1(ZERO_OWNER_GUARD_ROOT_V1, "records", "sha256", hash.slice(0, 2), `${hash}.json`);
}

function cutoverZeroOwnerConsumptionPathV1(hash: string): string {
  return fixedWorkspaceAuthorityPathV1(ZERO_OWNER_GUARD_ROOT_V1, "consumptions/physical-service-restart-authority-cutover/sha256", hash.slice(0, 2), `${hash}.json`);
}

function zeroOwnerConsumedIndexPathV1(hash: string): string {
  return fixedWorkspaceAuthorityPathV1(ZERO_OWNER_GUARD_ROOT_V1, "consumed-guards/sha256", hash.slice(0, 2), `${hash}.json`);
}

export async function resolveInternalProductionBaselineZeroOwnerMutationGuardV1(
  input: Readonly<{ zeroOwnerGuardRef: string; zeroOwnerGuardHash: string }>,
): Promise<Readonly<Record<string, unknown>>> {
  const pair = requirePair(input, "zeroOwnerGuardRef", "zeroOwnerGuardHash", ZERO_OWNER_GUARD_PREFIX_V1);
  const target = zeroOwnerGuardPathV1(pair.zeroOwnerGuardHash!);
  const value = strictCanonicalRecord(readTask12ReceiptStoreBytesV1(target), "zero-owner mutation guard");
  const body = { ...value }; delete body.zeroOwnerGuardRef; delete body.zeroOwnerGuardHash;
  if (!hasExactKeys(value, ["schema", "completeZeroOwnerCensusObservationRef", "completeZeroOwnerCensusObservationHash", "baselineServiceRestartHelperJournalCensusHash", "guardNonce", "zeroOwnerGuardRef", "zeroOwnerGuardHash"]) || value.schema !== "setfarm.internal-production-baseline-zero-owner-mutation-guard.v1" || value.zeroOwnerGuardRef !== pair.zeroOwnerGuardRef || value.zeroOwnerGuardHash !== pair.zeroOwnerGuardHash || hashCanonicalJson(body) !== pair.zeroOwnerGuardHash) currentEntryFail("zero-owner mutation guard is crossed");
  await resolveInternalProductionCompleteZeroOwnerCensusObservationV1({ observationRef: String(value.completeZeroOwnerCensusObservationRef), observationHash: String(value.completeZeroOwnerCensusObservationHash) });
  requireSha256(value.baselineServiceRestartHelperJournalCensusHash, "baseline helper-journal census hash");
  requireSha256(value.guardNonce, "zero-owner guard nonce");
  return recursivelyFreeze(value);
}

export async function prepareInternalProductionBaselineZeroOwnerMutationGuardV1(
): Promise<Readonly<{ zeroOwnerGuardRef: string; zeroOwnerGuardHash: string }>> {
  const zero = await observeCompleteInternalProductionZeroOwnerCensusV1();
  const retirement = await import("./baseline-restart-authority-retirement-v1.js") as unknown as Record<string, unknown>;
  const observeCensus = retirement.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1;
  if (typeof observeCensus !== "function" || observeCensus.length !== 0) currentEntryFail("baseline helper-journal census observer is unavailable");
  const helper = await (observeCensus as () => Promise<Record<string, unknown>>)();
  if (helper.registeredBaselineHelperJournalCount !== helper.terminalBaselineHelperJournalCount || helper.liveBaselineHelperJournalCount !== 0 || helper.ambiguousBaselineHelperJournalCount !== 0) currentEntryFail("baseline helper-journal census is not terminal zero");
  const body = {
    schema: "setfarm.internal-production-baseline-zero-owner-mutation-guard.v1",
    completeZeroOwnerCensusObservationRef: zero.observationRef,
    completeZeroOwnerCensusObservationHash: zero.observationHash,
    baselineServiceRestartHelperJournalCensusHash: requireSha256(helper.censusHash, "baseline helper-journal census hash"),
    guardNonce: sha256(randomBytes(32)),
  };
  const zeroOwnerGuardHash = hashCanonicalJson(body);
  const zeroOwnerGuardRef = `${ZERO_OWNER_GUARD_PREFIX_V1}${zeroOwnerGuardHash}`;
  const value = recursivelyFreeze({ ...body, zeroOwnerGuardRef, zeroOwnerGuardHash });
  publishLegacyZeroRecordV1(zeroOwnerGuardPathV1(zeroOwnerGuardHash), await canonicalRecordBytes(value));
  await resolveInternalProductionBaselineZeroOwnerMutationGuardV1({ zeroOwnerGuardRef, zeroOwnerGuardHash });
  return Object.freeze({ zeroOwnerGuardRef, zeroOwnerGuardHash });
}

export async function resolveInternalProductionBaselinePhysicalServiceRestartAuthorityCutoverZeroOwnerGuardConsumptionV1(
  input: Readonly<{ consumptionRef: string; consumptionHash: string }>,
): Promise<Readonly<Record<string, unknown>>> {
  const pair = requirePair(input, "consumptionRef", "consumptionHash", CUTOVER_ZERO_OWNER_CONSUMPTION_PREFIX_V1);
  const target = cutoverZeroOwnerConsumptionPathV1(pair.consumptionHash!);
  const value = strictCanonicalRecord(readTask12ReceiptStoreBytesV1(target), "cutover zero-owner guard consumption");
  const body = { ...value }; delete body.consumptionRef; delete body.consumptionHash;
  if (!hasExactKeys(value, ["schema", "purpose", "zeroOwnerGuardRef", "zeroOwnerGuardHash", "completeZeroOwnerCensusObservationRef", "completeZeroOwnerCensusObservationHash", "baselineServiceRestartHelperJournalCensusHash", "operationRef", "operationHash", "guardConsumed", "consumptionRef", "consumptionHash"]) || value.schema !== "setfarm.internal-production-baseline-physical-service-restart-authority-cutover-zero-owner-guard-consumption.v1" || value.purpose !== "recovery-d-physical-service-restart-authority-cutover-v1" || value.guardConsumed !== true || value.consumptionRef !== pair.consumptionRef || value.consumptionHash !== pair.consumptionHash || hashCanonicalJson(body) !== pair.consumptionHash) currentEntryFail("cutover zero-owner guard consumption is crossed");
  await resolveInternalProductionBaselineZeroOwnerMutationGuardV1({ zeroOwnerGuardRef: String(value.zeroOwnerGuardRef), zeroOwnerGuardHash: String(value.zeroOwnerGuardHash) });
  return recursivelyFreeze(value);
}

export async function consumeInternalProductionBaselinePhysicalServiceRestartAuthorityCutoverZeroOwnerGuardV1(
  input: Readonly<{ zeroOwnerGuardRef: string; zeroOwnerGuardHash: string; operationRef: string; operationHash: string }>,
): Promise<Readonly<{ consumptionRef: string; consumptionHash: string }>> {
  if (!isPlainRecord(input) || !hasExactKeys(input, ["zeroOwnerGuardRef", "zeroOwnerGuardHash", "operationRef", "operationHash"])) currentEntryFail("cutover zero-owner guard consumption input is invalid");
  const guard = await resolveInternalProductionBaselineZeroOwnerMutationGuardV1({ zeroOwnerGuardRef: input.zeroOwnerGuardRef, zeroOwnerGuardHash: input.zeroOwnerGuardHash });
  requirePair({ operationRef: input.operationRef, operationHash: input.operationHash }, "operationRef", "operationHash", "setfarm://internal-production/physical-service-restart-authority-cutover-operation/sha256/");
  const retirement = await import("./baseline-restart-authority-retirement-v1.js") as unknown as Record<string, unknown>;
  const resolveOperation = retirement.resolveInternalProductionPhysicalServiceRestartAuthorityCutoverOperationV1;
  const observeCutoverStatus = retirement.observeInternalProductionPhysicalServiceRestartAuthorityCutoverStatusV1;
  const observeHelperCensus = retirement.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1;
  if (typeof resolveOperation !== "function" || resolveOperation.length !== 1 || typeof observeCutoverStatus !== "function" || observeCutoverStatus.length !== 0 || typeof observeHelperCensus !== "function" || observeHelperCensus.length !== 0) currentEntryFail("cutover mutation authority ports are unavailable");
  const status = await (observeCutoverStatus as () => Promise<Record<string, unknown>>)();
  if (!isPlainRecord(status) || status.state !== "prepared" || status.guardConsumed !== false || status.operationRef !== input.operationRef || status.operationHash !== input.operationHash || typeof status.ownerAdmissionFenceRef !== "string" || typeof status.ownerAdmissionFenceHash !== "string") currentEntryFail("cutover operation is not the sole prepared mutation authority");
  const operation = await (resolveOperation as (pair: Readonly<{ operationRef: string; operationHash: string }>) => Promise<Record<string, unknown>>)({ operationRef: input.operationRef, operationHash: input.operationHash });
  if (!isPlainRecord(operation) || operation.zeroOwnerGuardRef !== input.zeroOwnerGuardRef || operation.zeroOwnerGuardHash !== input.zeroOwnerGuardHash || operation.ownerAdmissionFenceRef !== status.ownerAdmissionFenceRef || operation.ownerAdmissionFenceHash !== status.ownerAdmissionFenceHash || operation.predecessorPhysicalRestartEpochOrdinal !== 1) currentEntryFail("cutover operation does not bind the supplied guard and held fence");
  const database = await import("../db-pg.js") as unknown as Record<string, unknown>;
  const reobserveFence = database.reobserveInternalProductionGlobalOwnerAdmissionFenceV1;
  if (typeof reobserveFence !== "function" || reobserveFence.length !== 1) currentEntryFail("cutover owner-admission fence observer is unavailable");
  const fence = await (reobserveFence as (pair: Readonly<{ fenceRef: string; fenceHash: string }>) => Promise<Record<string, unknown>>)({ fenceRef: status.ownerAdmissionFenceRef, fenceHash: status.ownerAdmissionFenceHash });
  if (!isPlainRecord(fence) || fence.purpose !== "recovery-d-physical-service-restart-authority-cutover-v1" || fence.fenceRef !== status.ownerAdmissionFenceRef || fence.fenceHash !== status.ownerAdmissionFenceHash || fence.pendingInputRef !== operation.pendingInputRef || fence.pendingInputHash !== operation.pendingInputHash || fence.observedUnrelatedReservationCount !== 0 || fence.observedUnrelatedOwnerCount !== 0) currentEntryFail("cutover owner-admission fence is stale or crossed");
  const freshZero = await observeCompleteInternalProductionZeroOwnerCensusV1();
  if (freshZero.observationRef !== guard.completeZeroOwnerCensusObservationRef || freshZero.observationHash !== guard.completeZeroOwnerCensusObservationHash || freshZero.ownerIdentitySetHash !== fence.ownerIdentitySetHash) currentEntryFail("cutover complete zero-owner authority changed before consumption");
  const helper = await (observeHelperCensus as () => Promise<Record<string, unknown>>)();
  if (helper.censusHash !== guard.baselineServiceRestartHelperJournalCensusHash || helper.registeredBaselineHelperJournalCount !== helper.terminalBaselineHelperJournalCount || helper.liveBaselineHelperJournalCount !== 0 || helper.ambiguousBaselineHelperJournalCount !== 0) currentEntryFail("cutover helper-journal census changed before consumption");
  const body = { schema: "setfarm.internal-production-baseline-physical-service-restart-authority-cutover-zero-owner-guard-consumption.v1", purpose: "recovery-d-physical-service-restart-authority-cutover-v1", zeroOwnerGuardRef: input.zeroOwnerGuardRef, zeroOwnerGuardHash: input.zeroOwnerGuardHash, completeZeroOwnerCensusObservationRef: guard.completeZeroOwnerCensusObservationRef, completeZeroOwnerCensusObservationHash: guard.completeZeroOwnerCensusObservationHash, baselineServiceRestartHelperJournalCensusHash: guard.baselineServiceRestartHelperJournalCensusHash, operationRef: input.operationRef, operationHash: input.operationHash, guardConsumed: true };
  const consumptionHash = hashCanonicalJson(body);
  const consumptionRef = `${CUTOVER_ZERO_OWNER_CONSUMPTION_PREFIX_V1}${consumptionHash}`;
  const value = recursivelyFreeze({ ...body, consumptionRef, consumptionHash });
  const pair = { consumptionRef, consumptionHash };
  publishLegacyZeroRecordV1(cutoverZeroOwnerConsumptionPathV1(consumptionHash), await canonicalRecordBytes(value));
  publishLegacyZeroRecordV1(zeroOwnerConsumedIndexPathV1(input.zeroOwnerGuardHash), await canonicalRecordBytes(pair));
  const reopenedConsumption = await resolveInternalProductionBaselinePhysicalServiceRestartAuthorityCutoverZeroOwnerGuardConsumptionV1(pair);
  const reopenedIndex = strictCanonicalRecord(readTask12ReceiptStoreBytesV1(zeroOwnerConsumedIndexPathV1(input.zeroOwnerGuardHash)), "shared zero-owner guard consumption index");
  if (!hasExactKeys(reopenedIndex, ["consumptionRef", "consumptionHash"]) || reopenedIndex.consumptionRef !== reopenedConsumption.consumptionRef || reopenedIndex.consumptionHash !== reopenedConsumption.consumptionHash) currentEntryFail("cutover consumption and shared guard index differ");
  return Object.freeze(pair);
}

export type InternalProductionCurrentEntryAuthorityStatusPairV1 = Readonly<{ statusRef: string; statusHash: string }>;
export type InternalProductionCurrentEntryAuthorityPairV1 = Readonly<{ entryAuthorityRef: string; entryAuthorityHash: string }>;
export type InternalProductionCurrentEntryVerificationPairV1 = Readonly<{ currentEntryVerificationRef: string; currentEntryVerificationHash: string }>;
export type InternalProductionCurrentEntryAuthorityStatusV1 = Readonly<Record<string, unknown>> & Readonly<{
  schema: "setfarm.internal-production-current-entry-authority-status.v1";
  state: "absent" | "operation_prepared" | "pre_schema_spawner_rebinding" | "pre_manifest_bootstrap_sealed" | "migration_applying" | "manifest_activating" | "spawner_admission_transitioning" | "prepared" | "canary_running" | "settled" | "ready" | "blocked";
  statusRef: string;
  statusHash: string;
}>;

export type InternalProductionReviewedDSourceBuildGateV1 = Readonly<{
  schema: "setfarm.internal-production-reviewed-d-source-build-gate.v1";
  reviewed: true;
  setfarmSourceSha: string;
  missionControlSourceSha: string;
  setfarmBuildHash: string;
  missionControlBuildHash: string;
  recoveryProducerManifestActivationRef: string;
  recoveryProducerManifestActivationHash: string;
  missionControlHandoffRef: string;
  missionControlHandoffHash: string;
}>;

const TASK12_STATUS_PREFIX_V1 = "setfarm://internal-production/current-entry-authority-status/sha256/";
const TASK12_AUTHORITY_PREFIX_V1 = "setfarm://internal-production/current-entry-authority/sha256/";
const TASK12_VERIFICATION_PREFIX_V1 = "setfarm://internal-production/current-entry-verification/sha256/";
const TASK12_FRESH_OBSERVATION_PREFIX_V1 = "setfarm://internal-production/current-entry-fresh-runtime-and-owner-observation/sha256/";
const TASK12_PRE_MUTATION_PREFIX_V1 = "setfarm://internal-production/pre-mutation-loaded-runtime-service-authority/sha256/";

function task12RecordPathV1(kind: "statuses" | "entry-authorities" | "fresh-runtime-and-owner-observations" | "verifications", hash: string): string {
  return fixedWorkspaceAuthorityPathV1(CURRENT_ENTRY_STORE_DIRECTORY, "records", kind, "sha256", hash.slice(0, 2), `${hash}.json`);
}

function task12OperationDirectoryV1(operationHash: string): string {
  return fixedWorkspaceAuthorityPathV1(CURRENT_ENTRY_STORE_DIRECTORY, "operations", "sha256", operationHash.slice(0, 2), operationHash);
}

const TASK12_MIGRATION_ROOT_V1 = "data/internal-production-baseline/pre-manifest-migration32-v1";
const TASK12_MIGRATION_PREFIXES_V1 = Object.freeze({
  authorization: "setfarm://internal-production/pre-manifest-migration32-authorization/sha256/",
  consumption: "setfarm://internal-production/pre-manifest-migration32-authorization-consumption/sha256/",
  receipt: "setfarm://internal-production/baseline-bootstrap-handoff-migration-receipt/sha256/",
  currentAudit: "setfarm://internal-production/bootstrap-handoff-current-audit/sha256/",
  status: "setfarm://internal-production/pre-manifest-migration-32-authorization-status/sha256/",
});

const BASELINE_RESTART_ROOT_V1 = "data/internal-production-baseline/baseline-service-restart-v1";
const BASELINE_RESTART_AUTHORIZATION_PREFIX_V1 = "setfarm://internal-production/baseline-service-restart-authorization/sha256/";
const BASELINE_RESTART_OPERATION_PREFIX_V1 = "setfarm://internal-production/baseline-service-restart-operation/sha256/";
const BASELINE_RESTART_OUTBOX_PREFIX_V1 = "setfarm://internal-production/baseline-service-restart-launch-outbox/sha256/";
const BASELINE_RESTART_RECEIPT_PREFIX_V1 = "setfarm://internal-production/baseline/service-restarts/";
const BASELINE_RESTART_ACTIONS_V1 = Object.freeze({
  "setfarm-spawner": "a-restart-service-setfarm-spawner-v1",
  "setfarm-dashboard": "a-restart-service-setfarm-dashboard-v1",
  "mission-control": "a-restart-service-mission-control-v1",
} as const);

function baselineRestartPathV1(kind: "authorizations" | "operations" | "outboxes" | "authorities" | "runtime-projections", hash: string): string {
  return fixedWorkspaceAuthorityPathV1(BASELINE_RESTART_ROOT_V1, kind, "sha256", hash.slice(0, 2), `${hash}.json`);
}

function baselineRestartOutboxLocatorV1(operationHash: string): string {
  return fixedWorkspaceAuthorityPathV1(BASELINE_RESTART_ROOT_V1, "outbox-by-operation/sha256", operationHash.slice(0, 2), `${operationHash}.pair.json`);
}

function baselineRestartAuthorityLocatorV1(authorizationHash: string): string {
  return fixedWorkspaceAuthorityPathV1(BASELINE_RESTART_ROOT_V1, "authority-by-authorization/sha256", authorizationHash.slice(0, 2), `${authorizationHash}.pair.json`);
}

function task12RuntimeProjectionV1(census: InternalProductionServiceCensusV1): Readonly<Record<string, unknown>> {
  const source = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  if (census.spawner.loadedSourceSha !== source.sha || census.spawner.loadedBuildHash !== source.buildHash || census.dashboard.loadedSourceSha !== source.sha || census.dashboard.loadedBuildHash !== source.buildHash || census.missionControl.loadedSourceSha === null || census.missionControl.loadedBuildHash === null) currentEntryFail("baseline restart runtime source/build projection is crossed");
  const body = { schema: "setfarm.internal-production-baseline-runtime-source-projection.v1", setfarmSha: source.sha, missionControlSha: census.missionControl.loadedSourceSha, setfarmBuildInfoHash: source.buildHash, spawnerBuildHash: census.spawner.loadedBuildHash, spawnerServiceIdentityHash: census.spawner.processIdentityHash, dashboardBuildHash: census.dashboard.loadedBuildHash, dashboardServiceIdentityHash: census.dashboard.processIdentityHash, missionControlBuildHash: census.missionControl.loadedBuildHash, missionControlServiceIdentityHash: census.missionControl.processIdentityHash };
  return recursivelyFreeze({ ...body, projectionHash: hashCanonicalJson(body) });
}

function resolveTask12PreparedRuntimeProjectionV1(projectionHashInput: unknown): Readonly<Record<string, unknown>> {
  const projectionHash = requireSha256(projectionHashInput, "baseline restart prepared runtime projection");
  const target = baselineRestartPathV1("runtime-projections", projectionHash);
  const value = strictCanonicalRecord(readTask12ReceiptStoreBytesV1(target), "baseline restart prepared runtime projection");
  const keys = ["schema", "setfarmSha", "missionControlSha", "setfarmBuildInfoHash", "spawnerBuildHash", "spawnerServiceIdentityHash", "dashboardBuildHash", "dashboardServiceIdentityHash", "missionControlBuildHash", "missionControlServiceIdentityHash", "projectionHash"] as const;
  if (!hasExactKeys(value, keys) || value.schema !== "setfarm.internal-production-baseline-runtime-source-projection.v1") currentEntryFail("baseline restart prepared runtime projection shape is invalid");
  for (const key of ["setfarmSha", "missionControlSha"] as const) requireGitHash(value[key], `baseline restart prepared runtime projection ${key}`);
  for (const key of ["setfarmBuildInfoHash", "spawnerBuildHash", "spawnerServiceIdentityHash", "dashboardBuildHash", "dashboardServiceIdentityHash", "missionControlBuildHash", "missionControlServiceIdentityHash"] as const) requireSha256(value[key], `baseline restart prepared runtime projection ${key}`);
  const body = Object.fromEntries(keys.slice(0, -1).map((key) => [key, value[key]]));
  if (hashCanonicalJson(body) !== projectionHash || value.projectionHash !== projectionHash) currentEntryFail("baseline restart prepared runtime projection is crossed");
  return recursivelyFreeze(value);
}

export async function reobserveInternalProductionBaselineServiceRestartPreparedRuntimeProjectionV1(
  input: Readonly<{ authorizationRef: string; authorizationHash: string }>,
): Promise<Readonly<Record<string, unknown>>> {
  const authorization = await resolveInternalProductionBaselineServiceRestartAuthorizationV1(input);
  const stored = resolveTask12PreparedRuntimeProjectionV1(authorization.preparedRuntimeSourceProjectionHash);
  const observed = task12RuntimeProjectionV1(await observeInternalProductionServiceCensusV1());
  if (canonicalComparable(observed) !== canonicalComparable(stored)) currentEntryFail("baseline restart prepared runtime projection drifted before dispatch");
  return stored;
}

function task12MigrationRecordPathV1(kind: "authorizations" | "consumptions" | "receipts" | "current-audits" | "statuses", hash: string): string {
  return fixedWorkspaceAuthorityPathV1(TASK12_MIGRATION_ROOT_V1, "records", kind, "sha256", hash.slice(0, 2), `${hash}.json`);
}

function task12MigrationOperationDirectoryV1(operationHash: string): string {
  return fixedWorkspaceAuthorityPathV1(TASK12_MIGRATION_ROOT_V1, "operations", "sha256", operationHash.slice(0, 2), operationHash);
}

async function publishTask12HashedRecordV1(
  kind: "authorizations" | "consumptions" | "receipts" | "current-audits" | "statuses",
  body: Readonly<Record<string, unknown>>,
  refKey: string,
  hashKey: string,
  prefix: string,
): Promise<Readonly<Record<string, unknown>>> {
  const hash = hashCanonicalJson(body);
  const value = recursivelyFreeze({ ...body, [refKey]: `${prefix}${hash}`, [hashKey]: hash });
  publishLegacyZeroRecordV1(task12MigrationRecordPathV1(kind, hash), await canonicalRecordBytes(value));
  return value;
}

async function resolveTask12MigrationRecordV1(
  input: unknown,
  kind: "authorizations" | "consumptions" | "receipts" | "current-audits" | "statuses",
  refKey: string,
  hashKey: string,
  prefix: string,
  label: string,
): Promise<Readonly<Record<string, unknown>>> {
  const pair = requirePair(input, refKey, hashKey, prefix);
  const target = task12MigrationRecordPathV1(kind, pair[hashKey]!);
  const bytes = readTask12ReceiptStoreBytesV1(target);
  const value = strictCanonicalRecord(bytes, label);
  const body = { ...value }; delete body[refKey]; delete body[hashKey];
  if (value[refKey] !== pair[refKey] || value[hashKey] !== pair[hashKey] || hashCanonicalJson(body) !== pair[hashKey]) currentEntryFail(`${label} pair/hash is crossed`);
  return recursivelyFreeze(value);
}

async function publishTask12MigrationStatusV1(
  operationHash: string,
  ordinal: 0 | 1 | 2,
  body: Readonly<Record<string, unknown>>,
): Promise<Readonly<Record<string, unknown>>> {
  const value = await publishTask12HashedRecordV1("statuses", body, "statusRef", "statusHash", TASK12_MIGRATION_PREFIXES_V1.status);
  const pair = { statusRef: value.statusRef, statusHash: value.statusHash };
  publishLegacyZeroRecordV1(path.join(task12MigrationOperationDirectoryV1(operationHash), `status-0${ordinal}.pair.json`), await canonicalRecordBytes(pair));
  return value;
}

async function task12CasCurrentStatusV1(
  operationHash: string,
  expected: InternalProductionCurrentEntryAuthorityStatusPairV1,
  successor: InternalProductionCurrentEntryAuthorityStatusPairV1,
): Promise<void> {
  if (!activeTask12ControllerOperationsV1.has(operationHash)) currentEntryFail("current-entry status CAS requires the authenticated controller lock");
  const operationDirectory = task12OperationDirectoryV1(operationHash);
  const locator = path.join(operationDirectory, "01-current-status.pair.json");
  task12ReceiptExpectedPredecessorCasV1(locator, await canonicalRecordBytes(expected), await canonicalRecordBytes(successor));
}

type Task12ControllerLockHandleV1 = Readonly<{ schema: "setfarm.internal-production-current-entry-controller-lock-handle.v1" }>;
type Task12ControllerLockStateV1 = { operationHash: string; writer: Readonly<{ close: () => void }>; released: boolean };
const task12ControllerLocksV1 = new WeakMap<object, Task12ControllerLockStateV1>();
const activeTask12ControllerOperationsV1 = new Set<string>();

function observeTask12ControllerProcessV1(pid: number): Readonly<{ processStartTimeEpochMs: number; lstart: string; command: string; processIdentityHash: string }> | null {
  const result = spawnSync("/bin/ps", ["-p", String(pid), "-o", "lstart=", "-o", "command="], { env: Object.freeze({ PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }), shell: false, encoding: "utf8", timeout: 5_000, maxBuffer: 65_536, stdio: ["ignore", "pipe", "pipe"] });
  if (result.status === 1 && result.stdout === "" && result.stderr === "") return null;
  if (result.error || result.signal || result.status !== 0 || result.stderr !== "" || typeof result.stdout !== "string") currentEntryFail("current-entry controller process observation failed");
  const match = /^(.{24}) (.+)\n$/.exec(result.stdout);
  if (!match) currentEntryFail("current-entry controller process observation is ambiguous");
  const lstart = match[1]!; const command = match[2]!; const processStartTimeEpochMs = Date.parse(lstart);
  if (!Number.isSafeInteger(processStartTimeEpochMs) || processStartTimeEpochMs <= 0) currentEntryFail("current-entry controller process start is invalid");
  const processIdentityHash = hashCanonicalJson({ schema: "setfarm.internal-production-current-entry-controller-lock-owner-process-identity.v1", pid, processStartTimeEpochMs, lstart, command });
  return Object.freeze({ processStartTimeEpochMs, lstart, command, processIdentityHash });
}

async function acquireTask12ControllerLockV1(operationHash: string): Promise<Task12ControllerLockHandleV1> {
  requireSha256(operationHash, "current-entry controller operation hash");
  if (activeTask12ControllerOperationsV1.has(operationHash)) currentEntryFail("current-entry controller lock is not reentrant");
  const directory = task12OperationDirectoryV1(operationHash);
  const target = path.join(directory, "current-entry-controller.lock");
  const directoryGuard = ensureTask12ReceiptPrivateDirectoryV1(directory);
  directoryGuard.close();
  const writer = acquireTask12ReceiptLocatorWriterV1(target);
  const handle = Object.freeze({ schema: "setfarm.internal-production-current-entry-controller-lock-handle.v1" as const });
  task12ControllerLocksV1.set(handle, { operationHash, writer, released: false });
  activeTask12ControllerOperationsV1.add(operationHash);
  return handle;
}

function releaseTask12ControllerLockV1(handle: Task12ControllerLockHandleV1): void {
  const state = task12ControllerLocksV1.get(handle);
  if (!state || state.released) currentEntryFail("current-entry controller lock handle is invalid");
  try { state.writer.close(); }
  finally {
    state.released = true; task12ControllerLocksV1.delete(handle); activeTask12ControllerOperationsV1.delete(state.operationHash);
  }
}

async function advanceTask12CurrentStatusV1(
  predecessor: InternalProductionCurrentEntryAuthorityStatusV1,
  state: InternalProductionCurrentEntryAuthorityStatusV1["state"],
  patch: Readonly<Record<string, unknown>>,
): Promise<InternalProductionCurrentEntryAuthorityStatusV1> {
  if (predecessor.state === "absent" || predecessor.state === "blocked") currentEntryFail("current-entry status predecessor is not resumable");
  const body = { ...predecessor, ...patch, state } as Record<string, unknown>;
  delete body.statusRef; delete body.statusHash;
  const statusHash = hashCanonicalJson(body);
  const statusRef = `${TASK12_STATUS_PREFIX_V1}${statusHash}`;
  const value = recursivelyFreeze({ ...body, statusRef, statusHash }) as InternalProductionCurrentEntryAuthorityStatusV1;
  publishLegacyZeroRecordV1(task12RecordPathV1("statuses", statusHash), await canonicalRecordBytes(value));
  await task12CasCurrentStatusV1(String(predecessor.operationHash), { statusRef: predecessor.statusRef, statusHash: predecessor.statusHash }, { statusRef, statusHash });
  return resolveInternalProductionCurrentEntryAuthorityStatusV1({ statusRef, statusHash });
}

async function ensureTask12PreparedCurrentEntryStatusV1(
  operation: InternalProductionCurrentEntryOperationV1,
): Promise<InternalProductionCurrentEntryOperationV1> {
  const operationDirectory = task12OperationDirectoryV1(operation.operationHash);
  const statusLocator = path.join(operationDirectory, "01-current-status.pair.json");
  try {
    const pairBytes = readTask12ReceiptStoreBytesV1(statusLocator);
    await resolveInternalProductionCurrentEntryAuthorityStatusV1(strictCanonicalRecord(pairBytes, "prepared current-entry status locator") as InternalProductionCurrentEntryAuthorityStatusPairV1);
    return operation;
  } catch (error) {
    if (!isEnoent(error)) throw error;
  }
  const census = await observeInternalProductionServiceCensusV1();
  const serviceProjection = {
    schema: "setfarm.internal-production-pre-mutation-loaded-runtime-service-projection-set.v1",
    currentEntryOperationRef: operation.operationRef,
    currentEntryOperationHash: operation.operationHash,
    observedServiceCensusHash: census.censusHash,
    spawner: census.spawner,
    dashboard: census.dashboard,
    missionControl: census.missionControl,
    openClaw: census.openClaw,
  };
  const serviceProjectionSetHash = hashCanonicalJson(serviceProjection);
  const preMutationBody = { ...serviceProjection, serviceProjectionSetHash };
  const preMutationLoadedRuntimeServiceAuthorityHash = hashCanonicalJson(preMutationBody);
  const preMutationLoadedRuntimeServiceAuthorityRef = `${TASK12_PRE_MUTATION_PREFIX_V1}${preMutationLoadedRuntimeServiceAuthorityHash}`;
  const preMutation = recursivelyFreeze({ ...preMutationBody, preMutationLoadedRuntimeServiceAuthorityRef, preMutationLoadedRuntimeServiceAuthorityHash });
  const preMutationTarget = fixedWorkspaceAuthorityPathV1(CURRENT_ENTRY_STORE_DIRECTORY, "records/pre-mutation-loaded-runtime-service-authorities/sha256", preMutationLoadedRuntimeServiceAuthorityHash.slice(0, 2), `${preMutationLoadedRuntimeServiceAuthorityHash}.json`);
  publishLegacyZeroRecordV1(preMutationTarget, await canonicalRecordBytes(preMutation));
  publishLegacyZeroRecordV1(path.join(operationDirectory, "00-pre-mutation-loaded-runtime-service-authority.pair.json"), await canonicalRecordBytes({ preMutationLoadedRuntimeServiceAuthorityRef, preMutationLoadedRuntimeServiceAuthorityHash }));
  const source = operation.controllerSource;
  const statusBody = {
    schema: "setfarm.internal-production-current-entry-authority-status.v1",
    state: "operation_prepared",
    operationRef: operation.operationRef,
    operationHash: operation.operationHash,
    controllerSourceAuthority: { controllerSourceSha: source.sha, controllerTreeHash: source.treeHash, controllerBuildHash: source.buildHash },
    productBuildAuthorityV2DeliveryEvidence: operation.productBuildAuthorityV2DeliveryEvidence,
    authorityV3Migration31Audit: operation.authorityV3Migration31Audit,
    pendingBootstrapHandoffMigration: operation.pendingBootstrapHandoffMigration,
    preMutationLoadedRuntimeServiceAuthorityRef,
    preMutationLoadedRuntimeServiceAuthorityHash,
    preMutationLoadedRuntimeServiceAuthority: preMutation,
    preSchemaSpawnerRebindStatus: null,
    preSchemaSpawnerRebindStatusBody: null,
    migrationApplyingPhase: null,
    manifestActivation: null,
    spawnerAdmissionTransitionPhase: null,
    canaryRunningPhase: null,
    settledPhase: null,
    entryAuthority: null,
    blockedReason: null,
  };
  const statusHash = hashCanonicalJson(statusBody);
  const statusRef = `${TASK12_STATUS_PREFIX_V1}${statusHash}`;
  const status = recursivelyFreeze({ ...statusBody, statusRef, statusHash });
  publishLegacyZeroRecordV1(task12RecordPathV1("statuses", statusHash), await canonicalRecordBytes(status));
  publishLegacyZeroRecordV1(statusLocator, await canonicalRecordBytes({ statusRef, statusHash }));
  return operation;
}

async function resolveTask12RecordV1(pair: unknown, refKey: string, hashKey: string, prefix: string, kind: "statuses" | "entry-authorities" | "fresh-runtime-and-owner-observations" | "verifications", label: string): Promise<Record<string, unknown>> {
  const exact = requirePair(pair, refKey, hashKey, prefix);
  const hash = exact[hashKey]!;
  const target = task12RecordPathV1(kind, hash);
  const bytes = readTask12ReceiptStoreBytesV1(target);
  const value = strictCanonicalRecord(bytes, label);
  const body = { ...value }; delete body[refKey]; delete body[hashKey];
  if (value[refKey] !== exact[refKey] || value[hashKey] !== hash || hashCanonicalJson(body) !== hash) currentEntryFail(`${label} hash is crossed`);
  return recursivelyFreeze(value);
}

function absentTask12StatusV1(): InternalProductionCurrentEntryAuthorityStatusV1 {
  const body = {
    schema: "setfarm.internal-production-current-entry-authority-status.v1" as const,
    state: "absent" as const,
    operationRef: null, operationHash: null, controllerSourceAuthority: null,
    productBuildAuthorityV2DeliveryEvidence: null, authorityV3Migration31Audit: null,
    pendingBootstrapHandoffMigration: null, preMutationLoadedRuntimeServiceAuthorityRef: null,
    preMutationLoadedRuntimeServiceAuthorityHash: null, preMutationLoadedRuntimeServiceAuthority: null,
    preSchemaSpawnerRebindStatus: null, preSchemaSpawnerRebindStatusBody: null,
    migrationApplyingPhase: null, manifestActivation: null, spawnerAdmissionTransitionPhase: null,
    canaryRunningPhase: null, settledPhase: null, entryAuthority: null, blockedReason: null,
  };
  const statusHash = hashCanonicalJson(body);
  return recursivelyFreeze({ ...body, statusRef: `${TASK12_STATUS_PREFIX_V1}${statusHash}`, statusHash });
}

export async function observeInternalProductionCurrentEntryAuthorityStatusV1(
): Promise<InternalProductionCurrentEntryAuthorityStatusV1> {
  const operation = await observePreparedInternalProductionCurrentEntryOperationV1();
  if (!operation) return absentTask12StatusV1();
  const locator = fixedWorkspaceAuthorityPathV1(CURRENT_ENTRY_STORE_DIRECTORY, "operations", "sha256", operation.operationHash.slice(0, 2), operation.operationHash, "01-current-status.pair.json");
  try {
    const bytes = readTask12ReceiptStoreBytesV1(locator);
    const pair = strictCanonicalRecord(bytes, "current-entry status locator") as InternalProductionCurrentEntryAuthorityStatusPairV1;
    return resolveInternalProductionCurrentEntryAuthorityStatusV1(pair);
  } catch (error) {
    if (isEnoent(error)) currentEntryFail("prepared operation has no current status");
    throw error;
  }
}

export async function resolveInternalProductionCurrentEntryAuthorityStatusV1(
  input: InternalProductionCurrentEntryAuthorityStatusPairV1,
): Promise<InternalProductionCurrentEntryAuthorityStatusV1> {
  const status = await resolveTask12RecordV1(input, "statusRef", "statusHash", TASK12_STATUS_PREFIX_V1, "statuses", "current-entry status");
  const states = new Set(["absent", "operation_prepared", "pre_schema_spawner_rebinding", "pre_manifest_bootstrap_sealed", "migration_applying", "manifest_activating", "spawner_admission_transitioning", "prepared", "canary_running", "settled", "ready", "blocked"]);
  if (status.schema !== "setfarm.internal-production-current-entry-authority-status.v1" || typeof status.state !== "string" || !states.has(status.state)) currentEntryFail("current-entry status discriminator is invalid");
  if (status.state === "blocked") {
    if (!hasExactKeys(status, ["schema", "state", "lastValidPrefix", "blockedReason", "statusRef", "statusHash"]) || !isPlainRecord(status.lastValidPrefix) || typeof status.blockedReason !== "string") currentEntryFail("blocked current-entry status is invalid");
    return status as InternalProductionCurrentEntryAuthorityStatusV1;
  }
  const keys = ["schema", "state", "operationRef", "operationHash", "controllerSourceAuthority", "productBuildAuthorityV2DeliveryEvidence", "authorityV3Migration31Audit", "pendingBootstrapHandoffMigration", "preMutationLoadedRuntimeServiceAuthorityRef", "preMutationLoadedRuntimeServiceAuthorityHash", "preMutationLoadedRuntimeServiceAuthority", "preSchemaSpawnerRebindStatus", "preSchemaSpawnerRebindStatusBody", "migrationApplyingPhase", "manifestActivation", "spawnerAdmissionTransitionPhase", "canaryRunningPhase", "settledPhase", "entryAuthority", "blockedReason", "statusRef", "statusHash"];
  if (!hasExactKeys(status, keys) || status.blockedReason !== null) currentEntryFail("current-entry status fields are invalid");
  const absentFields = ["operationRef", "operationHash", "controllerSourceAuthority", "productBuildAuthorityV2DeliveryEvidence", "authorityV3Migration31Audit", "pendingBootstrapHandoffMigration", "preMutationLoadedRuntimeServiceAuthorityRef", "preMutationLoadedRuntimeServiceAuthorityHash", "preMutationLoadedRuntimeServiceAuthority", "preSchemaSpawnerRebindStatus", "preSchemaSpawnerRebindStatusBody", "migrationApplyingPhase", "manifestActivation", "spawnerAdmissionTransitionPhase", "canaryRunningPhase", "settledPhase", "entryAuthority"];
  if (status.state === "absent") {
    if (absentFields.some((key) => status[key] !== null)) currentEntryFail("absent current-entry status prefix is invalid");
    return status as InternalProductionCurrentEntryAuthorityStatusV1;
  }
  for (const key of ["operationRef", "operationHash", "preMutationLoadedRuntimeServiceAuthorityRef", "preMutationLoadedRuntimeServiceAuthorityHash"]) if (typeof status[key] !== "string") currentEntryFail(`current-entry status ${key} is invalid`);
  if (!isPlainRecord(status.controllerSourceAuthority) || !isPlainRecord(status.productBuildAuthorityV2DeliveryEvidence) || !isPlainRecord(status.authorityV3Migration31Audit) || !isPlainRecord(status.pendingBootstrapHandoffMigration) || !isPlainRecord(status.preMutationLoadedRuntimeServiceAuthority)) currentEntryFail("current-entry fixed prefix is invalid");
  requirePair({ operationRef: status.operationRef, operationHash: status.operationHash }, "operationRef", "operationHash", "setfarm://internal-production/current-entry-operation/sha256/");
  requirePair(status.productBuildAuthorityV2DeliveryEvidence, "deliveryEvidenceRef", "deliveryEvidenceHash", "mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/");
  requirePair(status.authorityV3Migration31Audit, "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "setfarm://internal-production/authority-v3-migration31-audit/sha256/");
  requirePair(status.pendingBootstrapHandoffMigration, "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash", "setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/");
  requirePair({ preMutationLoadedRuntimeServiceAuthorityRef: status.preMutationLoadedRuntimeServiceAuthorityRef, preMutationLoadedRuntimeServiceAuthorityHash: status.preMutationLoadedRuntimeServiceAuthorityHash }, "preMutationLoadedRuntimeServiceAuthorityRef", "preMutationLoadedRuntimeServiceAuthorityHash", TASK12_PRE_MUTATION_PREFIX_V1);
  const preMutation = status.preMutationLoadedRuntimeServiceAuthority as Record<string, unknown>;
  if (preMutation.currentEntryOperationRef !== status.operationRef || preMutation.currentEntryOperationHash !== status.operationHash || preMutation.preMutationLoadedRuntimeServiceAuthorityRef !== status.preMutationLoadedRuntimeServiceAuthorityRef || preMutation.preMutationLoadedRuntimeServiceAuthorityHash !== status.preMutationLoadedRuntimeServiceAuthorityHash) currentEntryFail("current-entry pre-mutation runtime authority is crossed");

  const rebindRequired = status.state !== "operation_prepared" && status.state !== "pre_schema_spawner_rebinding";
  if ((status.preSchemaSpawnerRebindStatus === null) !== (status.preSchemaSpawnerRebindStatusBody === null)) currentEntryFail("current-entry rebind pair/body nullability is invalid");
  if (rebindRequired && (!isPlainRecord(status.preSchemaSpawnerRebindStatus) || !isPlainRecord(status.preSchemaSpawnerRebindStatusBody))) currentEntryFail("current-entry rebind authority is incomplete");
  if (isPlainRecord(status.preSchemaSpawnerRebindStatus) && isPlainRecord(status.preSchemaSpawnerRebindStatusBody)) {
    const rebindPair = requirePair(status.preSchemaSpawnerRebindStatus, "statusRef", "statusHash", "setfarm://internal-production/pre-schema-spawner-rebind-status/sha256/");
    const rebindBody = status.preSchemaSpawnerRebindStatusBody as Record<string, unknown>;
    if (!hasExactKeys(rebindBody, ["schema", "state", "currentEntryOperation", "authorization", "startupToken", "restartAuthority", "dispatchPrefix", "sealedAdmission", "admissionReady", "refusalCode", "statusRef", "statusHash"]) || rebindBody.statusRef !== rebindPair.statusRef || rebindBody.statusHash !== rebindPair.statusHash || rebindBody.refusalCode !== null || !isPlainRecord(rebindBody.currentEntryOperation) || rebindBody.currentEntryOperation.operationRef !== status.operationRef || rebindBody.currentEntryOperation.operationHash !== status.operationHash) currentEntryFail("current-entry rebind body is crossed");
    const allowedRebindStates = status.state === "pre_schema_spawner_rebinding" ? ["prepared", "startup_token_published", "dispatching"] : status.state === "spawner_admission_transitioning" && isPlainRecord(status.spawnerAdmissionTransitionPhase) && status.spawnerAdmissionTransitionPhase.phase === "sealed" ? ["pre_manifest_bootstrap_sealed"] : ["pre_manifest_bootstrap_sealed", "normal_task0_admission_ready"];
    if (!allowedRebindStates.includes(String(rebindBody.state))) currentEntryFail("current-entry rebind state is impossible for its phase");
  }

  const migration = status.migrationApplyingPhase;
  if (migration !== null) {
    if (!isPlainRecord(migration) || !hasExactKeys(migration, ["phase", "authorization", "consumption", "migrationReceipt", "currentAudit"]) || !["prepared", "consumed", "receipt_published", "current_audited"].includes(String(migration.phase)) || !isPlainRecord(migration.authorization)) currentEntryFail("migration applying phase is invalid");
    const phase = String(migration.phase);
    const hasConsumption = isPlainRecord(migration.consumption);
    const hasReceipt = isPlainRecord(migration.migrationReceipt);
    const hasAudit = isPlainRecord(migration.currentAudit);
    if ((phase === "prepared" && (hasConsumption || hasReceipt || hasAudit)) || (phase === "consumed" && (!hasConsumption || hasReceipt || hasAudit)) || (phase === "receipt_published" && (!hasConsumption || !hasReceipt || hasAudit)) || (phase === "current_audited" && (!hasConsumption || !hasReceipt || !hasAudit))) currentEntryFail("migration applying phase nullability is invalid");
  }
  if (["migration_applying", "manifest_activating", "spawner_admission_transitioning", "prepared", "canary_running", "settled", "ready"].includes(status.state) && migration === null) currentEntryFail("migration applying authority is absent");
  if (["manifest_activating", "spawner_admission_transitioning", "prepared", "canary_running", "settled", "ready"].includes(status.state) && (migration as Record<string, unknown>).phase !== "current_audited") currentEntryFail("migration current-audit prefix is invalid");

  const manifest = status.manifestActivation;
  if (manifest !== null && (!isPlainRecord(manifest) || !hasExactKeys(manifest, ["ownerProducerManifestActivationRef", "ownerProducerManifestActivationHash", "ownerProducerManifestHeadRef", "ownerProducerManifestHeadHash"]))) currentEntryFail("manifest activation prefix is invalid");
  if (["spawner_admission_transitioning", "prepared", "canary_running", "settled", "ready"].includes(status.state) && manifest === null) currentEntryFail("manifest activation prefix is absent");

  const admission = status.spawnerAdmissionTransitionPhase;
  if (admission !== null) {
    if (!isPlainRecord(admission) || !hasExactKeys(admission, ["phase", "sealedAdmission", "admissionReady", "loadedRuntimeServiceAuthority"]) || !["sealed", "admission_ready", "runtime_observed"].includes(String(admission.phase)) || !isPlainRecord(admission.sealedAdmission)) currentEntryFail("spawner admission transition phase is invalid");
    if ((admission.phase === "sealed" && (admission.admissionReady !== null || admission.loadedRuntimeServiceAuthority !== null)) || (admission.phase === "admission_ready" && (!isPlainRecord(admission.admissionReady) || admission.loadedRuntimeServiceAuthority !== null)) || (admission.phase === "runtime_observed" && (!isPlainRecord(admission.admissionReady) || !isPlainRecord(admission.loadedRuntimeServiceAuthority)))) currentEntryFail("spawner admission transition nullability is invalid");
  }
  if (["prepared", "canary_running", "settled", "ready"].includes(status.state) && (!isPlainRecord(admission) || admission.phase !== "runtime_observed")) currentEntryFail("runtime-observed admission prefix is invalid");

  if (["operation_prepared", "pre_schema_spawner_rebinding", "pre_manifest_bootstrap_sealed"].includes(status.state) && [migration, manifest, admission, status.canaryRunningPhase, status.settledPhase, status.entryAuthority].some((value) => value !== null)) currentEntryFail("current-entry early-phase suffix is invalid");
  if (status.state === "migration_applying" && [manifest, admission, status.canaryRunningPhase, status.settledPhase, status.entryAuthority].some((value) => value !== null)) currentEntryFail("migration-applying suffix is invalid");
  if (status.state === "manifest_activating" && [manifest, admission, status.canaryRunningPhase, status.settledPhase, status.entryAuthority].some((value) => value !== null)) currentEntryFail("manifest-activating suffix is invalid");
  if (status.state === "spawner_admission_transitioning" && [status.canaryRunningPhase, status.settledPhase, status.entryAuthority].some((value) => value !== null)) currentEntryFail("spawner-transition suffix is invalid");
  if (status.state === "prepared" && [status.canaryRunningPhase, status.settledPhase, status.entryAuthority].some((value) => value !== null)) currentEntryFail("prepared suffix is invalid");
  if (status.state === "canary_running" && (!isPlainRecord(status.canaryRunningPhase) || status.settledPhase !== null || status.entryAuthority !== null)) currentEntryFail("canary-running suffix is invalid");
  if (status.state === "settled" && (!isPlainRecord(status.canaryRunningPhase) || status.canaryRunningPhase.phase !== "terminal_settlement_published" || !isPlainRecord(status.settledPhase) || status.entryAuthority !== null)) currentEntryFail("settled suffix is invalid");
  if (status.state === "ready" && (!isPlainRecord(status.canaryRunningPhase) || status.canaryRunningPhase.phase !== "terminal_settlement_published" || !isPlainRecord(status.settledPhase) || status.settledPhase.phase !== "fence_released" || !isPlainRecord(status.entryAuthority))) currentEntryFail("ready suffix is invalid");
  return status as InternalProductionCurrentEntryAuthorityStatusV1;
}

export async function resolveInternalProductionCurrentEntryAuthorityV1(
  input: InternalProductionCurrentEntryAuthorityPairV1,
): Promise<Readonly<Record<string, unknown>>> {
  const authority = await resolveTask12RecordV1(input, "entryAuthorityRef", "entryAuthorityHash", TASK12_AUTHORITY_PREFIX_V1, "entry-authorities", "current-entry authority");
  if (authority.schema !== "setfarm.internal-production-current-entry-authority.v1") currentEntryFail("current-entry authority schema is invalid");
  return authority;
}

const TASK12_RESOLVED_PAIR_SPECS_V1 = Object.freeze([
  ["productBuildAuthorityV2DeliveryEvidence", "deliveryEvidenceRef", "deliveryEvidenceHash", "mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/"],
  ["authorityV3Migration31Audit", "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "setfarm://internal-production/authority-v3-migration31-audit/sha256/"],
  ["pendingBootstrapHandoffMigration", "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash", "setfarm://internal-production/pending-bootstrap-handoff-migration/sha256/"],
  ["authorityV3FocusedTestReceipt", "focusedTestReceiptRef", "focusedTestReceiptHash", "mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/"],
  ["currentEntryOperation", "operationRef", "operationHash", "setfarm://internal-production/current-entry-operation/sha256/"],
  ["preMutationLoadedRuntimeServiceAuthority", "preMutationLoadedRuntimeServiceAuthorityRef", "preMutationLoadedRuntimeServiceAuthorityHash", TASK12_PRE_MUTATION_PREFIX_V1],
  ["preSchemaSpawnerRebindAuthorization", "authorizationRef", "authorizationHash", "setfarm://internal-production/pre-schema-spawner-rebind-authorization/sha256/"],
  ["preSchemaSpawnerStartupToken", "startupTokenRef", "startupTokenHash", "setfarm://internal-production/pre-schema-spawner-startup-token/sha256/"],
  ["preSchemaSpawnerRestartAuthority", "restartAuthorityRef", "restartAuthorityHash", "setfarm://internal-production/pre-schema-spawner-restart-authority/sha256/"],
  ["predecessorTerminationObservation", "predecessorTerminationObservationRef", "predecessorTerminationObservationHash", "setfarm://internal-production/pre-schema-spawner-predecessor-termination-observation/sha256/"],
  ["replacementProcessObservation", "replacementProcessObservationRef", "replacementProcessObservationHash", "setfarm://internal-production/pre-schema-spawner-replacement-process-observation/sha256/"],
  ["postPredecessorTerminationLegacyZeroOwnerObservation", "observationRef", "observationHash", LEGACY_ZERO_PREFIX_V1],
  ["preSchemaSpawnerSealedAdmission", "sealedAdmissionRef", "sealedAdmissionHash", "setfarm://internal-production/pre-schema-spawner-sealed-admission/sha256/"],
  ["freshLegacyZeroOwnerObservation", "observationRef", "observationHash", LEGACY_ZERO_PREFIX_V1],
  ["preManifestMigration32Authorization", "authorizationRef", "authorizationHash", TASK12_MIGRATION_PREFIXES_V1.authorization],
  ["preManifestMigration32AuthorizationConsumption", "consumptionRef", "consumptionHash", TASK12_MIGRATION_PREFIXES_V1.consumption],
  ["bootstrapHandoffMigrationReceipt", "migrationReceiptRef", "migrationReceiptHash", TASK12_MIGRATION_PREFIXES_V1.receipt],
  ["bootstrapHandoffCurrentAudit", "bootstrapHandoffCurrentAuditRef", "bootstrapHandoffCurrentAuditHash", TASK12_MIGRATION_PREFIXES_V1.currentAudit],
  ["ownerProducerManifestActivation", "ownerProducerManifestActivationRef", "ownerProducerManifestActivationHash", "setfarm://internal-production/owner-producer-manifest-set-activation/sha256/"],
  ["ownerProducerManifestHead", "ownerProducerManifestHeadRef", "ownerProducerManifestHeadHash", "setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/"],
  ["task0SpawnerAdmissionReady", "admissionReadyRef", "admissionReadyHash", "setfarm://internal-production/task0-spawner-admission-ready/sha256/"],
  ["preSchemaSpawnerRebindStatus", "statusRef", "statusHash", "setfarm://internal-production/pre-schema-spawner-rebind-status/sha256/"],
  ["loadedRuntimeServiceAuthority", "loadedRuntimeServiceAuthorityRef", "loadedRuntimeServiceAuthorityHash", "setfarm://internal-production/loaded-runtime-service-authority/sha256/"],
  ["ownerAdmissionFence", "ownerAdmissionFenceRef", "ownerAdmissionFenceHash", "setfarm://internal-production/global-owner-admission-fence/sha256/"],
  ["sourceRunTargetReservation", "reservationRef", "reservationHash", "setfarm://internal-production/owner-reservations/"],
  ["runTargetReservation", "reservationRef", "reservationHash", "setfarm://internal-production/owner-reservations/"],
  ["terminalSettlement", "terminalSettlementRef", "terminalSettlementHash", "setfarm://internal-production/recovery-source-run-terminal-authority/sha256/"],
  ["targetClose", "targetReservationPairCloseRef", "targetReservationPairCloseHash", "setfarm://internal-production/source-run-launch-target-reservation-pair-close/sha256/"],
  ["ownerAdmissionFenceRelease", "ownerAdmissionFenceReleaseRef", "ownerAdmissionFenceReleaseHash", "setfarm://internal-production/global-owner-admission-fence-release/sha256/"],
] as const);

async function resolveTask12PredecessorAuthorityPairV1(
  name: string,
  pair: Readonly<Record<string, unknown>>,
  authority: Readonly<Record<string, unknown>>,
): Promise<void> {
  if (name === "productBuildAuthorityV2DeliveryEvidence") {
    const module = await import("./product-build-authority-v2-delivery-evidence-v1.js");
    await module.resolveProductBuildAuthorityV2DeliveryEvidenceV1(pair as unknown as Parameters<typeof module.resolveProductBuildAuthorityV2DeliveryEvidenceV1>[0]);
    return;
  }
  if (name === "authorityV3Migration31Audit") { await resolveInternalProductionAuthorityV3Migration31AuditV1(pair as InternalProductionAuthorityV3Migration31AuditPairV1); return; }
  if (name === "pendingBootstrapHandoffMigration") { await resolveInternalProductionPendingBootstrapHandoffMigrationV1(pair as InternalProductionPendingBootstrapHandoffMigrationProjectionPairV1); return; }
  if (name === "authorityV3FocusedTestReceipt") {
    const module = await import("./product-build-authority-v2-delivery-evidence-v1.js");
    const observation = await module.resolveProductBuildAuthorityV2DeliveryEvidenceV1(
      authority.productBuildAuthorityV2DeliveryEvidence as Parameters<typeof module.resolveProductBuildAuthorityV2DeliveryEvidenceV1>[0],
    );
    const evidence = observation.response.evidence as unknown as Record<string, unknown>;
    if (
      !isPlainRecord(evidence.focusedTests)
      || evidence.focusedTests.focusedTestReceiptRef !== pair.focusedTestReceiptRef
      || evidence.focusedTests.focusedTestReceiptHash !== pair.focusedTestReceiptHash
    ) currentEntryFail("current-entry focused-test receipt is crossed");
    return;
  }
  if (name === "currentEntryOperation") { await resolveInternalProductionCurrentEntryOperationV1(pair as InternalProductionCurrentEntryOperationPairV1); return; }
  if (name === "preMutationLoadedRuntimeServiceAuthority") {
    const exact = requirePair(pair, "preMutationLoadedRuntimeServiceAuthorityRef", "preMutationLoadedRuntimeServiceAuthorityHash", TASK12_PRE_MUTATION_PREFIX_V1);
    const hash = String(exact.preMutationLoadedRuntimeServiceAuthorityHash);
    const target = fixedWorkspaceAuthorityPathV1(CURRENT_ENTRY_STORE_DIRECTORY, "records/pre-mutation-loaded-runtime-service-authorities/sha256", hash.slice(0, 2), `${hash}.json`);
    const value = strictCanonicalRecord(readTask12ReceiptStoreBytesV1(target), "pre-mutation loaded runtime service authority");
    const body = { ...value }; delete body.preMutationLoadedRuntimeServiceAuthorityRef; delete body.preMutationLoadedRuntimeServiceAuthorityHash;
    if (
      !hasExactKeys(value, ["schema", "currentEntryOperationRef", "currentEntryOperationHash", "observedServiceCensusHash", "spawner", "dashboard", "missionControl", "openClaw", "serviceProjectionSetHash", "preMutationLoadedRuntimeServiceAuthorityRef", "preMutationLoadedRuntimeServiceAuthorityHash"])
      || value.schema !== "setfarm.internal-production-pre-mutation-loaded-runtime-service-projection-set.v1"
      || value.preMutationLoadedRuntimeServiceAuthorityRef !== exact.preMutationLoadedRuntimeServiceAuthorityRef
      || value.preMutationLoadedRuntimeServiceAuthorityHash !== hash
      || hashCanonicalJson(body) !== hash
    ) currentEntryFail("pre-mutation loaded runtime service authority is crossed");
    return;
  }
  if (name === "postPredecessorTerminationLegacyZeroOwnerObservation" || name === "freshLegacyZeroOwnerObservation") { await resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1(pair as Readonly<{ observationRef: string; observationHash: string }>); return; }
  if (name === "preManifestMigration32Authorization") { await resolveInternalProductionPreManifestMigration32AuthorizationV1(pair as InternalProductionPreManifestMigration32AuthorizationPairV1); return; }
  if (name === "preManifestMigration32AuthorizationConsumption") { await resolveInternalProductionPreManifestMigration32AuthorizationConsumptionV1(pair as Readonly<{ consumptionRef: string; consumptionHash: string }>); return; }
  if (name === "bootstrapHandoffMigrationReceipt") { await resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1(pair as InternalProductionBaselineBootstrapHandoffMigrationReceiptPairV1); return; }
  if (name === "bootstrapHandoffCurrentAudit") { await resolveInternalProductionBootstrapHandoffCurrentAuditV1(pair as Readonly<{ bootstrapHandoffCurrentAuditRef: string; bootstrapHandoffCurrentAuditHash: string }>); return; }
  if (["preSchemaSpawnerRebindAuthorization", "preSchemaSpawnerStartupToken", "preSchemaSpawnerRestartAuthority", "predecessorTerminationObservation", "replacementProcessObservation", "preSchemaSpawnerSealedAdmission", "task0SpawnerAdmissionReady", "preSchemaSpawnerRebindStatus"].includes(name)) {
    const startup = await import("./baseline-spawner-startup-admission-v1.js") as unknown as Record<string, unknown>;
    const resolverName: Readonly<Record<string, string>> = Object.freeze({
      preSchemaSpawnerRebindAuthorization: "resolveInternalProductionPreSchemaSpawnerRebindAuthorizationV1",
      preSchemaSpawnerStartupToken: "resolveInternalProductionPreSchemaSpawnerStartupTokenV1",
      preSchemaSpawnerRestartAuthority: "resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1",
      predecessorTerminationObservation: "resolveInternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1",
      replacementProcessObservation: "resolveInternalProductionPreSchemaSpawnerReplacementProcessObservationV1",
      preSchemaSpawnerSealedAdmission: "resolveInternalProductionPreSchemaSpawnerSealedAdmissionV1",
      task0SpawnerAdmissionReady: "resolveInternalProductionTask0SpawnerAdmissionReadyV1",
      preSchemaSpawnerRebindStatus: "resolveInternalProductionPreSchemaSpawnerRebindStatusV1",
    });
    const resolver = startup[resolverName[name]!];
    if (typeof resolver !== "function" || resolver.length !== 1) currentEntryFail(`current-entry ${name} resolver is unavailable`);
    await (resolver as (pair: unknown) => Promise<unknown>)(pair);
    return;
  }
  if (["ownerProducerManifestActivation", "ownerProducerManifestHead", "sourceRunTargetReservation", "runTargetReservation", "ownerAdmissionFenceRelease"].includes(name)) {
    const db = await import("../db-pg.js") as unknown as Record<string, unknown>;
    const resolverName: Readonly<Record<string, string>> = Object.freeze({
      ownerProducerManifestActivation: "resolveInternalProductionOwnerProducerManifestSetActivationV1",
      ownerProducerManifestHead: "resolveInternalProductionOwnerProducerManifestSetActivationHeadV1",
      sourceRunTargetReservation: "resolveInternalProductionOwnerReservationV1",
      runTargetReservation: "resolveInternalProductionOwnerReservationV1",
      ownerAdmissionFenceRelease: "resolveInternalProductionGlobalOwnerAdmissionFenceReleaseV1",
    });
    const resolver = db[resolverName[name]!];
    if (typeof resolver !== "function" || resolver.length !== 1) currentEntryFail(`current-entry ${name} resolver is unavailable`);
    const actualPair = name === "ownerAdmissionFenceRelease"
      ? { releaseRef: pair.ownerAdmissionFenceReleaseRef, releaseHash: pair.ownerAdmissionFenceReleaseHash }
      : pair;
    await (resolver as (pair: unknown) => Promise<unknown>)(actualPair);
    return;
  }
  if (name === "terminalSettlement") { await resolveInternalProductionRecoverySourceRunTerminalAuthorityV1({ terminalSourceRunRef: String(pair.terminalSettlementRef), terminalSourceRunHash: String(pair.terminalSettlementHash) }); return; }
  if (name === "targetClose") { await resolveInternalProductionSourceRunLaunchTargetReservationPairCloseV1(pair as Readonly<{ targetReservationPairCloseRef: string; targetReservationPairCloseHash: string }>); return; }
  if (name === "loadedRuntimeServiceAuthority") {
    const embedded = authority.loadedRuntimeServiceAuthority;
    if (!isPlainRecord(embedded) || !isPlainRecord(embedded.body)) currentEntryFail("loaded runtime service authority body is absent");
    const body = embedded.body as Record<string, unknown>;
    const hash = hashCanonicalJson(body);
    if (
      embedded.loadedRuntimeServiceAuthorityRef !== `setfarm://internal-production/loaded-runtime-service-authority/sha256/${hash}`
      || embedded.loadedRuntimeServiceAuthorityHash !== hash
      || pair.loadedRuntimeServiceAuthorityRef !== embedded.loadedRuntimeServiceAuthorityRef
      || pair.loadedRuntimeServiceAuthorityHash !== hash
    ) currentEntryFail("loaded runtime service authority is crossed");
    return;
  }
  if (name === "ownerAdmissionFence") {
    const releasePair = authority.ownerAdmissionFenceRelease;
    if (!isPlainRecord(releasePair)) currentEntryFail("owner-admission fence release pair is absent");
    const db = await import("../db-pg.js");
    const release = await db.resolveInternalProductionGlobalOwnerAdmissionFenceReleaseV1({
      releaseRef: String(releasePair.ownerAdmissionFenceReleaseRef),
      releaseHash: String(releasePair.ownerAdmissionFenceReleaseHash),
    });
    if (release.fenceRef !== pair.ownerAdmissionFenceRef || release.fenceHash !== pair.ownerAdmissionFenceHash) currentEntryFail("owner-admission fence/release authority is crossed");
    return;
  }
  currentEntryFail(`current-entry ${name} has no owning resolver`);
}

async function deriveTask12ResolvedAuthorityPairsV1(
  authority: Readonly<Record<string, unknown>>,
  entryAuthority: InternalProductionCurrentEntryAuthorityPairV1,
  currentEntryStatus: InternalProductionCurrentEntryAuthorityStatusPairV1,
  completeZeroOwnerCensusObservation: Readonly<Record<string, unknown>>,
  freshRuntimeAndOwnerObservation: Readonly<Record<string, unknown>>,
): Promise<readonly Readonly<{ name: string; pair: Readonly<Record<string, unknown>> }>[]> {
  const orderedPairs: Array<Readonly<{ name: string; pair: Readonly<Record<string, unknown>> }>> = [];
  for (const [name, refKey, hashKey, prefix] of TASK12_RESOLVED_PAIR_SPECS_V1) {
    const pair = requirePair(authority[name], refKey, hashKey, prefix);
    const exactPair = recursivelyFreeze({ [refKey]: pair[refKey], [hashKey]: pair[hashKey] });
    await resolveTask12PredecessorAuthorityPairV1(name, exactPair, authority);
    orderedPairs.push(Object.freeze({ name, pair: exactPair }));
  }
  await resolveInternalProductionCurrentEntryAuthorityV1(entryAuthority);
  orderedPairs.push(Object.freeze({ name: "currentEntryAuthority", pair: recursivelyFreeze({ entryAuthorityRef: entryAuthority.entryAuthorityRef, entryAuthorityHash: entryAuthority.entryAuthorityHash }) }));
  await resolveInternalProductionCurrentEntryAuthorityStatusV1(currentEntryStatus);
  orderedPairs.push(Object.freeze({ name: "currentEntryStatus", pair: recursivelyFreeze({ statusRef: currentEntryStatus.statusRef, statusHash: currentEntryStatus.statusHash }) }));
  const zero = requirePair(completeZeroOwnerCensusObservation, "observationRef", "observationHash", COMPLETE_ZERO_PREFIX_V1);
  await resolveInternalProductionCompleteZeroOwnerCensusObservationV1({ observationRef: String(zero.observationRef), observationHash: String(zero.observationHash) });
  orderedPairs.push(Object.freeze({ name: "completeZeroOwnerCensusObservation", pair: recursivelyFreeze({ observationRef: zero.observationRef, observationHash: zero.observationHash }) }));
  const fresh = requirePair(freshRuntimeAndOwnerObservation, "freshRuntimeAndOwnerObservationRef", "freshRuntimeAndOwnerObservationHash", TASK12_FRESH_OBSERVATION_PREFIX_V1);
  await resolveInternalProductionCurrentEntryFreshRuntimeAndOwnerObservationV1({ freshRuntimeAndOwnerObservationRef: String(fresh.freshRuntimeAndOwnerObservationRef), freshRuntimeAndOwnerObservationHash: String(fresh.freshRuntimeAndOwnerObservationHash) });
  orderedPairs.push(Object.freeze({ name: "freshRuntimeAndOwnerObservation", pair: recursivelyFreeze({ freshRuntimeAndOwnerObservationRef: fresh.freshRuntimeAndOwnerObservationRef, freshRuntimeAndOwnerObservationHash: fresh.freshRuntimeAndOwnerObservationHash }) }));
  if (orderedPairs.length !== 33) currentEntryFail("current-entry resolved authority set cardinality is invalid");
  return recursivelyFreeze(orderedPairs);
}

export async function resolveInternalProductionCurrentEntryVerificationV1(
  input: InternalProductionCurrentEntryVerificationPairV1,
): Promise<Readonly<Record<string, unknown>>> {
  const verification = await resolveTask12RecordV1(input, "currentEntryVerificationRef", "currentEntryVerificationHash", TASK12_VERIFICATION_PREFIX_V1, "verifications", "current-entry verification");
  if (!hasExactKeys(verification, ["schema", "currentStatus", "currentEntryStatus", "entryAuthority", "resolvedAuthoritySetHash", "freshRuntimeAndOwnerObservation", "currentEntryVerificationRef", "currentEntryVerificationHash"]) || verification.schema !== "setfarm.internal-production-current-entry-verification.v1" || verification.currentStatus !== "current") currentEntryFail("current-entry verification shape is invalid");
  if (!isPlainRecord(verification.currentEntryStatus) || !isPlainRecord(verification.entryAuthority) || !isPlainRecord(verification.freshRuntimeAndOwnerObservation)) currentEntryFail("current-entry verification dependency pairs are invalid");
  const status = await resolveInternalProductionCurrentEntryAuthorityStatusV1(verification.currentEntryStatus as InternalProductionCurrentEntryAuthorityStatusPairV1);
  if (status.state !== "ready" || canonicalComparable(status.entryAuthority) !== canonicalComparable(verification.entryAuthority)) currentEntryFail("current-entry verification status is no longer ready/current");
  const authority = await resolveInternalProductionCurrentEntryAuthorityV1(verification.entryAuthority as InternalProductionCurrentEntryAuthorityPairV1);
  const fresh = await resolveInternalProductionCurrentEntryFreshRuntimeAndOwnerObservationV1(verification.freshRuntimeAndOwnerObservation as Readonly<{ freshRuntimeAndOwnerObservationRef: string; freshRuntimeAndOwnerObservationHash: string }>);
  if (canonicalComparable(fresh.currentEntryStatus) !== canonicalComparable(verification.currentEntryStatus) || canonicalComparable(fresh.entryAuthority) !== canonicalComparable(verification.entryAuthority)) currentEntryFail("current-entry verification fresh observation is crossed");
  const orderedPairs = await deriveTask12ResolvedAuthorityPairsV1(
    authority,
    verification.entryAuthority as InternalProductionCurrentEntryAuthorityPairV1,
    verification.currentEntryStatus as InternalProductionCurrentEntryAuthorityStatusPairV1,
    fresh.completeZeroOwnerCensusObservation as Readonly<Record<string, unknown>>,
    verification.freshRuntimeAndOwnerObservation as Readonly<Record<string, unknown>>,
  );
  if (hashCanonicalJson(orderedPairs) !== verification.resolvedAuthoritySetHash) currentEntryFail("current-entry verification resolved authority set is crossed");
  const freshServices = await observeInternalProductionServiceCensusV1();
  const freshOwners = await observeCompleteInternalProductionZeroOwnerCensusV1();
  if (canonicalComparable(freshServices) !== canonicalComparable(fresh.serviceCensus) || canonicalComparable(freshOwners) !== canonicalComparable(fresh.completeZeroOwnerCensusObservationBody)) currentEntryFail("current-entry verification runtime/owner evidence is stale");
  return verification;
}

export async function resolveInternalProductionCurrentEntryFreshRuntimeAndOwnerObservationV1(
  input: Readonly<{ freshRuntimeAndOwnerObservationRef: string; freshRuntimeAndOwnerObservationHash: string }>,
): Promise<Readonly<Record<string, unknown>>> {
  const value = await resolveTask12RecordV1(input, "freshRuntimeAndOwnerObservationRef", "freshRuntimeAndOwnerObservationHash", TASK12_FRESH_OBSERVATION_PREFIX_V1, "fresh-runtime-and-owner-observations", "current-entry fresh runtime/owner observation");
  if (!hasExactKeys(value, ["schema", "currentEntryStatus", "entryAuthority", "serviceCensus", "completeZeroOwnerCensusObservation", "completeZeroOwnerCensusObservationBody", "controllerRuntimeSourceRelations", "observedAt", "freshRuntimeAndOwnerObservationRef", "freshRuntimeAndOwnerObservationHash"]) || value.schema !== "setfarm.internal-production-current-entry-fresh-runtime-and-owner-observation.v1" || typeof value.observedAt !== "string" || !RFC3339_MILLIS.test(value.observedAt)) currentEntryFail("current-entry fresh runtime/owner observation shape is invalid");
  if (!isPlainRecord(value.completeZeroOwnerCensusObservation) || !isPlainRecord(value.completeZeroOwnerCensusObservationBody)) currentEntryFail("current-entry fresh complete-zero evidence is invalid");
  const zero = await resolveInternalProductionCompleteZeroOwnerCensusObservationV1(value.completeZeroOwnerCensusObservation as Readonly<{ observationRef: string; observationHash: string }>);
  if (canonicalComparable(zero) !== canonicalComparable(value.completeZeroOwnerCensusObservationBody)) currentEntryFail("current-entry fresh complete-zero body is crossed");
  return value;
}

export type InternalProductionPreManifestMigration32AuthorizationPairV1 = Readonly<{ authorizationRef: string; authorizationHash: string }>;
export type InternalProductionPreManifestMigration32AuthorizationConsumptionPairV1 = Readonly<{ consumptionRef: string; consumptionHash: string }>;
export type InternalProductionBaselineBootstrapHandoffMigrationReceiptPairV1 = Readonly<{ migrationReceiptRef: string; migrationReceiptHash: string }>;

export async function resolveInternalProductionPreManifestMigration32AuthorizationV1(
  input: InternalProductionPreManifestMigration32AuthorizationPairV1,
): Promise<Readonly<Record<string, unknown>>> {
  const value = await resolveTask12MigrationRecordV1(input, "authorizations", "authorizationRef", "authorizationHash", TASK12_MIGRATION_PREFIXES_V1.authorization, "migration-32 authorization");
  if (!hasExactKeys(value as Record<string, unknown>, ["schema", "purpose", "currentEntryOperationRef", "currentEntryOperationHash", "sealedSpawnerAdmissionRef", "sealedSpawnerAdmissionHash", "postPredecessorTerminationLegacyZeroOwnerObservationRef", "postPredecessorTerminationLegacyZeroOwnerObservationHash", "authorityV3Migration31AuditRef", "authorityV3Migration31AuditHash", "pendingBootstrapHandoffMigrationRef", "pendingBootstrapHandoffMigrationHash", "cleanSetfarmSourceSha", "cleanSetfarmTreeHash", "cleanSetfarmBuildHash", "freshLegacyZeroOwnerObservationRef", "freshLegacyZeroOwnerObservationHash", "authorizationRef", "authorizationHash"]) || value.schema !== "setfarm.internal-production-pre-manifest-migration-32-authorization.v1" || value.purpose !== "task6a-guarded-migration-32-after-sealed-spawner-v1") currentEntryFail("migration-32 authorization shape is invalid");
  return value;
}

export async function resolveInternalProductionPreManifestMigration32AuthorizationConsumptionV1(
  input: InternalProductionPreManifestMigration32AuthorizationConsumptionPairV1,
): Promise<Readonly<Record<string, unknown>>> {
  const value = await resolveTask12MigrationRecordV1(input, "consumptions", "consumptionRef", "consumptionHash", TASK12_MIGRATION_PREFIXES_V1.consumption, "migration-32 authorization consumption");
  if (!hasExactKeys(value as Record<string, unknown>, ["schema", "currentEntryOperationRef", "currentEntryOperationHash", "authorizationRef", "authorizationHash", "sealedSpawnerAdmissionRef", "sealedSpawnerAdmissionHash", "migrationId", "migrationOrdinal", "consumptionRef", "consumptionHash"]) || value.schema !== "setfarm.internal-production-pre-manifest-migration-32-authorization-consumption.v1" || value.migrationId !== "contract-spine-bootstrap-main-claim-handoff-v1" || value.migrationOrdinal !== 32) currentEntryFail("migration-32 consumption shape is invalid");
  return value;
}

export async function resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1(
  input: InternalProductionBaselineBootstrapHandoffMigrationReceiptPairV1,
): Promise<Readonly<Record<string, unknown>>> {
  const value = await resolveTask12MigrationRecordV1(input, "receipts", "migrationReceiptRef", "migrationReceiptHash", TASK12_MIGRATION_PREFIXES_V1.receipt, "migration-32 receipt");
  if (value.schema !== "setfarm.internal-production-baseline-bootstrap-handoff-migration-receipt.v1" || value.migrationId !== "contract-spine-bootstrap-main-claim-handoff-v1" || value.planStatus !== "exact-pending-migration" || value.applyStatus !== "applied" || value.verifyStatus !== "verified") currentEntryFail("migration-32 receipt shape is invalid");
  return value;
}

async function resolveInternalProductionBootstrapHandoffCurrentAuditV1(
  input: Readonly<{ bootstrapHandoffCurrentAuditRef: string; bootstrapHandoffCurrentAuditHash: string }>,
): Promise<Readonly<Record<string, unknown>>> {
  const value = await resolveTask12MigrationRecordV1(input, "current-audits", "bootstrapHandoffCurrentAuditRef", "bootstrapHandoffCurrentAuditHash", TASK12_MIGRATION_PREFIXES_V1.currentAudit, "migration-32 current audit");
  if (!hasExactKeys(value as Record<string, unknown>, ["schema", "currentStatus", "currentEntryOperation", "migrationReceipt", "databaseAudit", "bootstrapHandoffCurrentAuditRef", "bootstrapHandoffCurrentAuditHash"]) || value.schema !== "setfarm.internal-production-bootstrap-handoff-current-audit.v1" || value.currentStatus !== "current" || !isPlainRecord(value.migrationReceipt) || !isPlainRecord(value.databaseAudit)) currentEntryFail("migration-32 current audit shape is invalid");
  await resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1(value.migrationReceipt as InternalProductionBaselineBootstrapHandoffMigrationReceiptPairV1);
  const db = await import("../db-pg.js") as unknown as Record<string, unknown>;
  const audit = db.auditCurrentInternalProductionBaselineBootstrapHandoffMigration32V1;
  if (typeof audit !== "function" || audit.length !== 0) currentEntryFail("migration-32 current database audit port is unavailable");
  const current = await (audit as () => Promise<Record<string, unknown>>)();
  if (canonicalComparable(current) !== canonicalComparable(value.databaseAudit)) currentEntryFail("migration-32 current database audit drifted");
  return value;
}

export async function resolveInternalProductionPreManifestMigration32AuthorizationStatusV1(
  input: Readonly<{ statusRef: string; statusHash: string }>,
): Promise<Readonly<Record<string, unknown>>> {
  const value = await resolveTask12MigrationRecordV1(input, "statuses", "statusRef", "statusHash", TASK12_MIGRATION_PREFIXES_V1.status, "migration-32 status");
  if (value.schema !== "setfarm.internal-production-pre-manifest-migration-32-authorization-status.v1" || !new Set(["prepared", "consumed", "terminal", "blocked"]).has(String(value.state))) currentEntryFail("migration-32 status shape is invalid");
  return value;
}

export async function observeInternalProductionPreManifestMigration32AuthorizationStatusV1(
): Promise<Readonly<Record<string, unknown>>> {
  const operation = await observePreparedInternalProductionCurrentEntryOperationV1();
  if (!operation) {
    const body = { schema: "setfarm.internal-production-pre-manifest-migration-32-authorization-status.v1", state: "absent", currentEntryOperation: null, authorization: null, consumption: null, migrationReceipt: null, refusalCode: null };
    const statusHash = hashCanonicalJson(body);
    return recursivelyFreeze({ ...body, statusRef: `${TASK12_MIGRATION_PREFIXES_V1.status}${statusHash}`, statusHash });
  }
  const directory = task12MigrationOperationDirectoryV1(operation.operationHash);
  for (const ordinal of [2, 1, 0] as const) {
    const locator = path.join(directory, `status-0${ordinal}.pair.json`);
    try {
      const pair = strictCanonicalRecord(readTask12ReceiptStoreBytesV1(locator), "migration-32 status locator") as Readonly<{ statusRef: string; statusHash: string }>;
      return resolveInternalProductionPreManifestMigration32AuthorizationStatusV1(pair);
    } catch (error) {
      if (!isEnoent(error)) throw error;
    }
  }
  const body = { schema: "setfarm.internal-production-pre-manifest-migration-32-authorization-status.v1", state: "absent", currentEntryOperation: null, authorization: null, consumption: null, migrationReceipt: null, refusalCode: null };
  const statusHash = hashCanonicalJson(body);
  return recursivelyFreeze({ ...body, statusRef: `${TASK12_MIGRATION_PREFIXES_V1.status}${statusHash}`, statusHash });
}

export async function prepareInternalProductionPreManifestMigration32AuthorizationV1(
): Promise<InternalProductionPreManifestMigration32AuthorizationPairV1> {
  const operation = await observePreparedInternalProductionCurrentEntryOperationV1();
  if (!operation) currentEntryFail("migration-32 authorization requires the prepared operation");
  const startup = await import("./baseline-spawner-startup-admission-v1.js") as unknown as Record<string, unknown>;
  const observeStatus = startup.observeInternalProductionPreSchemaSpawnerRebindStatusV1;
  const resolveSealed = startup.resolveInternalProductionPreSchemaSpawnerSealedAdmissionV1;
  if (typeof observeStatus !== "function" || observeStatus.length !== 0 || typeof resolveSealed !== "function" || resolveSealed.length !== 1) currentEntryFail("sealed spawner admission ports are unavailable");
  const status = await (observeStatus as () => Promise<Record<string, unknown>>)();
  if (status.state !== "pre_manifest_bootstrap_sealed" || !isPlainRecord(status.currentEntryOperation) || !isPlainRecord(status.sealedAdmission)) currentEntryFail("sealed spawner admission is unavailable");
  if (status.currentEntryOperation.operationRef !== operation.operationRef || status.currentEntryOperation.operationHash !== operation.operationHash) currentEntryFail("sealed spawner operation is crossed");
  const sealed = await (resolveSealed as (input: unknown) => Promise<Record<string, unknown>>)(status.sealedAdmission);
  const postZeroPair = {
    observationRef: String(sealed.postPredecessorTerminationLegacyZeroOwnerObservationRef),
    observationHash: String(sealed.postPredecessorTerminationLegacyZeroOwnerObservationHash),
  };
  const postZero = await resolveInternalProductionLegacyPreManifestZeroOwnerObservationV1(postZeroPair);
  const freshZero = await observeInternalProductionLegacyPreManifestZeroOwnerV1();
  if (canonicalComparable(postZero.census) !== canonicalComparable(freshZero.census) || postZero.observedSpawnerGenerationHash !== freshZero.observedSpawnerGenerationHash) currentEntryFail("legacy zero-owner reobservation drifted");
  const body = {
    schema: "setfarm.internal-production-pre-manifest-migration-32-authorization.v1",
    purpose: "task6a-guarded-migration-32-after-sealed-spawner-v1",
    currentEntryOperationRef: operation.operationRef,
    currentEntryOperationHash: operation.operationHash,
    sealedSpawnerAdmissionRef: status.sealedAdmission.sealedAdmissionRef,
    sealedSpawnerAdmissionHash: status.sealedAdmission.sealedAdmissionHash,
    postPredecessorTerminationLegacyZeroOwnerObservationRef: postZero.observationRef,
    postPredecessorTerminationLegacyZeroOwnerObservationHash: postZero.observationHash,
    authorityV3Migration31AuditRef: operation.authorityV3Migration31Audit.authorityV3Migration31AuditRef,
    authorityV3Migration31AuditHash: operation.authorityV3Migration31Audit.authorityV3Migration31AuditHash,
    pendingBootstrapHandoffMigrationRef: operation.pendingBootstrapHandoffMigration.pendingBootstrapHandoffMigrationRef,
    pendingBootstrapHandoffMigrationHash: operation.pendingBootstrapHandoffMigration.pendingBootstrapHandoffMigrationHash,
    cleanSetfarmSourceSha: operation.controllerSource.sha,
    cleanSetfarmTreeHash: operation.controllerSource.treeHash,
    cleanSetfarmBuildHash: operation.controllerSource.buildHash,
    freshLegacyZeroOwnerObservationRef: freshZero.observationRef,
    freshLegacyZeroOwnerObservationHash: freshZero.observationHash,
  };
  const value = await publishTask12HashedRecordV1("authorizations", body, "authorizationRef", "authorizationHash", TASK12_MIGRATION_PREFIXES_V1.authorization);
  const pair = { authorizationRef: String(value.authorizationRef), authorizationHash: String(value.authorizationHash) };
  await publishTask12MigrationStatusV1(operation.operationHash, 0, { schema: "setfarm.internal-production-pre-manifest-migration-32-authorization-status.v1", state: "prepared", currentEntryOperation: operationPair(operation), authorization: pair, consumption: null, migrationReceipt: null, refusalCode: null });
  return pair;
}

export async function applyInternalProductionBaselineBootstrapHandoffMigrationV1(
  input: Readonly<{ authorizationRef: string; authorizationHash: string }>,
): Promise<Readonly<{ migrationReceiptRef: string; migrationReceiptHash: string }>> {
  const authorization = await resolveInternalProductionPreManifestMigration32AuthorizationV1(input);
  const operation = await observePreparedInternalProductionCurrentEntryOperationV1();
  if (!operation || authorization.currentEntryOperationRef !== operation.operationRef || authorization.currentEntryOperationHash !== operation.operationHash) currentEntryFail("migration-32 authorization operation is crossed");
  const observed = await observeInternalProductionPreManifestMigration32AuthorizationStatusV1();
  if (observed.state === "terminal" && isPlainRecord(observed.migrationReceipt)) {
    await resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1(observed.migrationReceipt as InternalProductionBaselineBootstrapHandoffMigrationReceiptPairV1);
    return observed.migrationReceipt as InternalProductionBaselineBootstrapHandoffMigrationReceiptPairV1;
  }
  if (!["prepared", "consumed"].includes(String(observed.state)) || !isPlainRecord(observed.authorization) || observed.authorization.authorizationHash !== input.authorizationHash) currentEntryFail("migration-32 authorization is not uniquely resumable");
  const minter = await import("../db/bootstrap-main-claim-handoff-v1-migration.js") as unknown as Record<string, unknown>;
  const mint = minter.mintBootstrapMainClaimHandoffGuardedMigration32EvidenceForControllerV1;
  const db = await import("../db-pg.js") as unknown as Record<string, unknown>;
  const openInternalProductionCurrentEntryMigration32TransactionV1 = db.openInternalProductionCurrentEntryMigration32TransactionV1;
  const stageInternalProductionCurrentEntryMigration32InTransactionV1 = db.stageInternalProductionCurrentEntryMigration32InTransactionV1;
  const commitInternalProductionCurrentEntryMigration32TransactionV1 = db.commitInternalProductionCurrentEntryMigration32TransactionV1;
  const abortInternalProductionCurrentEntryMigration32TransactionV1 = db.abortInternalProductionCurrentEntryMigration32TransactionV1;
  if (typeof mint !== "function" || typeof openInternalProductionCurrentEntryMigration32TransactionV1 !== "function" || typeof stageInternalProductionCurrentEntryMigration32InTransactionV1 !== "function" || typeof commitInternalProductionCurrentEntryMigration32TransactionV1 !== "function" || typeof abortInternalProductionCurrentEntryMigration32TransactionV1 !== "function") currentEntryFail("migration-32 transaction ports are unavailable");
  const transaction = await (openInternalProductionCurrentEntryMigration32TransactionV1 as () => Promise<unknown>)();
  let result: Record<string, unknown>;
  let consumptionPair: InternalProductionPreManifestMigration32AuthorizationConsumptionPairV1;
  try {
    const fresh = await observeInternalProductionLegacyPreManifestZeroOwnerV1();
    if (fresh.observationRef !== authorization.freshLegacyZeroOwnerObservationRef || fresh.observationHash !== authorization.freshLegacyZeroOwnerObservationHash) currentEntryFail("migration-32 final zero observation changed");
    if (observed.state === "consumed") {
      if (!isPlainRecord(observed.consumption)) currentEntryFail("migration-32 consumed prefix is incomplete");
      consumptionPair = { consumptionRef: String(observed.consumption.consumptionRef), consumptionHash: String(observed.consumption.consumptionHash) };
      const consumption = await resolveInternalProductionPreManifestMigration32AuthorizationConsumptionV1(consumptionPair);
      if (consumption.authorizationRef !== input.authorizationRef || consumption.authorizationHash !== input.authorizationHash) currentEntryFail("migration-32 consumed prefix is crossed");
    } else {
      const consumptionBody = {
        schema: "setfarm.internal-production-pre-manifest-migration-32-authorization-consumption.v1",
        currentEntryOperationRef: operation.operationRef,
        currentEntryOperationHash: operation.operationHash,
        authorizationRef: input.authorizationRef,
        authorizationHash: input.authorizationHash,
        sealedSpawnerAdmissionRef: authorization.sealedSpawnerAdmissionRef,
        sealedSpawnerAdmissionHash: authorization.sealedSpawnerAdmissionHash,
        migrationId: "contract-spine-bootstrap-main-claim-handoff-v1",
        migrationOrdinal: 32,
      };
      const consumption = await publishTask12HashedRecordV1("consumptions", consumptionBody, "consumptionRef", "consumptionHash", TASK12_MIGRATION_PREFIXES_V1.consumption);
      consumptionPair = { consumptionRef: String(consumption.consumptionRef), consumptionHash: String(consumption.consumptionHash) };
      await publishTask12MigrationStatusV1(operation.operationHash, 1, { schema: "setfarm.internal-production-pre-manifest-migration-32-authorization-status.v1", state: "consumed", currentEntryOperation: operationPair(operation), authorization: input, consumption: consumptionPair, migrationReceipt: null, refusalCode: null });
    }
    const evidence = (mint as (value: unknown) => unknown)({
    schema: "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-evidence.v1",
    purpose: "task6a-guarded-migration-32-after-sealed-spawner-v1",
    currentEntryOperationRef: operation.operationRef,
    currentEntryOperationHash: operation.operationHash,
    sealedSpawnerAdmissionRef: authorization.sealedSpawnerAdmissionRef,
    sealedSpawnerAdmissionHash: authorization.sealedSpawnerAdmissionHash,
    postPredecessorTerminationLegacyZeroOwnerObservationRef: authorization.postPredecessorTerminationLegacyZeroOwnerObservationRef,
    postPredecessorTerminationLegacyZeroOwnerObservationHash: authorization.postPredecessorTerminationLegacyZeroOwnerObservationHash,
    authorityV3Migration31AuditRef: authorization.authorityV3Migration31AuditRef,
    authorityV3Migration31AuditHash: authorization.authorityV3Migration31AuditHash,
    pendingBootstrapHandoffMigrationRef: authorization.pendingBootstrapHandoffMigrationRef,
    pendingBootstrapHandoffMigrationHash: authorization.pendingBootstrapHandoffMigrationHash,
    cleanSetfarmSourceSha: authorization.cleanSetfarmSourceSha,
    cleanSetfarmTreeHash: authorization.cleanSetfarmTreeHash,
    cleanSetfarmBuildHash: authorization.cleanSetfarmBuildHash,
    migrationSourceSha: authorization.cleanSetfarmSourceSha,
    freshLegacyZeroOwnerObservationRef: authorization.freshLegacyZeroOwnerObservationRef,
    freshLegacyZeroOwnerObservationHash: authorization.freshLegacyZeroOwnerObservationHash,
    preManifestMigration32AuthorizationRef: input.authorizationRef,
    preManifestMigration32AuthorizationHash: input.authorizationHash,
    preManifestMigration32AuthorizationConsumptionRef: consumptionPair.consumptionRef,
    preManifestMigration32AuthorizationConsumptionHash: consumptionPair.consumptionHash,
    });
    await (stageInternalProductionCurrentEntryMigration32InTransactionV1 as (tx: unknown, proof: unknown) => Promise<void>)(transaction, evidence);
    result = await (commitInternalProductionCurrentEntryMigration32TransactionV1 as (tx: unknown) => Promise<Record<string, unknown>>)(transaction);
  } catch (error) {
    try { await (abortInternalProductionCurrentEntryMigration32TransactionV1 as (tx: unknown) => Promise<void>)(transaction); } catch { /* transaction may already be terminal */ }
    throw error;
  }
  const pending = await resolveInternalProductionPendingBootstrapHandoffMigrationV1(operation.pendingBootstrapHandoffMigration);
  const startup = await import("./baseline-spawner-startup-admission-v1.js") as unknown as Record<string, unknown>;
  const observeStartup = startup.observeInternalProductionPreSchemaSpawnerRebindStatusV1;
  const resolveSealed = startup.resolveInternalProductionPreSchemaSpawnerSealedAdmissionV1;
  if (typeof observeStartup !== "function" || typeof resolveSealed !== "function") currentEntryFail("migration receipt sealed ports are unavailable");
  const startupStatus = await (observeStartup as () => Promise<Record<string, unknown>>)();
  if (!isPlainRecord(startupStatus.authorization) || !isPlainRecord(startupStatus.startupToken) || !isPlainRecord(startupStatus.restartAuthority) || !isPlainRecord(startupStatus.dispatchPrefix) || !isPlainRecord(startupStatus.sealedAdmission)) currentEntryFail("migration receipt startup prefix is incomplete");
  const sealed = await (resolveSealed as (value: unknown) => Promise<Record<string, unknown>>)(startupStatus.sealedAdmission);
  const pendingSuccessor = pending.pendingSuccessor as Record<string, unknown>;
  const schemaProjection = result.schemaProjection as Record<string, unknown>;
  const receiptBody = {
    schema: "setfarm.internal-production-baseline-bootstrap-handoff-migration-receipt.v1", migrationId: "contract-spine-bootstrap-main-claim-handoff-v1",
    predecessorAuthorityV3Migration31AuditRef: authorization.authorityV3Migration31AuditRef, predecessorAuthorityV3Migration31AuditHash: authorization.authorityV3Migration31AuditHash,
    pendingBootstrapHandoffMigrationRef: authorization.pendingBootstrapHandoffMigrationRef, pendingBootstrapHandoffMigrationHash: authorization.pendingBootstrapHandoffMigrationHash,
    migrationSourceSha: authorization.cleanSetfarmSourceSha, migrationImplementationBlobHash: pending.migrationImplementation.gitBlobHash,
    orderedStatementsHash: pendingSuccessor.orderedStatementsHash, namedMigrationDigestEntryHash: pendingSuccessor.namedMigrationDigestEntryHash,
    migrationDigest: pendingSuccessor.migrationDigest, schemaProjectionHash: hashCanonicalJson(schemaProjection),
    currentEntryOperationRef: operation.operationRef, currentEntryOperationHash: operation.operationHash,
    preSchemaSpawnerRebindAuthorizationRef: startupStatus.authorization.authorizationRef, preSchemaSpawnerRebindAuthorizationHash: startupStatus.authorization.authorizationHash,
    preSchemaSpawnerStartupTokenRef: startupStatus.startupToken.startupTokenRef, preSchemaSpawnerStartupTokenHash: startupStatus.startupToken.startupTokenHash,
    preSchemaSpawnerRestartAuthorityRef: startupStatus.restartAuthority.restartAuthorityRef, preSchemaSpawnerRestartAuthorityHash: startupStatus.restartAuthority.restartAuthorityHash,
    predecessorTerminationObservationRef: (startupStatus.dispatchPrefix.predecessorTerminationObservation as Record<string, unknown>).predecessorTerminationObservationRef,
    predecessorTerminationObservationHash: (startupStatus.dispatchPrefix.predecessorTerminationObservation as Record<string, unknown>).predecessorTerminationObservationHash,
    replacementProcessObservationRef: (startupStatus.dispatchPrefix.replacementProcessObservation as Record<string, unknown>).replacementProcessObservationRef,
    replacementProcessObservationHash: (startupStatus.dispatchPrefix.replacementProcessObservation as Record<string, unknown>).replacementProcessObservationHash,
    preSchemaSpawnerSealedAdmissionRef: startupStatus.sealedAdmission.sealedAdmissionRef, preSchemaSpawnerSealedAdmissionHash: startupStatus.sealedAdmission.sealedAdmissionHash,
    postPredecessorTerminationLegacyZeroOwnerObservationRef: sealed.postPredecessorTerminationLegacyZeroOwnerObservationRef,
    postPredecessorTerminationLegacyZeroOwnerObservationHash: sealed.postPredecessorTerminationLegacyZeroOwnerObservationHash,
    freshLegacyZeroOwnerObservationRef: authorization.freshLegacyZeroOwnerObservationRef, freshLegacyZeroOwnerObservationHash: authorization.freshLegacyZeroOwnerObservationHash,
    preManifestMigration32AuthorizationRef: input.authorizationRef, preManifestMigration32AuthorizationHash: input.authorizationHash,
    preManifestMigration32AuthorizationConsumptionRef: consumptionPair.consumptionRef, preManifestMigration32AuthorizationConsumptionHash: consumptionPair.consumptionHash,
    planStatus: "exact-pending-migration", applyStatus: "applied", verifyStatus: "verified",
    bootstrapHandoffOperationTablePresent: true, bootstrapHandoffOperationIdUnique: true, bootstrapHandoffClaimIdUnique: true,
    terminalReceiptPairColumnsPresent: true, ownerReservationSidecarPresent: true, ownerAdmissionHeadPresent: true,
  };
  const receipt = await publishTask12HashedRecordV1("receipts", receiptBody, "migrationReceiptRef", "migrationReceiptHash", TASK12_MIGRATION_PREFIXES_V1.receipt);
  const receiptPair = { migrationReceiptRef: String(receipt.migrationReceiptRef), migrationReceiptHash: String(receipt.migrationReceiptHash) };
  await publishTask12MigrationStatusV1(operation.operationHash, 2, { schema: "setfarm.internal-production-pre-manifest-migration-32-authorization-status.v1", state: "terminal", currentEntryOperation: operationPair(operation), authorization: input, consumption: consumptionPair, migrationReceipt: receiptPair, refusalCode: null });
  await resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1(receiptPair);
  return receiptPair;
}

const RECOVERY_SOURCE_BOOTSTRAP_ROOT_V1 = "data/internal-production-baseline/current-entry-v1/recovery-source-bootstrap-v1";
const RECOVERY_SOURCE_BOOTSTRAP_PENDING_FILE_V1 = "recovery-source-bootstrap-pending-input.json";
const RECOVERY_SOURCE_BOOTSTRAP_VISIBILITY_FILE_V1 = "recovery-source-bootstrap-visibility-head.json";
const RECOVERY_SOURCE_BOOTSTRAP_SOURCE_TASK_V1 = "Implement Tasks 1 and 2 from docs/superpowers/plans/2026-08-13-internal-production-recovery-mc-reconciliation-plan.md exactly as written.";
const RECOVERY_SOURCE_BOOTSTRAP_PROMPT_MANIFEST_HASH_V1 = hashCanonicalJson({
  schema: "setfarm.internal-production-recovery-source-bootstrap-prompt-manifest.v1",
  planPath: "docs/superpowers/plans/2026-08-13-internal-production-recovery-mc-reconciliation-plan.md",
  taskOrdinals: recursivelyFreeze([1, 2]),
  task: RECOVERY_SOURCE_BOOTSTRAP_SOURCE_TASK_V1,
});

function recoverySourceBootstrapRootV1(): string {
  return fixedWorkspaceAuthorityPathV1(RECOVERY_SOURCE_BOOTSTRAP_ROOT_V1);
}

function recoverySourceBootstrapRecordPathV1(kind: string, hash: string): string {
  requireSha256(hash, "recovery source bootstrap record hash");
  return path.join(recoverySourceBootstrapRootV1(), "records", kind, "sha256", hash.slice(0, 2), `${hash}.json`);
}

function readRecoverySourceBootstrapRecordV1(target: string, label: string): Record<string, unknown> {
  return strictCanonicalRecord(readTask12ReceiptStoreBytesV1(target), label);
}

function validateRecoverySourceBootstrapPendingInputV1(
  value: Record<string, unknown>,
  expected?: Readonly<{ pendingInputRef: string; pendingInputHash: string }>,
): InternalProductionRecoverySourceBootstrapPendingInputV1 {
  if (!hasExactKeys(value, ["schema", "purpose", "repository", "workflow", "protocol", "promptManifestHash", "pendingInputRef", "pendingInputHash"])) currentEntryFail("recovery source bootstrap pending input fields are invalid");
  if (value.schema !== "setfarm.internal-production-recovery-source-bootstrap-pending-input.v1" || value.purpose !== "recovery-d-source-delivery-v1" || value.repository !== "setfarm" || value.workflow !== "feature-dev" || value.protocol !== "v3" || value.promptManifestHash !== RECOVERY_SOURCE_BOOTSTRAP_PROMPT_MANIFEST_HASH_V1) currentEntryFail("recovery source bootstrap pending input discriminator is invalid");
  const body = { schema: value.schema, purpose: value.purpose, repository: value.repository, workflow: value.workflow, protocol: value.protocol, promptManifestHash: value.promptManifestHash };
  const pendingInputHash = requireSha256(value.pendingInputHash, "recovery source bootstrap pending input hash");
  const pendingInputRef = `setfarm://internal-production/recovery-source-bootstrap-pending-input/sha256/${pendingInputHash}`;
  if (hashCanonicalJson(body) !== pendingInputHash || value.pendingInputRef !== pendingInputRef || (expected && (expected.pendingInputRef !== pendingInputRef || expected.pendingInputHash !== pendingInputHash))) currentEntryFail("recovery source bootstrap pending input pair is crossed");
  return recursivelyFreeze(value as unknown as InternalProductionRecoverySourceBootstrapPendingInputV1);
}

export async function resolveInternalProductionRecoverySourceBootstrapPendingInputV1(input: Readonly<{
  pendingInputRef: string;
  pendingInputHash: string;
}>): Promise<InternalProductionRecoverySourceBootstrapPendingInputV1> {
  const pair = requirePair(input, "pendingInputRef", "pendingInputHash", "setfarm://internal-production/recovery-source-bootstrap-pending-input/sha256/");
  const value = readRecoverySourceBootstrapRecordV1(path.join(recoverySourceBootstrapRootV1(), RECOVERY_SOURCE_BOOTSTRAP_PENDING_FILE_V1), "recovery source bootstrap pending input");
  return validateRecoverySourceBootstrapPendingInputV1(value, pair as Readonly<{ pendingInputRef: string; pendingInputHash: string }>);
}

type RecoverySourceBootstrapVisibilityHeadV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-source-bootstrap-visibility-head.v1";
  state: "pending-input" | "prepared" | "terminal";
  predecessorVisibilityHeadRef: string | null;
  predecessorVisibilityHeadHash: string | null;
  pendingInputRef: string;
  pendingInputHash: string;
  operationRef: string | null;
  operationHash: string | null;
  sourceRunRef: string | null;
  sourceRunHash: string | null;
  visibilityHeadRef: string;
  visibilityHeadHash: string;
}>;

function createRecoverySourceBootstrapVisibilityHeadV1(input: Omit<RecoverySourceBootstrapVisibilityHeadV1, "schema" | "visibilityHeadRef" | "visibilityHeadHash">): RecoverySourceBootstrapVisibilityHeadV1 {
  const body = { schema: "setfarm.internal-production-recovery-source-bootstrap-visibility-head.v1" as const, ...input };
  const visibilityHeadHash = hashCanonicalJson(body);
  return recursivelyFreeze({ ...body, visibilityHeadRef: `setfarm://internal-production/recovery-source-bootstrap-visibility-head/sha256/${visibilityHeadHash}`, visibilityHeadHash });
}

function validateRecoverySourceBootstrapVisibilityHeadV1(value: Record<string, unknown>): RecoverySourceBootstrapVisibilityHeadV1 {
  if (!hasExactKeys(value, ["schema", "state", "predecessorVisibilityHeadRef", "predecessorVisibilityHeadHash", "pendingInputRef", "pendingInputHash", "operationRef", "operationHash", "sourceRunRef", "sourceRunHash", "visibilityHeadRef", "visibilityHeadHash"])) currentEntryFail("recovery source bootstrap visibility fields are invalid");
  if (value.schema !== "setfarm.internal-production-recovery-source-bootstrap-visibility-head.v1" || !["pending-input", "prepared", "terminal"].includes(String(value.state))) currentEntryFail("recovery source bootstrap visibility discriminator is invalid");
  const body = { ...value }; delete body.visibilityHeadRef; delete body.visibilityHeadHash;
  const hash = requireSha256(value.visibilityHeadHash, "recovery source bootstrap visibility hash");
  if (hashCanonicalJson(body) !== hash || value.visibilityHeadRef !== `setfarm://internal-production/recovery-source-bootstrap-visibility-head/sha256/${hash}`) currentEntryFail("recovery source bootstrap visibility pair is crossed");
  const state = value.state;
  if ((state === "pending-input" && [value.predecessorVisibilityHeadRef, value.predecessorVisibilityHeadHash, value.operationRef, value.operationHash, value.sourceRunRef, value.sourceRunHash].some((member) => member !== null)) || (state === "prepared" && ([value.predecessorVisibilityHeadRef, value.predecessorVisibilityHeadHash, value.operationRef, value.operationHash].some((member) => member === null) || value.sourceRunRef !== null || value.sourceRunHash !== null)) || (state === "terminal" && [value.predecessorVisibilityHeadRef, value.predecessorVisibilityHeadHash, value.operationRef, value.operationHash, value.sourceRunRef, value.sourceRunHash].some((member) => member === null))) currentEntryFail("recovery source bootstrap visibility nullability is invalid");
  return recursivelyFreeze(value as unknown as RecoverySourceBootstrapVisibilityHeadV1);
}

function recoverySourceBootstrapVisibilityPairV1(): RecoverySourceBootstrapVisibilityHeadV1 {
  const pointer = readRecoverySourceBootstrapRecordV1(path.join(recoverySourceBootstrapRootV1(), RECOVERY_SOURCE_BOOTSTRAP_VISIBILITY_FILE_V1), "recovery source bootstrap visibility pointer");
  const pair = requirePair(pointer, "visibilityHeadRef", "visibilityHeadHash", "setfarm://internal-production/recovery-source-bootstrap-visibility-head/sha256/");
  const head = validateRecoverySourceBootstrapVisibilityHeadV1(readRecoverySourceBootstrapRecordV1(recoverySourceBootstrapRecordPathV1("visibility-heads", String(pair.visibilityHeadHash)), "recovery source bootstrap visibility head"));
  if (head.visibilityHeadRef !== pair.visibilityHeadRef || head.visibilityHeadHash !== pair.visibilityHeadHash) currentEntryFail("recovery source bootstrap visibility pointer is crossed");
  return head;
}

async function publishRecoverySourceBootstrapVisibilityV1(head: RecoverySourceBootstrapVisibilityHeadV1, predecessor: RecoverySourceBootstrapVisibilityHeadV1 | null): Promise<void> {
  publishLegacyZeroRecordV1(recoverySourceBootstrapRecordPathV1("visibility-heads", head.visibilityHeadHash), await canonicalRecordBytes(head));
  const target = path.join(recoverySourceBootstrapRootV1(), RECOVERY_SOURCE_BOOTSTRAP_VISIBILITY_FILE_V1);
  const pointerBytes = await canonicalRecordBytes({ visibilityHeadRef: head.visibilityHeadRef, visibilityHeadHash: head.visibilityHeadHash });
  if (predecessor === null) {
    publishLegacyZeroRecordV1(target, pointerBytes);
  } else {
    const current = recoverySourceBootstrapVisibilityPairV1();
    if (current.visibilityHeadRef !== predecessor.visibilityHeadRef || current.visibilityHeadHash !== predecessor.visibilityHeadHash) currentEntryFail("RECOVERY_SOURCE_BOOTSTRAP_PREFIX_AMBIGUOUS");
    task12ReceiptExpectedPredecessorCasV1(target, await canonicalRecordBytes({ visibilityHeadRef: predecessor.visibilityHeadRef, visibilityHeadHash: predecessor.visibilityHeadHash }), pointerBytes);
    const adopted = recoverySourceBootstrapVisibilityPairV1();
    if (adopted.visibilityHeadHash !== head.visibilityHeadHash) currentEntryFail("recovery source bootstrap visibility CAS did not reopen");
  }
}

function validateRecoverySourceBootstrapOperationV1(value: Record<string, unknown>): InternalProductionRecoverySourceBootstrapOperationV1 {
  const keys = ["schema", "purpose", "repository", "workflow", "protocol", "promptManifestHash", "pendingInputRef", "pendingInputHash", "baseSourceSha", "baseSourceTreeHash", "buildHash", "activationPreflightHash", "releaseAdmissionHash", "targetSourceRunReservationRef", "targetSourceRunReservationHash", "targetRunReservationRef", "targetRunReservationHash", "targetRunLaunchCompositeHash", "ownerAdmissionFenceRef", "ownerAdmissionFenceHash", "startIntentRef", "startIntentHash", "startOutboxRef", "startOutboxHash", "operationRef", "operationHash"];
  if (!hasExactKeys(value, keys) || value.schema !== "setfarm.internal-production-recovery-source-bootstrap-operation.v1" || value.purpose !== "recovery-d-source-delivery-v1" || value.repository !== "setfarm" || value.workflow !== "feature-dev" || value.protocol !== "v3" || value.promptManifestHash !== RECOVERY_SOURCE_BOOTSTRAP_PROMPT_MANIFEST_HASH_V1) currentEntryFail("recovery source bootstrap operation shape is invalid");
  const body = { ...value }; delete body.operationRef; delete body.operationHash;
  const hash = requireSha256(value.operationHash, "recovery source bootstrap operation hash");
  if (hashCanonicalJson(body) !== hash || value.operationRef !== `setfarm://internal-production/recovery-source-bootstrap-operation/sha256/${hash}`) currentEntryFail("recovery source bootstrap operation pair is crossed");
  return recursivelyFreeze(value as unknown as InternalProductionRecoverySourceBootstrapOperationV1);
}

function readRecoverySourceBootstrapOperationV1(hash: string): InternalProductionRecoverySourceBootstrapOperationV1 {
  return validateRecoverySourceBootstrapOperationV1(readRecoverySourceBootstrapRecordV1(recoverySourceBootstrapRecordPathV1("operations", hash), "recovery source bootstrap operation"));
}

export async function resolveInternalProductionRecoverySourceBootstrapOperationV1(input: Readonly<{
  operationRef: string;
  operationHash: string;
}>): Promise<InternalProductionRecoverySourceBootstrapOperationV1> {
  const pair = requirePair(
    input,
    "operationRef",
    "operationHash",
    "setfarm://internal-production/recovery-source-bootstrap-operation/sha256/",
  );
  const operation = readRecoverySourceBootstrapOperationV1(String(pair.operationHash));
  if (operation.operationRef !== pair.operationRef || operation.operationHash !== pair.operationHash) {
    currentEntryFail("recovery source bootstrap operation pair is crossed");
  }
  const pending = await resolveInternalProductionRecoverySourceBootstrapPendingInputV1({ pendingInputRef: operation.pendingInputRef, pendingInputHash: operation.pendingInputHash });
  const intent = readRecoverySourceBootstrapRecordV1(recoverySourceBootstrapRecordPathV1("start-intents", operation.startIntentHash), "recovery source bootstrap start intent");
  const intentKeys = ["schema", "purpose", "repository", "workflow", "protocol", "promptManifestHash", "pendingInputRef", "pendingInputHash", "baseSourceSha", "baseSourceTreeHash", "buildHash", "activationPreflightHash", "releaseAdmissionHash", "targetSourceRunReservationRef", "targetSourceRunReservationHash", "targetRunReservationRef", "targetRunReservationHash", "targetRunLaunchCompositeHash", "ownerAdmissionFenceRef", "ownerAdmissionFenceHash", "startIntentRef", "startIntentHash"];
  if (!hasExactKeys(intent, intentKeys) || intent.schema !== "setfarm.internal-production-recovery-source-bootstrap-start-intent.v1") currentEntryFail("recovery source bootstrap start intent shape is invalid");
  const intentBody = { ...intent }; delete intentBody.startIntentRef; delete intentBody.startIntentHash;
  if (hashCanonicalJson(intentBody) !== operation.startIntentHash || intent.startIntentRef !== operation.startIntentRef || intent.startIntentHash !== operation.startIntentHash) currentEntryFail("recovery source bootstrap start intent pair is crossed");
  const outbox = readRecoverySourceBootstrapRecordV1(recoverySourceBootstrapRecordPathV1("start-outboxes", operation.startOutboxHash), "recovery source bootstrap start outbox");
  const outboxKeys = ["schema", "kind", "purpose", "repository", "workflow", "protocol", "pendingInputRef", "pendingInputHash", "startIntentRef", "startIntentHash", "targetRunLaunchCompositeHash", "startOutboxRef", "startOutboxHash"];
  if (!hasExactKeys(outbox, outboxKeys) || outbox.schema !== "setfarm.internal-production-recovery-source-bootstrap-start-outbox.v1" || outbox.kind !== "recovery-source-bootstrap") currentEntryFail("recovery source bootstrap start outbox shape is invalid");
  const outboxBody = { ...outbox }; delete outboxBody.startOutboxRef; delete outboxBody.startOutboxHash;
  if (hashCanonicalJson(outboxBody) !== operation.startOutboxHash || outbox.startOutboxRef !== operation.startOutboxRef || outbox.startOutboxHash !== operation.startOutboxHash) currentEntryFail("recovery source bootstrap start outbox pair is crossed");
  const sourceRunOwnerKeyHash = hashCanonicalJson({ schema: "setfarm.internal-production-recovery-source-run-owner-key.v1", pendingInputRef: pending.pendingInputRef, pendingInputHash: pending.pendingInputHash });
  const runOwnerKeyHash = hashCanonicalJson({ schema: "setfarm.internal-production-recovery-source-bootstrap-run-owner-key.v1", pendingInputRef: pending.pendingInputRef, pendingInputHash: pending.pendingInputHash });
  const targetRunLaunchCompositeHash = hashCanonicalJson({ schema: "setfarm.internal-production-source-run-launch-target-composite.v1", pendingInputRef: pending.pendingInputRef, pendingInputHash: pending.pendingInputHash, sourceRunOwnerKeyHash, runOwnerKeyHash });
  if (
    targetRunLaunchCompositeHash !== operation.targetRunLaunchCompositeHash
    || canonicalComparable(intentBody) !== canonicalComparable({ schema: operation.schema.replace("-operation.v1", "-start-intent.v1"), purpose: operation.purpose, repository: operation.repository, workflow: operation.workflow, protocol: operation.protocol, promptManifestHash: operation.promptManifestHash, pendingInputRef: operation.pendingInputRef, pendingInputHash: operation.pendingInputHash, baseSourceSha: operation.baseSourceSha, baseSourceTreeHash: operation.baseSourceTreeHash, buildHash: operation.buildHash, activationPreflightHash: operation.activationPreflightHash, releaseAdmissionHash: operation.releaseAdmissionHash, targetSourceRunReservationRef: operation.targetSourceRunReservationRef, targetSourceRunReservationHash: operation.targetSourceRunReservationHash, targetRunReservationRef: operation.targetRunReservationRef, targetRunReservationHash: operation.targetRunReservationHash, targetRunLaunchCompositeHash: operation.targetRunLaunchCompositeHash, ownerAdmissionFenceRef: operation.ownerAdmissionFenceRef, ownerAdmissionFenceHash: operation.ownerAdmissionFenceHash })
    || outbox.pendingInputRef !== operation.pendingInputRef || outbox.pendingInputHash !== operation.pendingInputHash
    || outbox.startIntentRef !== operation.startIntentRef || outbox.startIntentHash !== operation.startIntentHash
    || outbox.targetRunLaunchCompositeHash !== operation.targetRunLaunchCompositeHash
  ) currentEntryFail("recovery source bootstrap operation ancestry is crossed");
  if (
    operation.targetSourceRunReservationRef !== `setfarm://internal-production/owner-reservations/${operation.targetSourceRunReservationHash}`
    || operation.targetRunReservationRef !== `setfarm://internal-production/owner-reservations/${operation.targetRunReservationHash}`
  ) currentEntryFail("recovery source bootstrap target reservation pairs are crossed");
  return operation;
}

export async function resolveInternalProductionRecoverySourceRunTerminalAuthorityV1(input: Readonly<{
  terminalSourceRunRef: string;
  terminalSourceRunHash: string;
}>): Promise<InternalProductionRecoverySourceRunTerminalAuthorityV1> {
  const pair = requirePair(input, "terminalSourceRunRef", "terminalSourceRunHash", "setfarm://internal-production/recovery-source-run-terminal-authority/sha256/");
  const value = readRecoverySourceBootstrapRecordV1(recoverySourceBootstrapRecordPathV1("terminal-source-runs", String(pair.terminalSourceRunHash)), "recovery source-run terminal authority");
  const keys = ["schema", "operationRef", "operationHash", "targetSourceRunReservationRef", "targetSourceRunReservationHash", "targetRunLaunchCompositeHash", "runId", "operationRunBindingHash", "reciprocalRunOperationBindingHash", "unrelatedReservationCount", "unrelatedOwnerCount", "terminalOwnerRef", "terminalOwnerHash", "terminalSourceRunRef", "terminalSourceRunHash"];
  if (!hasExactKeys(value, keys) || value.schema !== "setfarm.internal-production-recovery-source-run-terminal-authority.v1" || value.unrelatedReservationCount !== 0 || value.unrelatedOwnerCount !== 0) currentEntryFail("recovery source-run terminal authority shape is invalid");
  const body = { ...value }; delete body.terminalSourceRunRef; delete body.terminalSourceRunHash;
  const hash = requireSha256(value.terminalSourceRunHash, "recovery source-run terminal authority hash");
  if (hashCanonicalJson(body) !== hash || value.terminalSourceRunRef !== `setfarm://internal-production/recovery-source-run-terminal-authority/sha256/${hash}` || pair.terminalSourceRunRef !== value.terminalSourceRunRef || pair.terminalSourceRunHash !== hash) currentEntryFail("recovery source-run terminal authority pair is crossed");
  const operation = readRecoverySourceBootstrapOperationV1(requireSha256(value.operationHash, "recovery source-run operation hash"));
  if (operation.operationRef !== value.operationRef || operation.targetSourceRunReservationRef !== value.targetSourceRunReservationRef || operation.targetSourceRunReservationHash !== value.targetSourceRunReservationHash || operation.targetRunLaunchCompositeHash !== value.targetRunLaunchCompositeHash) currentEntryFail("recovery source-run terminal authority operation is crossed");
  return recursivelyFreeze(value as unknown as InternalProductionRecoverySourceRunTerminalAuthorityV1);
}

export async function resolveInternalProductionRecoveryRunLaunchTerminalAuthorityV1(input: Readonly<{
  terminalRunLaunchRef: string;
  terminalRunLaunchHash: string;
}>): Promise<InternalProductionRecoveryRunLaunchTerminalAuthorityV1> {
  const pair = requirePair(input, "terminalRunLaunchRef", "terminalRunLaunchHash", "setfarm://internal-production/recovery-run-launch-terminal-authority/sha256/");
  const value = readRecoverySourceBootstrapRecordV1(recoverySourceBootstrapRecordPathV1("terminal-run-launches", String(pair.terminalRunLaunchHash)), "recovery run-launch terminal authority");
  const keys = ["schema", "operationRef", "operationHash", "targetRunReservationRef", "targetRunReservationHash", "targetRunLaunchCompositeHash", "runId", "operationRunBindingHash", "reciprocalRunOperationBindingHash", "runReservationTerminalOwnerRef", "runReservationTerminalOwnerHash", "terminalRunLaunchRef", "terminalRunLaunchHash"];
  if (!hasExactKeys(value, keys) || value.schema !== "setfarm.internal-production-recovery-run-launch-terminal-authority.v1") currentEntryFail("recovery run-launch terminal authority shape is invalid");
  const body = { ...value }; delete body.terminalRunLaunchRef; delete body.terminalRunLaunchHash;
  const hash = requireSha256(value.terminalRunLaunchHash, "recovery run-launch terminal authority hash");
  if (hashCanonicalJson(body) !== hash || value.terminalRunLaunchRef !== `setfarm://internal-production/recovery-run-launch-terminal-authority/sha256/${hash}` || pair.terminalRunLaunchRef !== value.terminalRunLaunchRef || pair.terminalRunLaunchHash !== hash) currentEntryFail("recovery run-launch terminal authority pair is crossed");
  const operation = readRecoverySourceBootstrapOperationV1(requireSha256(value.operationHash, "recovery run-launch operation hash"));
  if (operation.operationRef !== value.operationRef || operation.targetRunReservationRef !== value.targetRunReservationRef || operation.targetRunReservationHash !== value.targetRunReservationHash || operation.targetRunLaunchCompositeHash !== value.targetRunLaunchCompositeHash) currentEntryFail("recovery run-launch terminal authority operation is crossed");
  return recursivelyFreeze(value as unknown as InternalProductionRecoveryRunLaunchTerminalAuthorityV1);
}

export async function resolveInternalProductionRecoverySourceBootstrapRunReceiptV1(input: Readonly<{
  sourceRunRef: string;
  sourceRunHash: string;
}>): Promise<InternalProductionRecoverySourceBootstrapRunReceiptV1> {
  const pair = requirePair(input, "sourceRunRef", "sourceRunHash", "setfarm://internal-production/recovery-source-bootstrap-run-receipt/sha256/");
  const value = readRecoverySourceBootstrapRecordV1(
    recoverySourceBootstrapRecordPathV1("run-receipts", String(pair.sourceRunHash)),
    "recovery source bootstrap run receipt",
  );
  const keys = [
    "schema", "purpose", "pendingInputRef", "pendingInputHash", "operationRef", "operationHash",
    "targetSourceRunReservationRef", "targetSourceRunReservationHash", "targetRunReservationRef",
    "targetRunReservationHash", "targetRunLaunchCompositeHash", "ownerAdmissionFenceRef",
    "ownerAdmissionFenceHash", "startIntentRef", "startIntentHash", "startOutboxRef", "startOutboxHash",
    "runId", "operationRunBindingHash", "reciprocalRunOperationBindingHash", "terminalOwnerRef",
    "terminalOwnerHash", "terminalSourceRunRef", "terminalSourceRunHash", "terminalRunLaunchRef",
    "terminalRunLaunchHash", "targetReservationPairCloseRef", "targetReservationPairCloseHash",
    "fenceReleaseRef", "fenceReleaseHash", "sourceRunRef", "sourceRunHash",
  ];
  if (!hasExactKeys(value, keys) || value.schema !== "setfarm.internal-production-recovery-source-bootstrap-run-receipt.v1" || value.purpose !== "recovery-d-source-delivery-v1") currentEntryFail("recovery source bootstrap run receipt shape is invalid");
  const body = { ...value }; delete body.sourceRunRef; delete body.sourceRunHash;
  const sourceRunHash = requireSha256(value.sourceRunHash, "recovery source bootstrap run receipt hash");
  if (hashCanonicalJson(body) !== sourceRunHash || value.sourceRunRef !== `setfarm://internal-production/recovery-source-bootstrap-run-receipt/sha256/${sourceRunHash}` || pair.sourceRunRef !== value.sourceRunRef || pair.sourceRunHash !== sourceRunHash) currentEntryFail("recovery source bootstrap run receipt pair is crossed");
  const operation = await resolveInternalProductionRecoverySourceBootstrapOperationV1({ operationRef: String(value.operationRef), operationHash: String(value.operationHash) });
  const sourceTerminal = await resolveInternalProductionRecoverySourceRunTerminalAuthorityV1({ terminalSourceRunRef: String(value.terminalSourceRunRef), terminalSourceRunHash: String(value.terminalSourceRunHash) });
  const runTerminal = await resolveInternalProductionRecoveryRunLaunchTerminalAuthorityV1({ terminalRunLaunchRef: String(value.terminalRunLaunchRef), terminalRunLaunchHash: String(value.terminalRunLaunchHash) });
  const pairClose = await resolveInternalProductionSourceRunLaunchTargetReservationPairCloseV1({ targetReservationPairCloseRef: String(value.targetReservationPairCloseRef), targetReservationPairCloseHash: String(value.targetReservationPairCloseHash) });
  const db = await import("../db-pg.js") as unknown as Record<string, unknown>;
  const resolveRelease = db.resolveInternalProductionGlobalOwnerAdmissionFenceReleaseV1;
  if (typeof resolveRelease !== "function" || resolveRelease.length !== 1) currentEntryFail("recovery source bootstrap fence release resolver is unavailable");
  const release = await (resolveRelease as (pair: unknown) => Promise<Record<string, unknown>>)({ releaseRef: value.fenceReleaseRef, releaseHash: value.fenceReleaseHash });
  if (
    value.pendingInputRef !== operation.pendingInputRef || value.pendingInputHash !== operation.pendingInputHash
    || value.targetSourceRunReservationRef !== operation.targetSourceRunReservationRef || value.targetSourceRunReservationHash !== operation.targetSourceRunReservationHash
    || value.targetRunReservationRef !== operation.targetRunReservationRef || value.targetRunReservationHash !== operation.targetRunReservationHash
    || value.targetRunLaunchCompositeHash !== operation.targetRunLaunchCompositeHash
    || value.ownerAdmissionFenceRef !== operation.ownerAdmissionFenceRef || value.ownerAdmissionFenceHash !== operation.ownerAdmissionFenceHash
    || value.startIntentRef !== operation.startIntentRef || value.startIntentHash !== operation.startIntentHash
    || value.startOutboxRef !== operation.startOutboxRef || value.startOutboxHash !== operation.startOutboxHash
    || value.runId !== sourceTerminal.runId || value.runId !== runTerminal.runId
    || value.operationRunBindingHash !== sourceTerminal.operationRunBindingHash || value.operationRunBindingHash !== runTerminal.operationRunBindingHash
    || value.reciprocalRunOperationBindingHash !== sourceTerminal.reciprocalRunOperationBindingHash || value.reciprocalRunOperationBindingHash !== runTerminal.reciprocalRunOperationBindingHash
    || value.terminalOwnerRef !== sourceTerminal.terminalOwnerRef || value.terminalOwnerHash !== sourceTerminal.terminalOwnerHash
    || pairClose.terminalSourceRunRef !== value.terminalSourceRunRef || pairClose.terminalSourceRunHash !== value.terminalSourceRunHash
    || pairClose.terminalRunLaunchRef !== value.terminalRunLaunchRef || pairClose.terminalRunLaunchHash !== value.terminalRunLaunchHash
    || release.fenceRef !== operation.ownerAdmissionFenceRef || release.fenceHash !== operation.ownerAdmissionFenceHash
    || !isPlainRecord(release.releaseAuthority)
    || release.releaseAuthority.targetReservationPairCloseRef !== value.targetReservationPairCloseRef
    || release.releaseAuthority.targetReservationPairCloseHash !== value.targetReservationPairCloseHash
  ) currentEntryFail("recovery source bootstrap run receipt authority is crossed");
  return recursivelyFreeze(value as unknown as InternalProductionRecoverySourceBootstrapRunReceiptV1);
}

function recoverySourceBootstrapPairClosePathV1(hash: string): string {
  requireSha256(hash, "recovery source bootstrap pair-close hash");
  return fixedWorkspaceAuthorityPathV1("data/internal-production-baseline/current-entry-v1/records/source-run-launch-target-reservation-pair-closes/sha256", hash.slice(0, 2), `${hash}.json`);
}

async function publishRecoverySourceBootstrapPairCloseV1(
  value: InternalProductionSourceRunLaunchTargetReservationPairCloseV1,
): Promise<InternalProductionSourceRunLaunchTargetReservationPairCloseV1> {
  const validated = validateInternalProductionSourceRunLaunchTargetReservationPairCloseV1(value);
  publishLegacyZeroRecordV1(recoverySourceBootstrapPairClosePathV1(validated.targetReservationPairCloseHash), await canonicalRecordBytes(validated));
  return resolveInternalProductionSourceRunLaunchTargetReservationPairCloseV1({
    targetReservationPairCloseRef: validated.targetReservationPairCloseRef,
    targetReservationPairCloseHash: validated.targetReservationPairCloseHash,
  });
}

export async function resolveInternalProductionSourceRunLaunchTargetReservationPairCloseV1(input: Readonly<{
  targetReservationPairCloseRef: string;
  targetReservationPairCloseHash: string;
}>): Promise<InternalProductionSourceRunLaunchTargetReservationPairCloseV1> {
  const pair = requirePair(input, "targetReservationPairCloseRef", "targetReservationPairCloseHash", "setfarm://internal-production/source-run-launch-target-reservation-pair-close/sha256/");
  const value = validateInternalProductionSourceRunLaunchTargetReservationPairCloseV1(readRecoverySourceBootstrapRecordV1(recoverySourceBootstrapPairClosePathV1(String(pair.targetReservationPairCloseHash)), "recovery source bootstrap pair close"));
  if (value.targetReservationPairCloseRef !== pair.targetReservationPairCloseRef || value.targetReservationPairCloseHash !== pair.targetReservationPairCloseHash) currentEntryFail("recovery source bootstrap pair-close pair is crossed");
  return value;
}

const RECOVERY_SOURCE_BOOTSTRAP_STATUS_NULLS_V1 = Object.freeze({
  targetSourceRunReservationRef: null, targetSourceRunReservationHash: null,
  targetRunReservationRef: null, targetRunReservationHash: null, targetRunLaunchCompositeHash: null,
  ownerAdmissionFenceRef: null, ownerAdmissionFenceHash: null,
  startIntentRef: null, startIntentHash: null, startOutboxRef: null, startOutboxHash: null,
  operationRef: null, operationHash: null, runId: null,
  operationRunBindingHash: null, reciprocalRunOperationBindingHash: null,
  terminalOwnerRef: null, terminalOwnerHash: null, terminalSourceRunRef: null, terminalSourceRunHash: null,
  terminalRunLaunchRef: null, terminalRunLaunchHash: null,
  targetReservationPairCloseRef: null, targetReservationPairCloseHash: null,
  fenceReleaseRef: null, fenceReleaseHash: null, sourceRunRef: null, sourceRunHash: null,
});

function recoverySourceBootstrapStatusV1(body: Record<string, unknown>): InternalProductionRecoverySourceBootstrapStatusV1 {
  return recursivelyFreeze({ ...body, statusHash: hashCanonicalJson(body) }) as InternalProductionRecoverySourceBootstrapStatusV1;
}

export async function observeInternalProductionRecoverySourceBootstrapStatusV1(): Promise<InternalProductionRecoverySourceBootstrapStatusV1> {
  let head: RecoverySourceBootstrapVisibilityHeadV1;
  try { head = recoverySourceBootstrapVisibilityPairV1(); }
  catch (error) {
    if (!isEnoent(error)) throw error;
    return recoverySourceBootstrapStatusV1({ state: "absent", pendingInputRef: null, pendingInputHash: null, ...RECOVERY_SOURCE_BOOTSTRAP_STATUS_NULLS_V1, visibilityHeadRef: null, visibilityHeadHash: null });
  }
  const pending = await resolveInternalProductionRecoverySourceBootstrapPendingInputV1({ pendingInputRef: head.pendingInputRef, pendingInputHash: head.pendingInputHash });
  if (head.state === "pending-input") return recoverySourceBootstrapStatusV1({ state: "pending-input", pendingInputRef: pending.pendingInputRef, pendingInputHash: pending.pendingInputHash, ...RECOVERY_SOURCE_BOOTSTRAP_STATUS_NULLS_V1, visibilityHeadRef: head.visibilityHeadRef, visibilityHeadHash: head.visibilityHeadHash });
  const operation = readRecoverySourceBootstrapOperationV1(String(head.operationHash));
  const prepared = { state: head.state, pendingInputRef: pending.pendingInputRef, pendingInputHash: pending.pendingInputHash, targetSourceRunReservationRef: operation.targetSourceRunReservationRef, targetSourceRunReservationHash: operation.targetSourceRunReservationHash, targetRunReservationRef: operation.targetRunReservationRef, targetRunReservationHash: operation.targetRunReservationHash, targetRunLaunchCompositeHash: operation.targetRunLaunchCompositeHash, ownerAdmissionFenceRef: operation.ownerAdmissionFenceRef, ownerAdmissionFenceHash: operation.ownerAdmissionFenceHash, startIntentRef: operation.startIntentRef, startIntentHash: operation.startIntentHash, startOutboxRef: operation.startOutboxRef, startOutboxHash: operation.startOutboxHash, operationRef: operation.operationRef, operationHash: operation.operationHash };
  if (head.state === "prepared") return recoverySourceBootstrapStatusV1({ ...prepared, runId: null, operationRunBindingHash: null, reciprocalRunOperationBindingHash: null, terminalOwnerRef: null, terminalOwnerHash: null, terminalSourceRunRef: null, terminalSourceRunHash: null, terminalRunLaunchRef: null, terminalRunLaunchHash: null, targetReservationPairCloseRef: null, targetReservationPairCloseHash: null, fenceReleaseRef: null, fenceReleaseHash: null, sourceRunRef: null, sourceRunHash: null, visibilityHeadRef: head.visibilityHeadRef, visibilityHeadHash: head.visibilityHeadHash });
  if (head.state === "terminal") {
    const receipt = await resolveInternalProductionRecoverySourceBootstrapRunReceiptV1({ sourceRunRef: String(head.sourceRunRef), sourceRunHash: String(head.sourceRunHash) });
    if (receipt.operationRef !== operation.operationRef || receipt.operationHash !== operation.operationHash) currentEntryFail("RECOVERY_SOURCE_BOOTSTRAP_PREFIX_AMBIGUOUS");
    return recoverySourceBootstrapStatusV1({ ...prepared, runId: receipt.runId, operationRunBindingHash: receipt.operationRunBindingHash, reciprocalRunOperationBindingHash: receipt.reciprocalRunOperationBindingHash, terminalOwnerRef: receipt.terminalOwnerRef, terminalOwnerHash: receipt.terminalOwnerHash, terminalSourceRunRef: receipt.terminalSourceRunRef, terminalSourceRunHash: receipt.terminalSourceRunHash, terminalRunLaunchRef: receipt.terminalRunLaunchRef, terminalRunLaunchHash: receipt.terminalRunLaunchHash, targetReservationPairCloseRef: receipt.targetReservationPairCloseRef, targetReservationPairCloseHash: receipt.targetReservationPairCloseHash, fenceReleaseRef: receipt.fenceReleaseRef, fenceReleaseHash: receipt.fenceReleaseHash, sourceRunRef: receipt.sourceRunRef, sourceRunHash: receipt.sourceRunHash, visibilityHeadRef: head.visibilityHeadRef, visibilityHeadHash: head.visibilityHeadHash });
  }
  currentEntryFail("RECOVERY_SOURCE_BOOTSTRAP_PREFIX_AMBIGUOUS");
}

async function prepareRecoverySourceBootstrapHeldLockV1(): Promise<InternalProductionRecoverySourceBootstrapOperationV1> {
  let pending: InternalProductionRecoverySourceBootstrapPendingInputV1;
  const pendingBody = { schema: "setfarm.internal-production-recovery-source-bootstrap-pending-input.v1" as const, purpose: "recovery-d-source-delivery-v1" as const, repository: "setfarm" as const, workflow: "feature-dev" as const, protocol: "v3" as const, promptManifestHash: RECOVERY_SOURCE_BOOTSTRAP_PROMPT_MANIFEST_HASH_V1 };
  const pendingInputHash = hashCanonicalJson(pendingBody);
  const pendingInputRef = `setfarm://internal-production/recovery-source-bootstrap-pending-input/sha256/${pendingInputHash}`;
  const pendingValue = recursivelyFreeze({ ...pendingBody, pendingInputRef, pendingInputHash });
  publishLegacyZeroRecordV1(path.join(recoverySourceBootstrapRootV1(), RECOVERY_SOURCE_BOOTSTRAP_PENDING_FILE_V1), await canonicalRecordBytes(pendingValue));
  pending = await resolveInternalProductionRecoverySourceBootstrapPendingInputV1({ pendingInputRef, pendingInputHash });
  let visibility: RecoverySourceBootstrapVisibilityHeadV1;
  try { visibility = recoverySourceBootstrapVisibilityPairV1(); }
  catch (error) {
    if (!isEnoent(error)) throw error;
    visibility = createRecoverySourceBootstrapVisibilityHeadV1({ state: "pending-input", predecessorVisibilityHeadRef: null, predecessorVisibilityHeadHash: null, pendingInputRef, pendingInputHash, operationRef: null, operationHash: null, sourceRunRef: null, sourceRunHash: null });
    await publishRecoverySourceBootstrapVisibilityV1(visibility, null);
  }
  if (visibility.pendingInputRef !== pending.pendingInputRef || visibility.pendingInputHash !== pending.pendingInputHash) currentEntryFail("RECOVERY_SOURCE_BOOTSTRAP_PREFIX_AMBIGUOUS");
  if (visibility.state === "prepared") return readRecoverySourceBootstrapOperationV1(String(visibility.operationHash));
  if (visibility.state !== "pending-input") currentEntryFail("RECOVERY_SOURCE_BOOTSTRAP_PREFIX_AMBIGUOUS");
  const db = await import("../db-pg.js") as unknown as Record<string, unknown>;
  const acquire = db.acquireInternalProductionSourceRunLaunchOwnerAdmissionFenceV1;
  const resolveProtocol = db.resolveCurrentInternalProductionRecoverySourceBootstrapRunProtocolAuthorityV1;
  if (typeof acquire !== "function" || acquire.length !== 1 || typeof resolveProtocol !== "function" || resolveProtocol.length !== 0) currentEntryFail("recovery source bootstrap database ports are unavailable");
  const protocolBefore = await (resolveProtocol as () => Promise<Record<string, unknown>>)();
  const controllerSource = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  if (protocolBefore.compilerReleaseSha !== controllerSource.sha || protocolBefore.baseSourceTreeHash !== controllerSource.treeHash || protocolBefore.buildHash !== controllerSource.buildHash) currentEntryFail("recovery source bootstrap protocol source is crossed");
  const acquired = await (acquire as (input: unknown) => Promise<Record<string, unknown>>)({ purpose: "recovery-d-source-delivery-v1", pendingInputRef, pendingInputHash });
  const protocolAfter = await (resolveProtocol as () => Promise<Record<string, unknown>>)();
  if (canonicalComparable(protocolAfter) !== canonicalComparable(protocolBefore)) currentEntryFail("recovery source bootstrap protocol authority drifted across fence acquisition");
  if (!isPlainRecord(acquired.fence) || !isPlainRecord(acquired.sourceRunReservation) || !isPlainRecord(acquired.runReservation) || !isPlainRecord(acquired.fence.targetFamily)) currentEntryFail("recovery source bootstrap fence result is invalid");
  const fence = acquired.fence; const sourceReservation = acquired.sourceRunReservation; const runReservation = acquired.runReservation; const family = fence.targetFamily as Record<string, unknown>;
  const intentBody = { schema: "setfarm.internal-production-recovery-source-bootstrap-start-intent.v1", purpose: "recovery-d-source-delivery-v1", repository: "setfarm", workflow: "feature-dev", protocol: "v3", promptManifestHash: pending.promptManifestHash, pendingInputRef, pendingInputHash, baseSourceSha: protocolAfter.compilerReleaseSha, baseSourceTreeHash: protocolAfter.baseSourceTreeHash, buildHash: protocolAfter.buildHash, activationPreflightHash: protocolAfter.activationPreflightHash, releaseAdmissionHash: protocolAfter.releaseAdmissionHash, targetSourceRunReservationRef: sourceReservation.reservationRef, targetSourceRunReservationHash: sourceReservation.reservationHash, targetRunReservationRef: runReservation.reservationRef, targetRunReservationHash: runReservation.reservationHash, targetRunLaunchCompositeHash: family.targetRunLaunchCompositeHash, ownerAdmissionFenceRef: fence.fenceRef, ownerAdmissionFenceHash: fence.fenceHash };
  const startIntentHash = hashCanonicalJson(intentBody); const startIntentRef = `setfarm://internal-production/recovery-source-bootstrap-start-intent/sha256/${startIntentHash}`; const intent = recursivelyFreeze({ ...intentBody, startIntentRef, startIntentHash });
  publishLegacyZeroRecordV1(recoverySourceBootstrapRecordPathV1("start-intents", startIntentHash), await canonicalRecordBytes(intent));
  const outboxBody = { schema: "setfarm.internal-production-recovery-source-bootstrap-start-outbox.v1", kind: "recovery-source-bootstrap", purpose: "recovery-d-source-delivery-v1", repository: "setfarm", workflow: "feature-dev", protocol: "v3", pendingInputRef, pendingInputHash, startIntentRef, startIntentHash, targetRunLaunchCompositeHash: family.targetRunLaunchCompositeHash };
  const startOutboxHash = hashCanonicalJson(outboxBody); const startOutboxRef = `setfarm://internal-production/recovery-source-bootstrap-start-outbox/sha256/${startOutboxHash}`; const outbox = recursivelyFreeze({ ...outboxBody, startOutboxRef, startOutboxHash });
  publishLegacyZeroRecordV1(recoverySourceBootstrapRecordPathV1("start-outboxes", startOutboxHash), await canonicalRecordBytes(outbox));
  const operationBody = { schema: "setfarm.internal-production-recovery-source-bootstrap-operation.v1" as const, purpose: "recovery-d-source-delivery-v1" as const, repository: "setfarm" as const, workflow: "feature-dev" as const, protocol: "v3" as const, promptManifestHash: pending.promptManifestHash, pendingInputRef, pendingInputHash, baseSourceSha: String(protocolAfter.compilerReleaseSha), baseSourceTreeHash: String(protocolAfter.baseSourceTreeHash), buildHash: String(protocolAfter.buildHash), activationPreflightHash: String(protocolAfter.activationPreflightHash), releaseAdmissionHash: String(protocolAfter.releaseAdmissionHash), targetSourceRunReservationRef: String(sourceReservation.reservationRef), targetSourceRunReservationHash: String(sourceReservation.reservationHash), targetRunReservationRef: String(runReservation.reservationRef), targetRunReservationHash: String(runReservation.reservationHash), targetRunLaunchCompositeHash: String(family.targetRunLaunchCompositeHash), ownerAdmissionFenceRef: String(fence.fenceRef), ownerAdmissionFenceHash: String(fence.fenceHash), startIntentRef, startIntentHash, startOutboxRef, startOutboxHash };
  const operationHash = hashCanonicalJson(operationBody); const operationRef = `setfarm://internal-production/recovery-source-bootstrap-operation/sha256/${operationHash}`; const operation = recursivelyFreeze({ ...operationBody, operationRef, operationHash });
  publishLegacyZeroRecordV1(recoverySourceBootstrapRecordPathV1("operations", operationHash), await canonicalRecordBytes(operation));
  const resolved = readRecoverySourceBootstrapOperationV1(operationHash);
  const prepared = createRecoverySourceBootstrapVisibilityHeadV1({ state: "prepared", predecessorVisibilityHeadRef: visibility.visibilityHeadRef, predecessorVisibilityHeadHash: visibility.visibilityHeadHash, pendingInputRef, pendingInputHash, operationRef, operationHash, sourceRunRef: null, sourceRunHash: null });
  await publishRecoverySourceBootstrapVisibilityV1(prepared, visibility);
  return resolved;
}

export async function prepareInternalProductionRecoverySourceBootstrapRunV1(): Promise<Readonly<{ operationRef: string; operationHash: string }>> {
  const currentEntryOperation = await observePreparedInternalProductionCurrentEntryOperationV1();
  if (!currentEntryOperation) currentEntryFail("CURRENT_ENTRY_UNAVAILABLE");
  const controllerLock = await acquireTask12ControllerLockV1(currentEntryOperation.operationHash);
  try { const operation = await prepareRecoverySourceBootstrapHeldLockV1(); return Object.freeze({ operationRef: operation.operationRef, operationHash: operation.operationHash }); }
  finally { releaseTask12ControllerLockV1(controllerLock); }
}

async function resumeRecoverySourceBootstrapHeldLockV1(): Promise<Readonly<{ sourceRunRef: string; sourceRunHash: string }>> {
  const operation = await prepareRecoverySourceBootstrapHeldLockV1();
  const visible = recoverySourceBootstrapVisibilityPairV1();
  if (visible.state === "terminal") {
    const receipt = await resolveInternalProductionRecoverySourceBootstrapRunReceiptV1({ sourceRunRef: String(visible.sourceRunRef), sourceRunHash: String(visible.sourceRunHash) });
    return Object.freeze({ sourceRunRef: receipt.sourceRunRef, sourceRunHash: receipt.sourceRunHash });
  }
  if (visible.state !== "prepared" || visible.operationRef !== operation.operationRef || visible.operationHash !== operation.operationHash) currentEntryFail("RECOVERY_SOURCE_BOOTSTRAP_PREFIX_AMBIGUOUS");
  const db = await import("../db-pg.js") as unknown as Record<string, unknown>;
  const reobserveFence = db.reobserveInternalProductionGlobalOwnerAdmissionFenceV1;
  const closeTargets = db.closeInternalProductionSourceRunLaunchTargetReservationsUnderFenceV1;
  const releaseFence = db.releaseInternalProductionGlobalOwnerAdmissionFenceV1;
  if (typeof reobserveFence !== "function" || reobserveFence.length !== 1 || typeof closeTargets !== "function" || closeTargets.length !== 1 || typeof releaseFence !== "function" || releaseFence.length !== 1) currentEntryFail("recovery source bootstrap fence lifecycle ports are unavailable");
  const fence = await (reobserveFence as (pair: unknown) => Promise<Record<string, unknown>>)({ fenceRef: operation.ownerAdmissionFenceRef, fenceHash: operation.ownerAdmissionFenceHash });
  if (fence.fenceRef !== operation.ownerAdmissionFenceRef || fence.fenceHash !== operation.ownerAdmissionFenceHash) currentEntryFail("recovery source bootstrap fence reobservation is crossed");
  const installer = await import("../installer/run.js") as unknown as Record<string, unknown>;
  const dispatch = installer.dispatchInternalProductionRecoverySourceBootstrapRunV1;
  if (typeof dispatch !== "function" || dispatch.length !== 1) currentEntryFail("recovery source bootstrap dispatcher is unavailable");
  const persisted = await (dispatch as (pair: unknown) => Promise<Record<string, unknown>>)({ operationRef: operation.operationRef, operationHash: operation.operationHash });
  const runId = requireSha256(persisted.runId, "recovery source bootstrap run id");
  const operationRunBindingHash = requireSha256(persisted.operationRunBindingHash, "recovery source bootstrap operation/run binding hash");
  const reciprocalRunOperationBindingHash = requireSha256(persisted.reciprocalRunOperationBindingHash, "recovery source bootstrap reciprocal binding hash");
  const runOwnerRef = `setfarm://runs/${encodeURIComponent(runId)}`;
  const runOwnerHash = hashCanonicalJson({ schema: "setfarm.internal-production-workflow-run-owner.v1", runId });
  const terminalOwnerHash = hashCanonicalJson({ schema: "setfarm.internal-production-recovery-source-run-terminal-owner.v1", operationRef: operation.operationRef, operationHash: operation.operationHash, runId, operationRunBindingHash, reciprocalRunOperationBindingHash });
  const terminalOwnerRef = `setfarm://internal-production/recovery-source-run-terminal-owner/sha256/${terminalOwnerHash}`;
  const sourceTerminalBody = { schema: "setfarm.internal-production-recovery-source-run-terminal-authority.v1", operationRef: operation.operationRef, operationHash: operation.operationHash, targetSourceRunReservationRef: operation.targetSourceRunReservationRef, targetSourceRunReservationHash: operation.targetSourceRunReservationHash, targetRunLaunchCompositeHash: operation.targetRunLaunchCompositeHash, runId, operationRunBindingHash, reciprocalRunOperationBindingHash, unrelatedReservationCount: 0 as const, unrelatedOwnerCount: 0 as const, terminalOwnerRef, terminalOwnerHash };
  const terminalSourceRunHash = hashCanonicalJson(sourceTerminalBody);
  const terminalSourceRunRef = `setfarm://internal-production/recovery-source-run-terminal-authority/sha256/${terminalSourceRunHash}`;
  publishLegacyZeroRecordV1(recoverySourceBootstrapRecordPathV1("terminal-source-runs", terminalSourceRunHash), await canonicalRecordBytes({ ...sourceTerminalBody, terminalSourceRunRef, terminalSourceRunHash }));
  const sourceTerminal = await resolveInternalProductionRecoverySourceRunTerminalAuthorityV1({ terminalSourceRunRef, terminalSourceRunHash });
  const runReservationTerminalOwnerHash = hashCanonicalJson({ schema: "setfarm.internal-production-recovery-run-launch-terminal-owner.v1", operationRef: operation.operationRef, operationHash: operation.operationHash, runId, runOwnerRef, runOwnerHash, operationRunBindingHash, reciprocalRunOperationBindingHash });
  const runReservationTerminalOwnerRef = `setfarm://internal-production/recovery-run-launch-terminal-owner/sha256/${runReservationTerminalOwnerHash}`;
  const runTerminalBody = { schema: "setfarm.internal-production-recovery-run-launch-terminal-authority.v1", operationRef: operation.operationRef, operationHash: operation.operationHash, targetRunReservationRef: operation.targetRunReservationRef, targetRunReservationHash: operation.targetRunReservationHash, targetRunLaunchCompositeHash: operation.targetRunLaunchCompositeHash, runId, operationRunBindingHash, reciprocalRunOperationBindingHash, runReservationTerminalOwnerRef, runReservationTerminalOwnerHash };
  const terminalRunLaunchHash = hashCanonicalJson(runTerminalBody);
  const terminalRunLaunchRef = `setfarm://internal-production/recovery-run-launch-terminal-authority/sha256/${terminalRunLaunchHash}`;
  publishLegacyZeroRecordV1(recoverySourceBootstrapRecordPathV1("terminal-run-launches", terminalRunLaunchHash), await canonicalRecordBytes({ ...runTerminalBody, terminalRunLaunchRef, terminalRunLaunchHash }));
  const runTerminal = await resolveInternalProductionRecoveryRunLaunchTerminalAuthorityV1({ terminalRunLaunchRef, terminalRunLaunchHash });
  const pairClose = await (closeTargets as (input: unknown) => Promise<InternalProductionSourceRunLaunchTargetReservationPairCloseV1>)({
    fenceRef: operation.ownerAdmissionFenceRef, fenceHash: operation.ownerAdmissionFenceHash,
    sourceRunReservationRef: operation.targetSourceRunReservationRef, sourceRunReservationHash: operation.targetSourceRunReservationHash,
    runReservationRef: operation.targetRunReservationRef, runReservationHash: operation.targetRunReservationHash,
    terminalSourceRunRef: sourceTerminal.terminalSourceRunRef, terminalSourceRunHash: sourceTerminal.terminalSourceRunHash,
    terminalRunLaunchRef: runTerminal.terminalRunLaunchRef, terminalRunLaunchHash: runTerminal.terminalRunLaunchHash,
  });
  const publishedPairClose = await publishRecoverySourceBootstrapPairCloseV1(pairClose);
  const releaseAuthority = recursivelyFreeze({
    purpose: "recovery-d-source-delivery-v1" as const, targetFamilyKind: "source-run-launch" as const,
    terminalCoreRef: null, terminalCoreHash: null, targetSetCloseRef: null, targetSetCloseHash: null,
    occurrenceRef: null, occurrenceHash: null, headRef: null, headHash: null,
    targetReservationPairCloseRef: publishedPairClose.targetReservationPairCloseRef,
    targetReservationPairCloseHash: publishedPairClose.targetReservationPairCloseHash,
    purposeTerminalKind: null, purposeTerminalRef: null, purposeTerminalHash: null,
  });
  const release = await (releaseFence as (input: unknown) => Promise<Record<string, unknown>>)({ fenceRef: operation.ownerAdmissionFenceRef, fenceHash: operation.ownerAdmissionFenceHash, releaseAuthority });
  const fenceReleaseRef = String(release.releaseRef); const fenceReleaseHash = requireSha256(release.releaseHash, "recovery source bootstrap fence release hash");
  const receiptBody = {
    schema: "setfarm.internal-production-recovery-source-bootstrap-run-receipt.v1", purpose: "recovery-d-source-delivery-v1",
    pendingInputRef: operation.pendingInputRef, pendingInputHash: operation.pendingInputHash,
    operationRef: operation.operationRef, operationHash: operation.operationHash,
    targetSourceRunReservationRef: operation.targetSourceRunReservationRef, targetSourceRunReservationHash: operation.targetSourceRunReservationHash,
    targetRunReservationRef: operation.targetRunReservationRef, targetRunReservationHash: operation.targetRunReservationHash,
    targetRunLaunchCompositeHash: operation.targetRunLaunchCompositeHash,
    ownerAdmissionFenceRef: operation.ownerAdmissionFenceRef, ownerAdmissionFenceHash: operation.ownerAdmissionFenceHash,
    startIntentRef: operation.startIntentRef, startIntentHash: operation.startIntentHash,
    startOutboxRef: operation.startOutboxRef, startOutboxHash: operation.startOutboxHash,
    runId, operationRunBindingHash, reciprocalRunOperationBindingHash,
    terminalOwnerRef, terminalOwnerHash, terminalSourceRunRef, terminalSourceRunHash,
    terminalRunLaunchRef, terminalRunLaunchHash,
    targetReservationPairCloseRef: publishedPairClose.targetReservationPairCloseRef,
    targetReservationPairCloseHash: publishedPairClose.targetReservationPairCloseHash,
    fenceReleaseRef, fenceReleaseHash,
  };
  const sourceRunHash = hashCanonicalJson(receiptBody); const sourceRunRef = `setfarm://internal-production/recovery-source-bootstrap-run-receipt/sha256/${sourceRunHash}`;
  publishLegacyZeroRecordV1(recoverySourceBootstrapRecordPathV1("run-receipts", sourceRunHash), await canonicalRecordBytes({ ...receiptBody, sourceRunRef, sourceRunHash }));
  const receipt = await resolveInternalProductionRecoverySourceBootstrapRunReceiptV1({ sourceRunRef, sourceRunHash });
  const terminal = createRecoverySourceBootstrapVisibilityHeadV1({ state: "terminal", predecessorVisibilityHeadRef: visible.visibilityHeadRef, predecessorVisibilityHeadHash: visible.visibilityHeadHash, pendingInputRef: operation.pendingInputRef, pendingInputHash: operation.pendingInputHash, operationRef: operation.operationRef, operationHash: operation.operationHash, sourceRunRef: receipt.sourceRunRef, sourceRunHash: receipt.sourceRunHash });
  await publishRecoverySourceBootstrapVisibilityV1(terminal, visible);
  return Object.freeze({ sourceRunRef: receipt.sourceRunRef, sourceRunHash: receipt.sourceRunHash });
}

export async function resumeActiveInternalProductionRecoverySourceBootstrapRunV1(): Promise<Readonly<{ sourceRunRef: string; sourceRunHash: string }>> {
  const currentEntryOperation = await observePreparedInternalProductionCurrentEntryOperationV1();
  if (!currentEntryOperation) currentEntryFail("CURRENT_ENTRY_UNAVAILABLE");
  const controllerLock = await acquireTask12ControllerLockV1(currentEntryOperation.operationHash);
  try {
    return await resumeRecoverySourceBootstrapHeldLockV1();
  } finally { releaseTask12ControllerLockV1(controllerLock); }
}

export async function resumeInternalProductionCurrentEntryAuthorityV1(
): Promise<InternalProductionCurrentEntryAuthorityStatusV1> {
  const operation = await observePreparedInternalProductionCurrentEntryOperationV1();
  if (!operation) currentEntryFail("CURRENT_ENTRY_UNAVAILABLE");
  const controllerLock = await acquireTask12ControllerLockV1(operation.operationHash);
  try {
  let status = await observeInternalProductionCurrentEntryAuthorityStatusV1();
  if (status.state === "ready") return status;
  const startup = await import("./baseline-spawner-startup-admission-v1.js") as unknown as Record<string, unknown>;
  const prepareRebind = startup.prepareInternalProductionPreSchemaSpawnerRebindAuthorizationV1;
  const executeRebind = startup.executeOrRecoverInternalProductionPreSchemaSpawnerRebindV1;
  const observeRebind = startup.observeInternalProductionPreSchemaSpawnerRebindStatusV1;
  if (typeof prepareRebind !== "function" || prepareRebind.length !== 0 || typeof executeRebind !== "function" || executeRebind.length !== 1 || typeof observeRebind !== "function" || observeRebind.length !== 0) currentEntryFail("pre-schema spawner controller ports are unavailable");
  if (status.state === "operation_prepared" || status.state === "pre_schema_spawner_rebinding") {
    const authorization = await (prepareRebind as () => Promise<Record<string, unknown>>)();
    if (status.state === "operation_prepared") status = await advanceTask12CurrentStatusV1(status, "pre_schema_spawner_rebinding", { preSchemaSpawnerRebindStatus: null, preSchemaSpawnerRebindStatusBody: null });
    await (executeRebind as (pair: unknown) => Promise<unknown>)(authorization);
    const rebindStatus = await (observeRebind as () => Promise<Record<string, unknown>>)();
    if (rebindStatus.state !== "pre_manifest_bootstrap_sealed") currentEntryFail("pre-schema spawner did not reach the sealed boundary");
    status = await advanceTask12CurrentStatusV1(status, "pre_manifest_bootstrap_sealed", {
      preSchemaSpawnerRebindStatus: { statusRef: rebindStatus.statusRef, statusHash: rebindStatus.statusHash },
      preSchemaSpawnerRebindStatusBody: rebindStatus,
    });
  }
  if (status.state === "pre_manifest_bootstrap_sealed") {
    const authorization = await prepareInternalProductionPreManifestMigration32AuthorizationV1();
    status = await advanceTask12CurrentStatusV1(status, "migration_applying", {
      migrationApplyingPhase: { phase: "prepared", authorization, consumption: null, migrationReceipt: null, currentAudit: null },
    });
  }
  if (status.state === "migration_applying") {
    const phase = status.migrationApplyingPhase as Record<string, unknown>;
    let authorization = phase.authorization as InternalProductionPreManifestMigration32AuthorizationPairV1;
    if (!isPlainRecord(authorization)) authorization = await prepareInternalProductionPreManifestMigration32AuthorizationV1();
    let migrationReceipt: InternalProductionBaselineBootstrapHandoffMigrationReceiptPairV1;
    if (phase.phase === "current_audited" && isPlainRecord(phase.migrationReceipt)) {
      migrationReceipt = phase.migrationReceipt as InternalProductionBaselineBootstrapHandoffMigrationReceiptPairV1;
      await resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1(migrationReceipt);
      if (!isPlainRecord(phase.currentAudit)) currentEntryFail("migration-32 current audit pair is absent");
      await resolveInternalProductionBootstrapHandoffCurrentAuditV1(phase.currentAudit as Readonly<{ bootstrapHandoffCurrentAuditRef: string; bootstrapHandoffCurrentAuditHash: string }>);
    } else {
      migrationReceipt = await applyInternalProductionBaselineBootstrapHandoffMigrationV1(authorization);
      const migrationStatus = await observeInternalProductionPreManifestMigration32AuthorizationStatusV1();
      if (migrationStatus.state !== "terminal" || !isPlainRecord(migrationStatus.consumption)) currentEntryFail("migration-32 terminal status is unavailable");
      status = await advanceTask12CurrentStatusV1(status, "migration_applying", {
        migrationApplyingPhase: { phase: "receipt_published", authorization, consumption: migrationStatus.consumption, migrationReceipt, currentAudit: null },
      });
      const db = await import("../db-pg.js") as unknown as Record<string, unknown>;
      const auditCurrent = db.auditCurrentInternalProductionBaselineBootstrapHandoffMigration32V1;
      if (typeof auditCurrent !== "function" || auditCurrent.length !== 0) currentEntryFail("migration-32 current database audit port is unavailable");
      const databaseAudit = await (auditCurrent as () => Promise<Record<string, unknown>>)();
      const auditBody = { schema: "setfarm.internal-production-bootstrap-handoff-current-audit.v1", currentStatus: "current", currentEntryOperation: operationPair(operation), migrationReceipt, databaseAudit };
      const audit = await publishTask12HashedRecordV1("current-audits", auditBody, "bootstrapHandoffCurrentAuditRef", "bootstrapHandoffCurrentAuditHash", TASK12_MIGRATION_PREFIXES_V1.currentAudit);
      const currentAudit = { bootstrapHandoffCurrentAuditRef: String(audit.bootstrapHandoffCurrentAuditRef), bootstrapHandoffCurrentAuditHash: String(audit.bootstrapHandoffCurrentAuditHash) };
      await resolveInternalProductionBootstrapHandoffCurrentAuditV1(currentAudit);
      status = await advanceTask12CurrentStatusV1(status, "migration_applying", {
        migrationApplyingPhase: { phase: "current_audited", authorization, consumption: migrationStatus.consumption, migrationReceipt, currentAudit },
      });
    }
  }
  if (status.state === "migration_applying") {
    const db = await import("../db-pg.js") as unknown as Record<string, unknown>;
    const applyOrAdoptInternalProductionCurrentEntryOrdinaryMigration33V1 = db.applyOrAdoptInternalProductionCurrentEntryOrdinaryMigration33V1;
    if (typeof applyOrAdoptInternalProductionCurrentEntryOrdinaryMigration33V1 !== "function" || applyOrAdoptInternalProductionCurrentEntryOrdinaryMigration33V1.length !== 0) currentEntryFail("ordinary migration-33 controller port is unavailable");
    await (applyOrAdoptInternalProductionCurrentEntryOrdinaryMigration33V1 as () => Promise<unknown>)();
    status = await advanceTask12CurrentStatusV1(status, "manifest_activating", {});
  }
  if (status.state === "manifest_activating") {
    const activationController = await import("./baseline-owner-producer-manifest-activation-controller-v1.js") as unknown as Record<string, unknown>;
    const activateInternalProductionBaselineOwnerProducerManifestV1 = activationController.activateInternalProductionBaselineOwnerProducerManifestV1;
    if (typeof activateInternalProductionBaselineOwnerProducerManifestV1 !== "function" || activateInternalProductionBaselineOwnerProducerManifestV1.length !== 0) currentEntryFail("manifest A activation controller is unavailable");
    const manifestActivation = await (activateInternalProductionBaselineOwnerProducerManifestV1 as () => Promise<Record<string, unknown>>)();
    status = await advanceTask12CurrentStatusV1(status, "spawner_admission_transitioning", {
      manifestActivation: {
        ownerProducerManifestActivationRef: manifestActivation.successorActivationRef,
        ownerProducerManifestActivationHash: manifestActivation.successorActivationHash,
        ownerProducerManifestHeadRef: manifestActivation.successorHeadRef,
        ownerProducerManifestHeadHash: manifestActivation.successorHeadHash,
      },
      spawnerAdmissionTransitionPhase: { phase: "sealed", sealedAdmission: (status.preSchemaSpawnerRebindStatusBody as Record<string, unknown>).sealedAdmission, admissionReady: null, loadedRuntimeServiceAuthority: null },
    });
  }
  if (status.state === "spawner_admission_transitioning") {
    await prepareRecoverySourceBootstrapHeldLockV1();
    const db = await import("../db-pg.js") as unknown as Record<string, unknown>;
    const verifyInternalProductionCurrentEntryDatabaseThroughMigration33AndManifestAV1 = db.verifyInternalProductionCurrentEntryDatabaseThroughMigration33AndManifestAV1;
    const initializeInternalProductionCurrentEntryDatabaseV1 = db.initializeInternalProductionCurrentEntryDatabaseV1;
    if (typeof verifyInternalProductionCurrentEntryDatabaseThroughMigration33AndManifestAV1 !== "function" || typeof initializeInternalProductionCurrentEntryDatabaseV1 !== "function") currentEntryFail("current-entry database verification/initialization ports are unavailable");
    await (verifyInternalProductionCurrentEntryDatabaseThroughMigration33AndManifestAV1 as () => Promise<unknown>)();
    await (initializeInternalProductionCurrentEntryDatabaseV1 as () => Promise<unknown>)();
    const spawner = await import("../spawner.js") as unknown as Record<string, unknown>;
    const transitionInternalProductionTask0SpawnerToNormalAdmissionReadyV1 = spawner.transitionInternalProductionTask0SpawnerToNormalAdmissionReadyV1;
    if (typeof transitionInternalProductionTask0SpawnerToNormalAdmissionReadyV1 !== "function" || transitionInternalProductionTask0SpawnerToNormalAdmissionReadyV1.length !== 0) currentEntryFail("same-generation spawner readiness port is unavailable");
    const admissionReady = await (transitionInternalProductionTask0SpawnerToNormalAdmissionReadyV1 as () => Promise<Record<string, unknown>>)();
    const readyRebindStatus = await (observeRebind as () => Promise<Record<string, unknown>>)();
    if (readyRebindStatus.state !== "normal_task0_admission_ready" || !isPlainRecord(readyRebindStatus.admissionReady) || canonicalComparable(readyRebindStatus.admissionReady) !== canonicalComparable(admissionReady)) currentEntryFail("same-generation spawner ready status is crossed");
    const sealedAdmission = readyRebindStatus.sealedAdmission;
    status = await advanceTask12CurrentStatusV1(status, "spawner_admission_transitioning", {
      preSchemaSpawnerRebindStatus: { statusRef: readyRebindStatus.statusRef, statusHash: readyRebindStatus.statusHash },
      preSchemaSpawnerRebindStatusBody: readyRebindStatus,
      spawnerAdmissionTransitionPhase: { phase: "admission_ready", sealedAdmission, admissionReady, loadedRuntimeServiceAuthority: null },
    });
    const loadedCensus = await observeInternalProductionServiceCensusV1();
    const loadedBody = { schema: "setfarm.internal-production-loaded-runtime-service-authority.v1", currentEntryOperationRef: operation.operationRef, currentEntryOperationHash: operation.operationHash, observedServiceCensusHash: loadedCensus.censusHash, spawner: loadedCensus.spawner, dashboard: loadedCensus.dashboard, missionControl: loadedCensus.missionControl, openClaw: loadedCensus.openClaw };
    const loadedRuntimeServiceAuthorityHash = hashCanonicalJson(loadedBody);
    const loadedRuntimeServiceAuthority = recursivelyFreeze({ loadedRuntimeServiceAuthorityRef: `setfarm://internal-production/loaded-runtime-service-authority/sha256/${loadedRuntimeServiceAuthorityHash}`, loadedRuntimeServiceAuthorityHash });
    status = await advanceTask12CurrentStatusV1(status, "spawner_admission_transitioning", { spawnerAdmissionTransitionPhase: { phase: "runtime_observed", sealedAdmission, admissionReady, loadedRuntimeServiceAuthority } });
    status = await advanceTask12CurrentStatusV1(status, "prepared", {});
  }
  if (status.state === "prepared") {
    const sourceRun = await resumeRecoverySourceBootstrapHeldLockV1();
    const sourceStatus = await observeInternalProductionRecoverySourceBootstrapStatusV1();
    if (sourceStatus.state !== "terminal" || sourceStatus.sourceRunRef !== sourceRun.sourceRunRef || sourceStatus.sourceRunHash !== sourceRun.sourceRunHash) currentEntryFail("recovery source bootstrap terminal status is crossed");
    status = await advanceTask12CurrentStatusV1(status, "canary_running", {
      canaryRunningPhase: {
        phase: "running",
        ownerAdmissionFenceRef: sourceStatus.ownerAdmissionFenceRef,
        ownerAdmissionFenceHash: sourceStatus.ownerAdmissionFenceHash,
        sourceRunTargetReservationRef: sourceStatus.targetSourceRunReservationRef,
        sourceRunTargetReservationHash: sourceStatus.targetSourceRunReservationHash,
        runTargetReservationRef: sourceStatus.targetRunReservationRef,
        runTargetReservationHash: sourceStatus.targetRunReservationHash,
        terminalSettlementRef: null,
        terminalSettlementHash: null,
        targetCloseRef: null,
        targetCloseHash: null,
      },
    });
    return status;
  }
  if (status.state === "canary_running" && isPlainRecord(status.canaryRunningPhase) && status.canaryRunningPhase.phase === "running") {
    const sourceStatus = await observeInternalProductionRecoverySourceBootstrapStatusV1();
    if (sourceStatus.state !== "terminal") currentEntryFail("recovery source bootstrap terminal authority is unavailable");
    await observeCompleteInternalProductionZeroOwnerCensusV1();
    status = await advanceTask12CurrentStatusV1(status, "canary_running", {
      canaryRunningPhase: {
        ...status.canaryRunningPhase,
        phase: "terminal_settlement_published",
        terminalSettlementRef: sourceStatus.terminalSourceRunRef,
        terminalSettlementHash: sourceStatus.terminalSourceRunHash,
      },
    });
  }
  if (status.state === "canary_running" && isPlainRecord(status.canaryRunningPhase) && status.canaryRunningPhase.phase === "terminal_settlement_published") {
    const sourceStatus = await observeInternalProductionRecoverySourceBootstrapStatusV1();
    if (sourceStatus.state !== "terminal") currentEntryFail("recovery source bootstrap close authority is unavailable");
    status = await advanceTask12CurrentStatusV1(status, "settled", {
      settledPhase: {
        phase: "target_closed",
        terminalSettlementRef: sourceStatus.terminalSourceRunRef,
        terminalSettlementHash: sourceStatus.terminalSourceRunHash,
        targetCloseRef: sourceStatus.targetReservationPairCloseRef,
        targetCloseHash: sourceStatus.targetReservationPairCloseHash,
        ownerAdmissionFenceReleaseRef: null,
        ownerAdmissionFenceReleaseHash: null,
        entryAuthorityRef: null,
        entryAuthorityHash: null,
      },
    });
  }
  if (status.state === "settled" && isPlainRecord(status.settledPhase) && status.settledPhase.phase === "target_closed") {
    const sourceStatus = await observeInternalProductionRecoverySourceBootstrapStatusV1();
    if (sourceStatus.state !== "terminal") currentEntryFail("recovery source bootstrap release authority is unavailable");
    status = await advanceTask12CurrentStatusV1(status, "settled", {
      settledPhase: {
        ...status.settledPhase,
        phase: "fence_released",
        ownerAdmissionFenceReleaseRef: sourceStatus.fenceReleaseRef,
        ownerAdmissionFenceReleaseHash: sourceStatus.fenceReleaseHash,
      },
    });
  }
  if (status.state === "settled" && isPlainRecord(status.settledPhase) && status.settledPhase.phase === "fence_released") {
    const sourceStatus = await observeInternalProductionRecoverySourceBootstrapStatusV1();
    if (sourceStatus.state !== "terminal") currentEntryFail("recovery source bootstrap final authority is unavailable");
    const zero = await observeCompleteInternalProductionZeroOwnerCensusV1();
    const rebind = status.preSchemaSpawnerRebindStatusBody as Record<string, unknown>;
    const migration = status.migrationApplyingPhase as Record<string, unknown>;
    const manifest = status.manifestActivation as Record<string, unknown>;
    const admission = status.spawnerAdmissionTransitionPhase as Record<string, unknown>;
    const dispatchPrefix = rebind.dispatchPrefix as Record<string, unknown>;
    const deliveryResponse = operation.productBuildAuthorityV2Observation.response as Record<string, unknown>;
    const deliveryEvidence = deliveryResponse.evidence as Record<string, unknown>;
    const focused = deliveryEvidence.focusedTests as Record<string, unknown>;
    if (![rebind, migration, manifest, admission, dispatchPrefix, deliveryEvidence, focused].every(isPlainRecord)) currentEntryFail("current-entry authority causal prefix is incomplete");
    const serviceCensus = await observeInternalProductionServiceCensusV1();
    const loadedBody = { schema: "setfarm.internal-production-loaded-runtime-service-authority.v1", currentEntryOperationRef: operation.operationRef, currentEntryOperationHash: operation.operationHash, observedServiceCensusHash: serviceCensus.censusHash, spawner: serviceCensus.spawner, dashboard: serviceCensus.dashboard, missionControl: serviceCensus.missionControl, openClaw: serviceCensus.openClaw };
    const loadedHash = hashCanonicalJson(loadedBody);
    if (!isPlainRecord(admission.loadedRuntimeServiceAuthority) || admission.loadedRuntimeServiceAuthority.loadedRuntimeServiceAuthorityHash !== loadedHash) currentEntryFail("current-entry loaded runtime authority drifted");
    const authorityBody = {
      schema: "setfarm.internal-production-current-entry-authority.v1",
      controllerSourceAuthority: status.controllerSourceAuthority,
      productBuildAuthorityV2DeliveryEvidence: status.productBuildAuthorityV2DeliveryEvidence,
      authorityV3Migration31Audit: status.authorityV3Migration31Audit,
      pendingBootstrapHandoffMigration: status.pendingBootstrapHandoffMigration,
      authorityV3FocusedTestReceipt: { focusedTestReceiptRef: focused.focusedTestReceiptRef, focusedTestReceiptHash: focused.focusedTestReceiptHash },
      currentEntryOperation: operationPair(operation),
      preMutationLoadedRuntimeServiceAuthority: { preMutationLoadedRuntimeServiceAuthorityRef: status.preMutationLoadedRuntimeServiceAuthorityRef, preMutationLoadedRuntimeServiceAuthorityHash: status.preMutationLoadedRuntimeServiceAuthorityHash },
      preSchemaSpawnerRebindAuthorization: rebind.authorization,
      preSchemaSpawnerStartupToken: rebind.startupToken,
      preSchemaSpawnerRestartAuthority: rebind.restartAuthority,
      predecessorTerminationObservation: dispatchPrefix.predecessorTerminationObservation,
      replacementProcessObservation: dispatchPrefix.replacementProcessObservation,
      postPredecessorTerminationLegacyZeroOwnerObservation: { observationRef: (rebind.sealedAdmission as Record<string, unknown>).postPredecessorTerminationLegacyZeroOwnerObservationRef, observationHash: (rebind.sealedAdmission as Record<string, unknown>).postPredecessorTerminationLegacyZeroOwnerObservationHash },
      preSchemaSpawnerSealedAdmission: rebind.sealedAdmission,
      freshLegacyZeroOwnerObservation: { observationRef: (migration.authorization as Record<string, unknown>).freshLegacyZeroOwnerObservationRef, observationHash: (migration.authorization as Record<string, unknown>).freshLegacyZeroOwnerObservationHash },
      preManifestMigration32Authorization: migration.authorization,
      preManifestMigration32AuthorizationConsumption: migration.consumption,
      bootstrapHandoffMigrationReceipt: migration.migrationReceipt,
      bootstrapHandoffCurrentAudit: migration.currentAudit,
      ownerProducerManifestActivation: { ownerProducerManifestActivationRef: manifest.ownerProducerManifestActivationRef, ownerProducerManifestActivationHash: manifest.ownerProducerManifestActivationHash },
      ownerProducerManifestHead: { ownerProducerManifestHeadRef: manifest.ownerProducerManifestHeadRef, ownerProducerManifestHeadHash: manifest.ownerProducerManifestHeadHash },
      task0SpawnerAdmissionReady: admission.admissionReady,
      preSchemaSpawnerRebindStatus: status.preSchemaSpawnerRebindStatus,
      loadedRuntimeServiceAuthority: { ...(admission.loadedRuntimeServiceAuthority as Record<string, unknown>), body: loadedBody },
      ownerAdmissionFence: { ownerAdmissionFenceRef: sourceStatus.ownerAdmissionFenceRef, ownerAdmissionFenceHash: sourceStatus.ownerAdmissionFenceHash },
      sourceRunTargetReservation: { reservationRef: sourceStatus.targetSourceRunReservationRef, reservationHash: sourceStatus.targetSourceRunReservationHash },
      runTargetReservation: { reservationRef: sourceStatus.targetRunReservationRef, reservationHash: sourceStatus.targetRunReservationHash },
      terminalSettlement: { terminalSettlementRef: sourceStatus.terminalSourceRunRef, terminalSettlementHash: sourceStatus.terminalSourceRunHash },
      targetClose: { targetReservationPairCloseRef: sourceStatus.targetReservationPairCloseRef, targetReservationPairCloseHash: sourceStatus.targetReservationPairCloseHash },
      ownerAdmissionFenceRelease: { ownerAdmissionFenceReleaseRef: sourceStatus.fenceReleaseRef, ownerAdmissionFenceReleaseHash: sourceStatus.fenceReleaseHash },
      completeZeroOwnerCensusObservation: { observationRef: zero.observationRef, observationHash: zero.observationHash },
      missionControlSourceSha: serviceCensus.missionControl.loadedSourceSha,
    };
    const entryAuthorityHash = hashCanonicalJson(authorityBody);
    const entryAuthorityRef = `${TASK12_AUTHORITY_PREFIX_V1}${entryAuthorityHash}`;
    const entryAuthority = recursivelyFreeze({ ...authorityBody, entryAuthorityRef, entryAuthorityHash });
    publishLegacyZeroRecordV1(task12RecordPathV1("entry-authorities", entryAuthorityHash), await canonicalRecordBytes(entryAuthority));
    await resolveInternalProductionCurrentEntryAuthorityV1({ entryAuthorityRef, entryAuthorityHash });
    status = await advanceTask12CurrentStatusV1(status, "ready", { entryAuthority: { entryAuthorityRef, entryAuthorityHash } });
  }
    return status;
  } finally {
    releaseTask12ControllerLockV1(controllerLock);
  }
}

export async function verifyCurrentInternalProductionCurrentEntryV1(
): Promise<Readonly<Record<string, unknown>>> {
  const status = await observeInternalProductionCurrentEntryAuthorityStatusV1();
  if (status.state !== "ready" || !status.entryAuthority || typeof status.entryAuthority !== "object") currentEntryFail("current entry is not ready");
  const pair = status.entryAuthority as InternalProductionCurrentEntryAuthorityPairV1;
  const authority = await resolveInternalProductionCurrentEntryAuthorityV1(pair);
  const serviceCensus = await observeInternalProductionServiceCensusV1();
  const completeZeroOwnerCensusObservationBody = await observeCompleteInternalProductionZeroOwnerCensusV1();
  const completeZeroOwnerCensusObservation = {
    observationRef: String(completeZeroOwnerCensusObservationBody.observationRef),
    observationHash: String(completeZeroOwnerCensusObservationBody.observationHash),
  };
  const controllerSourceAuthority = authority.controllerSourceAuthority;
  const loadedRuntimeServiceAuthority = authority.loadedRuntimeServiceAuthority;
  if (!isPlainRecord(controllerSourceAuthority) || !isPlainRecord(loadedRuntimeServiceAuthority) || !isPlainRecord(loadedRuntimeServiceAuthority.body)) currentEntryFail("current-entry runtime source authorities are incomplete");
  const loadedBody = loadedRuntimeServiceAuthority.body as Record<string, unknown>;
  if (serviceCensus.spawner.loadedSourceSha !== controllerSourceAuthority.controllerSourceSha || serviceCensus.spawner.loadedTreeHash !== controllerSourceAuthority.controllerTreeHash || serviceCensus.spawner.loadedBuildHash !== controllerSourceAuthority.controllerBuildHash) currentEntryFail("current-entry spawner runtime does not equal controller source");
  const controllerRuntimeSourceRelations = {
    controllerSourceAuthority,
    loadedRuntimeServiceAuthority: { loadedRuntimeServiceAuthorityRef: loadedRuntimeServiceAuthority.loadedRuntimeServiceAuthorityRef, loadedRuntimeServiceAuthorityHash: loadedRuntimeServiceAuthority.loadedRuntimeServiceAuthorityHash },
    spawner: { relation: "equals-controller-source-authority", loadedSourceSha: serviceCensus.spawner.loadedSourceSha, loadedTreeHash: serviceCensus.spawner.loadedTreeHash, loadedBuildHash: serviceCensus.spawner.loadedBuildHash },
    dashboard: { relation: "authenticated-delivered-runtime", loadedSourceSha: serviceCensus.dashboard.loadedSourceSha, loadedTreeHash: serviceCensus.dashboard.loadedTreeHash, loadedBuildHash: serviceCensus.dashboard.loadedBuildHash },
    missionControl: { relation: "authenticated-delivered-runtime", loadedSourceSha: serviceCensus.missionControl.loadedSourceSha, loadedTreeHash: serviceCensus.missionControl.loadedTreeHash, loadedBuildHash: serviceCensus.missionControl.loadedBuildHash },
    openClaw: { relation: "authenticated-process-generation-listener-only", loadedSourceSha: null, loadedTreeHash: null, loadedBuildHash: null },
  };
  if (canonicalComparable(loadedBody.spawner) !== canonicalComparable(serviceCensus.spawner) || canonicalComparable(loadedBody.dashboard) !== canonicalComparable(serviceCensus.dashboard) || canonicalComparable(loadedBody.missionControl) !== canonicalComparable(serviceCensus.missionControl) || canonicalComparable(loadedBody.openClaw) !== canonicalComparable(serviceCensus.openClaw)) currentEntryFail("current-entry loaded runtime authority is stale");
  const currentEntryStatus = { statusRef: status.statusRef, statusHash: status.statusHash };
  const observedAt = new Date().toISOString();
  if (!RFC3339_MILLIS.test(observedAt)) currentEntryFail("current-entry observation clock is invalid");
  const freshBody = { schema: "setfarm.internal-production-current-entry-fresh-runtime-and-owner-observation.v1", currentEntryStatus, entryAuthority: pair, serviceCensus, completeZeroOwnerCensusObservation, completeZeroOwnerCensusObservationBody, controllerRuntimeSourceRelations, observedAt };
  const freshRuntimeAndOwnerObservationHash = hashCanonicalJson(freshBody);
  const freshRuntimeAndOwnerObservationRef = `${TASK12_FRESH_OBSERVATION_PREFIX_V1}${freshRuntimeAndOwnerObservationHash}`;
  const freshValue = recursivelyFreeze({ ...freshBody, freshRuntimeAndOwnerObservationRef, freshRuntimeAndOwnerObservationHash });
  publishLegacyZeroRecordV1(task12RecordPathV1("fresh-runtime-and-owner-observations", freshRuntimeAndOwnerObservationHash), await canonicalRecordBytes(freshValue));
  await resolveInternalProductionCurrentEntryFreshRuntimeAndOwnerObservationV1({ freshRuntimeAndOwnerObservationRef, freshRuntimeAndOwnerObservationHash });
  const orderedPairs = await deriveTask12ResolvedAuthorityPairsV1(authority, pair, currentEntryStatus, completeZeroOwnerCensusObservation, { freshRuntimeAndOwnerObservationRef, freshRuntimeAndOwnerObservationHash });
  const resolvedAuthoritySetHash = hashCanonicalJson(orderedPairs);
  const body = { schema: "setfarm.internal-production-current-entry-verification.v1", currentStatus: "current", currentEntryStatus, entryAuthority: pair, resolvedAuthoritySetHash, freshRuntimeAndOwnerObservation: { freshRuntimeAndOwnerObservationRef, freshRuntimeAndOwnerObservationHash } };
  const currentEntryVerificationHash = hashCanonicalJson(body);
  const currentEntryVerificationRef = `${TASK12_VERIFICATION_PREFIX_V1}${currentEntryVerificationHash}`;
  const value = recursivelyFreeze({ ...body, currentEntryVerificationRef, currentEntryVerificationHash });
  publishLegacyZeroRecordV1(task12RecordPathV1("verifications", currentEntryVerificationHash), await canonicalRecordBytes(value));
  return resolveInternalProductionCurrentEntryVerificationV1({ currentEntryVerificationRef, currentEntryVerificationHash });
}

export async function observeInternalProductionReviewedDSourceBuildGateV1(
): Promise<InternalProductionReviewedDSourceBuildGateV1> {
  const activationPath = "./recovery-owner-producer-manifest-activation-v1.js";
  const missionControlPath = "./recovery-mission-control-source-handoff-v1.js";
  const activationModule = await import(activationPath) as Record<string, unknown>;
  const missionControlModule = await import(missionControlPath) as Record<string, unknown>;
  const observeActivation = activationModule.observeInternalProductionRecoveryOwnerProducerManifestActivationStatusV1;
  const resolveActivation = activationModule.resolveInternalProductionRecoveryOwnerProducerManifestActivationV1;
  const observeMissionControl = missionControlModule.observeCurrentInternalProductionRecoveryMissionControlReviewedCleanMainV1;
  if (typeof observeActivation !== "function" || observeActivation.length !== 0 || typeof resolveActivation !== "function" || resolveActivation.length !== 1 || typeof observeMissionControl !== "function" || observeMissionControl.length !== 0) currentEntryFail("reviewed D source/build ports are unavailable");
  const status = await (observeActivation as () => Promise<Record<string, unknown>>)();
  if (status.state !== "activated" || typeof status.receiptRef !== "string" || typeof status.receiptHash !== "string") currentEntryFail("reviewed D activation is not terminal");
  const activation = await (resolveActivation as (pair: unknown) => Promise<Record<string, unknown>>)({ receiptRef: status.receiptRef, receiptHash: status.receiptHash });
  const missionControl = await (observeMissionControl as () => Promise<Record<string, unknown>>)();
  const source = observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  const gate = {
    schema: "setfarm.internal-production-reviewed-d-source-build-gate.v1" as const,
    reviewed: true as const,
    setfarmSourceSha: String(activation.sourceSha ?? source.sha),
    missionControlSourceSha: String(missionControl.missionControlSourceSha),
    setfarmBuildHash: String(activation.buildHash ?? source.buildHash),
    missionControlBuildHash: String(missionControl.missionControlBuildHash),
    recoveryProducerManifestActivationRef: status.receiptRef,
    recoveryProducerManifestActivationHash: status.receiptHash,
    missionControlHandoffRef: String(missionControl.missionControlHandoffRef),
    missionControlHandoffHash: String(missionControl.missionControlHandoffHash),
  };
  for (const key of ["setfarmSourceSha", "missionControlSourceSha"] as const) requireGitHash(gate[key], key);
  for (const key of ["setfarmBuildHash", "missionControlBuildHash", "recoveryProducerManifestActivationHash", "missionControlHandoffHash"] as const) requireSha256(gate[key], key);
  return recursivelyFreeze(gate);
}

export async function observeInternalProductionServiceRestartCutoverReadinessCandidateV1(
): Promise<Readonly<Record<string, unknown>>> {
  await observeInternalProductionReviewedDSourceBuildGateV1();
  currentEntryFail("reviewed D cutover readiness prerequisites are incomplete");
}

export async function resolveInternalProductionBaselineServiceRestartAuthorizationV1(
  input: Readonly<{ authorizationRef: string; authorizationHash: string }>,
): Promise<Readonly<Record<string, unknown>>> {
  const pair = requirePair(input, "authorizationRef", "authorizationHash", BASELINE_RESTART_AUTHORIZATION_PREFIX_V1);
  const target = baselineRestartPathV1("authorizations", pair.authorizationHash!);
  const value = strictCanonicalRecord(readTask12ReceiptStoreBytesV1(target), "baseline restart authorization");
  const body = { ...value }; delete body.authorizationRef; delete body.authorizationHash;
  const ordinaryKeys = ["schema", "service", "migrationReceiptRef", "migrationReceiptHash", "zeroOwnerGuardRef", "zeroOwnerGuardHash", "completeZeroOwnerCensusHash", "preparedRuntimeSourceProjectionHash", "authorizationRef", "authorizationHash"];
  const fencedKeys = ["schema", "service", "migrationReceiptRef", "migrationReceiptHash", "bootstrapOperationRef", "bootstrapOperationHash", "targetGuardReceiptRef", "targetGuardReceiptHash", "targetGuardHash", "targetGuardConsumptionRef", "targetGuardConsumptionHash", "requestIdHash", "claimIdHash", "runIdentityHash", "ownerGenerationHash", "unrelatedOwnerCensusHash", "preparedRuntimeSourceProjectionHash", "authorizationRef", "authorizationHash"];
  if ((!hasExactKeys(value, ordinaryKeys) && !hasExactKeys(value, fencedKeys)) || !Object.hasOwn(BASELINE_RESTART_ACTIONS_V1, String(value.service)) || value.authorizationRef !== pair.authorizationRef || value.authorizationHash !== pair.authorizationHash || hashCanonicalJson(body) !== pair.authorizationHash) currentEntryFail("baseline restart authorization is crossed");
  return recursivelyFreeze(value);
}

export async function resolveInternalProductionBaselineServiceRestartOperationV1(
  input: Readonly<{ operationRef: string; operationHash: string }>,
): Promise<Readonly<Record<string, unknown>>> {
  const pair = requirePair(input, "operationRef", "operationHash", BASELINE_RESTART_OPERATION_PREFIX_V1);
  const target = baselineRestartPathV1("operations", pair.operationHash!);
  const value = strictCanonicalRecord(readTask12ReceiptStoreBytesV1(target), "baseline restart operation");
  const body = { ...value }; delete body.operationRef; delete body.operationHash;
  if (!hasExactKeys(value, ["schema", "service", "actionId", "authorizationRef", "authorizationHash", "operationRef", "operationHash"]) || value.schema !== "setfarm.internal-production-baseline-service-restart-operation.v1" || BASELINE_RESTART_ACTIONS_V1[value.service as keyof typeof BASELINE_RESTART_ACTIONS_V1] !== value.actionId || value.operationRef !== pair.operationRef || value.operationHash !== pair.operationHash || hashCanonicalJson(body) !== pair.operationHash) currentEntryFail("baseline restart operation is crossed");
  await resolveInternalProductionBaselineServiceRestartAuthorizationV1({ authorizationRef: String(value.authorizationRef), authorizationHash: String(value.authorizationHash) });
  return recursivelyFreeze(value);
}

export async function observePreparedInternalProductionBaselineServiceRestartLaunchOutboxV1(
  input: Readonly<{ operationRef: string; operationHash: string }>,
): Promise<Readonly<Record<string, unknown>>> {
  const operation = await resolveInternalProductionBaselineServiceRestartOperationV1(input);
  const locator = baselineRestartOutboxLocatorV1(input.operationHash);
  const stored = strictCanonicalRecord(readTask12ReceiptStoreBytesV1(locator), "baseline restart outbox locator");
  if (!hasExactKeys(stored, ["operationRef", "operationHash", "outboxRef", "outboxHash"]) || stored.operationRef !== input.operationRef || stored.operationHash !== input.operationHash) currentEntryFail("baseline restart outbox locator is crossed");
  const pair = requirePair({ outboxRef: stored.outboxRef, outboxHash: stored.outboxHash }, "outboxRef", "outboxHash", BASELINE_RESTART_OUTBOX_PREFIX_V1);
  const target = baselineRestartPathV1("outboxes", pair.outboxHash!);
  const value = strictCanonicalRecord(readTask12ReceiptStoreBytesV1(target), "baseline restart outbox");
  const body = { ...value }; delete body.outboxRef; delete body.outboxHash;
  if (!hasExactKeys(value, ["schema", "service", "actionId", "authorizationRef", "authorizationHash", "operationRef", "operationHash", "maximumDispatchCount", "outboxRef", "outboxHash"]) || value.schema !== "setfarm.internal-production-baseline-service-restart-launch-outbox.v1" || value.maximumDispatchCount !== 1 || value.operationRef !== input.operationRef || value.operationHash !== input.operationHash || value.service !== operation.service || value.actionId !== operation.actionId || value.authorizationRef !== operation.authorizationRef || value.authorizationHash !== operation.authorizationHash || value.outboxRef !== pair.outboxRef || value.outboxHash !== pair.outboxHash || hashCanonicalJson(body) !== pair.outboxHash) currentEntryFail("baseline restart outbox is crossed");
  return recursivelyFreeze(value);
}

export async function prepareInternalProductionBaselineServiceRestartV1(
  input: Readonly<{ service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control" }>,
): Promise<Readonly<{ authorizationRef: string; authorizationHash: string }>> {
  if (!isPlainRecord(input) || !hasExactKeys(input, ["service"]) || !Object.hasOwn(BASELINE_RESTART_ACTIONS_V1, input.service)) currentEntryFail("baseline restart service input is invalid");
  const retirement = await import("./baseline-restart-authority-retirement-v1.js") as unknown as Record<string, unknown>;
  const acquire = retirement.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1;
  const release = retirement.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1;
  if (typeof acquire !== "function" || typeof release !== "function") currentEntryFail("baseline restart transition lease ports are unavailable");
  const lease = await (acquire as () => Promise<unknown>)();
  try {
    const migrationStatus = await observeInternalProductionPreManifestMigration32AuthorizationStatusV1();
    if (migrationStatus.state !== "terminal" || !isPlainRecord(migrationStatus.migrationReceipt)) currentEntryFail("baseline restart requires terminal migration-32 authority");
    const migration = await resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1(migrationStatus.migrationReceipt as InternalProductionBaselineBootstrapHandoffMigrationReceiptPairV1);
    const guardPair = await prepareInternalProductionBaselineZeroOwnerMutationGuardV1();
    const guard = await resolveInternalProductionBaselineZeroOwnerMutationGuardV1(guardPair);
    const runtime = task12RuntimeProjectionV1(await observeInternalProductionServiceCensusV1());
    publishLegacyZeroRecordV1(baselineRestartPathV1("runtime-projections", String(runtime.projectionHash)), await canonicalRecordBytes(runtime));
    resolveTask12PreparedRuntimeProjectionV1(runtime.projectionHash);
    const body = { schema: "setfarm.internal-production-baseline-service-restart-authorization.v1", service: input.service, migrationReceiptRef: migration.migrationReceiptRef, migrationReceiptHash: migration.migrationReceiptHash, zeroOwnerGuardRef: guardPair.zeroOwnerGuardRef, zeroOwnerGuardHash: guardPair.zeroOwnerGuardHash, completeZeroOwnerCensusHash: guard.completeZeroOwnerCensusObservationHash, preparedRuntimeSourceProjectionHash: runtime.projectionHash };
    const authorizationHash = hashCanonicalJson(body);
    const authorizationRef = `${BASELINE_RESTART_AUTHORIZATION_PREFIX_V1}${authorizationHash}`;
    const value = recursivelyFreeze({ ...body, authorizationRef, authorizationHash });
    publishLegacyZeroRecordV1(baselineRestartPathV1("authorizations", authorizationHash), await canonicalRecordBytes(value));
    await resolveInternalProductionBaselineServiceRestartAuthorizationV1({ authorizationRef, authorizationHash });
    return Object.freeze({ authorizationRef, authorizationHash });
  } finally {
    await (release as (value: unknown) => Promise<void>)(lease);
  }
}

export async function observeInternalProductionBaselineServiceRestartAuthorizationStatusV1(
  input: Readonly<{ authorizationRef: string; authorizationHash: string }>,
): Promise<Readonly<Record<string, unknown>>> {
  await resolveInternalProductionBaselineServiceRestartAuthorizationV1(input);
  let state: "prepared" | "consumed" = "prepared";
  let consumptionRef: string | null = null; let consumptionHash: string | null = null;
  try {
    const pair = strictCanonicalRecord(readTask12ReceiptStoreBytesV1(baselineRestartAuthorityLocatorV1(input.authorizationHash)), "baseline restart terminal locator");
    if (typeof pair.receiptRef !== "string" || typeof pair.receiptHash !== "string") currentEntryFail("baseline restart terminal locator is invalid");
    state = "consumed"; consumptionRef = pair.receiptRef; consumptionHash = pair.receiptHash;
  } catch (error) { if (!isEnoent(error)) throw error; }
  const body = { schema: "setfarm.internal-production-baseline-service-restart-authorization-status.v1", state, authorizationRef: input.authorizationRef, authorizationHash: input.authorizationHash, consumptionRef, consumptionHash };
  return recursivelyFreeze({ ...body, statusHash: hashCanonicalJson(body) });
}

export async function resolveInternalProductionBaselineServiceRestartAuthorityV1(
  input: Readonly<{ receiptRef: string; receiptHash: string }>,
): Promise<Readonly<Record<string, unknown>>> {
  const pair = requirePair(input, "receiptRef", "receiptHash", BASELINE_RESTART_RECEIPT_PREFIX_V1);
  const target = baselineRestartPathV1("authorities", pair.receiptHash!);
  const value = strictCanonicalRecord(readTask12ReceiptStoreBytesV1(target), "baseline restart authority");
  const body = { ...value }; delete body.receiptRef; delete body.receiptHash;
  if (value.schema !== "setfarm.internal-production-baseline-service-restart-authority.v1" || value.receiptRef !== pair.receiptRef || value.receiptHash !== pair.receiptHash || hashCanonicalJson(body) !== pair.receiptHash) currentEntryFail("baseline restart authority is crossed");
  return recursivelyFreeze(value);
}

export async function prepareInternalProductionBaselineSpawnerBootstrapServiceRestartAuthorizationV1(
  input: Readonly<{ bootstrapOperationRef: string; bootstrapOperationHash: string; targetGuardReceiptRef: string; targetGuardReceiptHash: string }>,
): Promise<Readonly<{ authorizationRef: string; authorizationHash: string }>> {
  const sequence = await import("./baseline-service-restart-sequence-v1.js") as unknown as Record<string, unknown>;
  const resolveOperation = sequence.resolveInternalProductionBaselineSpawnerBootstrapRestartOperationV1;
  const runtime = await import("../execution/runtime-completion.js") as unknown as Record<string, unknown>;
  const resolveGuardReceipt = runtime.resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardReceiptV1;
  const resolveConsumption = runtime.resolveInternalProductionBaselineCompletionOwnerBootstrapTargetGuardConsumptionV1;
  if (typeof resolveOperation !== "function" || typeof resolveGuardReceipt !== "function" || typeof resolveConsumption !== "function") currentEntryFail("fenced bootstrap restart authority ports are unavailable");
  const operation = await (resolveOperation as (value: unknown) => Promise<Record<string, unknown>>)({ operationRef: input.bootstrapOperationRef, operationHash: input.bootstrapOperationHash });
  if (operation.targetGuardReceiptRef !== input.targetGuardReceiptRef || operation.targetGuardReceiptHash !== input.targetGuardReceiptHash) currentEntryFail("fenced bootstrap operation/guard is crossed");
  const guard = await (resolveGuardReceipt as (value: unknown) => Promise<Record<string, unknown>>)({ targetGuardReceiptRef: input.targetGuardReceiptRef, targetGuardReceiptHash: input.targetGuardReceiptHash });
  const consumptionBody = { schema: "setfarm.internal-production-baseline-completion-owner-bootstrap-target-guard-consumption.v1", targetGuardReceiptRef: guard.targetGuardReceiptRef, targetGuardReceiptHash: guard.targetGuardReceiptHash, targetGuardHash: guard.targetGuardHash, operationRef: input.bootstrapOperationRef, operationHash: input.bootstrapOperationHash, requestIdHash: guard.requestIdHash, claimIdHash: guard.claimIdHash, runIdentityHash: guard.runIdentityHash, ownerGenerationHash: guard.ownerGenerationHash, targetGuardConsumed: true };
  const targetGuardConsumptionHash = hashCanonicalJson(consumptionBody);
  const targetGuardConsumptionRef = `setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-consumption/sha256/${targetGuardConsumptionHash}`;
  await (resolveConsumption as (value: unknown) => Promise<unknown>)({ consumptionRef: targetGuardConsumptionRef, consumptionHash: targetGuardConsumptionHash });
  const migrationStatus = await observeInternalProductionPreManifestMigration32AuthorizationStatusV1();
  if (migrationStatus.state !== "terminal" || !isPlainRecord(migrationStatus.migrationReceipt)) currentEntryFail("fenced bootstrap restart requires terminal migration authority");
  const preparedProjection = task12RuntimeProjectionV1(await observeInternalProductionServiceCensusV1());
  publishLegacyZeroRecordV1(baselineRestartPathV1("runtime-projections", String(preparedProjection.projectionHash)), await canonicalRecordBytes(preparedProjection));
  resolveTask12PreparedRuntimeProjectionV1(preparedProjection.projectionHash);
  const body = { schema: "setfarm.internal-production-baseline-spawner-bootstrap-service-restart-authorization.v1", service: "setfarm-spawner", migrationReceiptRef: migrationStatus.migrationReceipt.migrationReceiptRef, migrationReceiptHash: migrationStatus.migrationReceipt.migrationReceiptHash, bootstrapOperationRef: input.bootstrapOperationRef, bootstrapOperationHash: input.bootstrapOperationHash, targetGuardReceiptRef: input.targetGuardReceiptRef, targetGuardReceiptHash: input.targetGuardReceiptHash, targetGuardHash: guard.targetGuardHash, targetGuardConsumptionRef, targetGuardConsumptionHash, requestIdHash: guard.requestIdHash, claimIdHash: guard.claimIdHash, runIdentityHash: guard.runIdentityHash, ownerGenerationHash: guard.ownerGenerationHash, unrelatedOwnerCensusHash: guard.unrelatedOwnerCensusHash, preparedRuntimeSourceProjectionHash: preparedProjection.projectionHash };
  const authorizationHash = hashCanonicalJson(body); const authorizationRef = `${BASELINE_RESTART_AUTHORIZATION_PREFIX_V1}${authorizationHash}`;
  publishLegacyZeroRecordV1(baselineRestartPathV1("authorizations", authorizationHash), await canonicalRecordBytes({ ...body, authorizationRef, authorizationHash }));
  await resolveInternalProductionBaselineServiceRestartAuthorizationV1({ authorizationRef, authorizationHash });
  return Object.freeze({ authorizationRef, authorizationHash });
}

export async function restartInternalProductionBaselineServiceV1(
  input: Readonly<{ authorizationRef: string; authorizationHash: string }>,
): Promise<Readonly<{ receiptRef: string; receiptHash: string }>> {
  const authorization = await resolveInternalProductionBaselineServiceRestartAuthorizationV1(input);
  try {
    const existing = strictCanonicalRecord(readTask12ReceiptStoreBytesV1(baselineRestartAuthorityLocatorV1(input.authorizationHash)), "baseline restart authority locator");
    const pair = { receiptRef: String(existing.receiptRef), receiptHash: String(existing.receiptHash) };
    await resolveInternalProductionBaselineServiceRestartAuthorityV1(pair);
    return Object.freeze(pair);
  } catch (error) { if (!isEnoent(error)) throw error; }
  const service = authorization.service as keyof typeof BASELINE_RESTART_ACTIONS_V1;
  const actionId = BASELINE_RESTART_ACTIONS_V1[service];
  if (!actionId) currentEntryFail("baseline restart service/action is invalid");
  const retirement = await import("./baseline-restart-authority-retirement-v1.js") as unknown as Record<string, unknown>;
  const acquire = retirement.acquireInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1;
  const invoke = retirement.invokeInternalProductionBaselineServiceRestartHelperUnderTransitionLeaseV1;
  const release = retirement.releaseInternalProductionPhysicalServiceRestartAuthorityTransitionLeaseV1;
  if (typeof acquire !== "function" || typeof invoke !== "function" || typeof release !== "function") currentEntryFail("baseline restart helper lease ports are unavailable");
  const lease = await (acquire as () => Promise<unknown>)();
  try {
    const before = resolveTask12PreparedRuntimeProjectionV1(authorization.preparedRuntimeSourceProjectionHash);
    if (authorization.schema === "setfarm.internal-production-baseline-service-restart-authorization.v1") {
      const guard = await resolveInternalProductionBaselineZeroOwnerMutationGuardV1({ zeroOwnerGuardRef: String(authorization.zeroOwnerGuardRef), zeroOwnerGuardHash: String(authorization.zeroOwnerGuardHash) });
      const freshZero = await observeCompleteInternalProductionZeroOwnerCensusV1();
      if (freshZero.observationRef !== guard.completeZeroOwnerCensusObservationRef || freshZero.observationHash !== guard.completeZeroOwnerCensusObservationHash) currentEntryFail("baseline restart zero-owner guard is stale");
      const consumptionBody = { schema: "setfarm.internal-production-baseline-service-restart-zero-owner-guard-consumption.v1", purpose: "baseline-service-restart-v1", authorizationRef: input.authorizationRef, authorizationHash: input.authorizationHash, zeroOwnerGuardRef: authorization.zeroOwnerGuardRef, zeroOwnerGuardHash: authorization.zeroOwnerGuardHash, completeZeroOwnerCensusObservationRef: guard.completeZeroOwnerCensusObservationRef, completeZeroOwnerCensusObservationHash: guard.completeZeroOwnerCensusObservationHash, guardConsumed: true };
      const consumptionHash = hashCanonicalJson(consumptionBody); const consumptionRef = `setfarm://internal-production/baseline-service-restart-zero-owner-guard-consumption/sha256/${consumptionHash}`;
      const consumption = { ...consumptionBody, consumptionRef, consumptionHash };
      const target = fixedWorkspaceAuthorityPathV1(ZERO_OWNER_GUARD_ROOT_V1, "consumptions/baseline-service-restart/sha256", consumptionHash.slice(0, 2), `${consumptionHash}.json`);
      publishLegacyZeroRecordV1(target, await canonicalRecordBytes(consumption));
      publishLegacyZeroRecordV1(zeroOwnerConsumedIndexPathV1(String(authorization.zeroOwnerGuardHash)), await canonicalRecordBytes({ consumptionRef, consumptionHash }));
    }
    const operationBody = { schema: "setfarm.internal-production-baseline-service-restart-operation.v1", service, actionId, authorizationRef: input.authorizationRef, authorizationHash: input.authorizationHash };
    const operationHash = hashCanonicalJson(operationBody); const operationRef = `${BASELINE_RESTART_OPERATION_PREFIX_V1}${operationHash}`;
    const operation = recursivelyFreeze({ ...operationBody, operationRef, operationHash });
    publishLegacyZeroRecordV1(baselineRestartPathV1("operations", operationHash), await canonicalRecordBytes(operation));
    await resolveInternalProductionBaselineServiceRestartOperationV1({ operationRef, operationHash });
    const outboxBody = { schema: "setfarm.internal-production-baseline-service-restart-launch-outbox.v1", service, actionId, authorizationRef: input.authorizationRef, authorizationHash: input.authorizationHash, operationRef, operationHash, maximumDispatchCount: 1 };
    const outboxHash = hashCanonicalJson(outboxBody); const outboxRef = `${BASELINE_RESTART_OUTBOX_PREFIX_V1}${outboxHash}`;
    const outbox = recursivelyFreeze({ ...outboxBody, outboxRef, outboxHash });
    publishLegacyZeroRecordV1(baselineRestartPathV1("outboxes", outboxHash), await canonicalRecordBytes(outbox));
    publishLegacyZeroRecordV1(baselineRestartOutboxLocatorV1(operationHash), await canonicalRecordBytes({ operationRef, operationHash, outboxRef, outboxHash }));
    await observePreparedInternalProductionBaselineServiceRestartLaunchOutboxV1({ operationRef, operationHash });
    if (authorization.schema === "setfarm.internal-production-baseline-spawner-bootstrap-service-restart-authorization.v1") {
      const spawnerModule = await import("../spawner.js") as unknown as Record<string, unknown>;
      const prepareStartupAdmission = spawnerModule.prepareInternalProductionBaselineSpawnerStartupAdmissionV1;
      const resolveStartupAdmission = spawnerModule.resolveInternalProductionBaselineSpawnerStartupAdmissionV1;
      if (typeof prepareStartupAdmission !== "function" || prepareStartupAdmission.length !== 1 || typeof resolveStartupAdmission !== "function" || resolveStartupAdmission.length !== 1) currentEntryFail("baseline spawner startup-admission publisher is unavailable");
      const startupAdmissionPair = await (prepareStartupAdmission as (value: unknown) => Promise<Record<string, unknown>>)({ operationRef, operationHash });
      const startupAdmission = await (resolveStartupAdmission as (value: unknown) => Promise<Record<string, unknown>>)(startupAdmissionPair);
      if (startupAdmission.operationId !== operationHash || startupAdmission.bootstrapOperationRef !== authorization.bootstrapOperationRef || startupAdmission.bootstrapOperationHash !== authorization.bootstrapOperationHash || startupAdmission.restartLaunchOutboxHash !== outboxHash) currentEntryFail("baseline spawner startup admission is crossed");
    }
    const helper = await (invoke as (held: unknown, value: unknown) => Promise<Record<string, unknown>>)(lease, { restartOperation: { operationRef, operationHash } });
    requirePair(helper, "helperSettlementRef", "helperSettlementHash", "setfarm://internal-production/baseline-service-restart-helper-settlement/sha256/");
    const afterCensus = await observeInternalProductionServiceCensusV1();
    const after = task12RuntimeProjectionV1(afterCensus);
    const selectedAfter = afterCensus[service === "setfarm-spawner" ? "spawner" : service === "setfarm-dashboard" ? "dashboard" : "missionControl"];
    const selectedProjectionKey = service === "setfarm-spawner" ? "spawnerServiceIdentityHash" : service === "setfarm-dashboard" ? "dashboardServiceIdentityHash" : "missionControlServiceIdentityHash";
    const selectedBeforeProcessIdentityHash = String(before[selectedProjectionKey]);
    const selectedAfterProcessIdentityHash = selectedAfter.processIdentityHash;
    if (selectedBeforeProcessIdentityHash === selectedAfterProcessIdentityHash) currentEntryFail("baseline restart did not replace exactly the target physical process");
    for (const other of (["spawner", "dashboard", "missionControl"] as const).filter((name) => name !== (service === "setfarm-spawner" ? "spawner" : service === "setfarm-dashboard" ? "dashboard" : "missionControl"))) {
      const key = other === "spawner" ? "spawnerServiceIdentityHash" : other === "dashboard" ? "dashboardServiceIdentityHash" : "missionControlServiceIdentityHash";
      if (before[key] !== after[key]) currentEntryFail("baseline restart changed an unrelated service identity");
    }
    let guardKind: "complete-zero-owner" | "fenced-completion-owner-bootstrap";
    let guardFields: Record<string, unknown>;
    if (authorization.schema === "setfarm.internal-production-baseline-service-restart-authorization.v1") {
      const terminalZero = await observeCompleteInternalProductionZeroOwnerCensusV1();
      if (terminalZero.observationHash !== authorization.completeZeroOwnerCensusHash) currentEntryFail("baseline restart terminal complete-zero authority drifted");
      guardKind = "complete-zero-owner";
      guardFields = { zeroOwnerGuardRef: authorization.zeroOwnerGuardRef, zeroOwnerGuardHash: authorization.zeroOwnerGuardHash, cleanup: { guardConsumed: true, restartSettled: true, observedGlobalZero: true, completeZeroOwnerCensusHash: terminalZero.observationHash } };
    } else {
      const ownerDrainedHash = hashCanonicalJson({ schema: "setfarm.internal-production-baseline-completion-owner-drained-observation.v1", requestIdHash: authorization.requestIdHash, claimIdHash: authorization.claimIdHash, runIdentityHash: authorization.runIdentityHash, ownerGenerationHash: authorization.ownerGenerationHash, ownerDrained: true });
      const ownerFencedHash = hashCanonicalJson({ schema: "setfarm.internal-production-baseline-completion-owner-fenced-observation.v1", requestIdHash: authorization.requestIdHash, claimIdHash: authorization.claimIdHash, runIdentityHash: authorization.runIdentityHash, ownerGenerationHash: authorization.ownerGenerationHash, ownerFenced: true });
      guardKind = "fenced-completion-owner-bootstrap";
      guardFields = { targetGuardReceiptRef: authorization.targetGuardReceiptRef, targetGuardReceiptHash: authorization.targetGuardReceiptHash, requestIdHash: authorization.requestIdHash, claimIdHash: authorization.claimIdHash, runIdentityHash: authorization.runIdentityHash, ownerGenerationHash: authorization.ownerGenerationHash, ownerDrainedHash, ownerFencedHash, cleanup: { targetGuardConsumed: true, restartSettled: true, observedUnrelatedZero: true, unrelatedOwnerCensusHash: authorization.unrelatedOwnerCensusHash, retainedTargetOwnerHash: authorization.ownerGenerationHash } };
    }
    const restart = { disposition: "performed", reservationHash: hashCanonicalJson({ authorizationHash: input.authorizationHash, role: "restart-reservation" }), operationHash, outboxHash, helperClaimHash: hashCanonicalJson({ helperSettlementHash: helper.helperSettlementHash, role: "claim" }), helperProcessIdentityHash: hashCanonicalJson({ helperSettlementHash: helper.helperSettlementHash, role: "helper-process" }), startupMarkerHash: hashCanonicalJson({ helperSettlementHash: helper.helperSettlementHash, role: "startup-marker" }), completionSettlementHash: helper.helperSettlementHash, beforeGenerationHash: selectedBeforeProcessIdentityHash, afterGenerationHash: selectedAfterProcessIdentityHash, beforeServiceAuthorityHash: selectedBeforeProcessIdentityHash, afterServiceAuthorityHash: selectedAfterProcessIdentityHash, dispatchReceiptHash: hashCanonicalJson({ helperSettlementHash: helper.helperSettlementHash, role: "dispatch-receipt" }) };
    const body = { schema: "setfarm.internal-production-baseline-service-restart-authority.v1", service, actionId, operationId: operationHash, migrationReceiptRef: authorization.migrationReceiptRef, migrationReceiptHash: authorization.migrationReceiptHash, migrationSchemaProjectionHash: (await resolveInternalProductionBaselineBootstrapHandoffMigrationReceiptV1({ migrationReceiptRef: String(authorization.migrationReceiptRef), migrationReceiptHash: String(authorization.migrationReceiptHash) })).schemaProjectionHash, before, after, postRuntimeSourceProjectionHash: after.projectionHash, restart, guardKind, ...guardFields };
    const receiptHash = hashCanonicalJson(body); const receiptRef = `${BASELINE_RESTART_RECEIPT_PREFIX_V1}${receiptHash}`;
    const value = recursivelyFreeze({ ...body, receiptRef, receiptHash });
    publishLegacyZeroRecordV1(baselineRestartPathV1("authorities", receiptHash), await canonicalRecordBytes(value));
    const pair = { receiptRef, receiptHash };
    publishLegacyZeroRecordV1(baselineRestartAuthorityLocatorV1(input.authorizationHash), await canonicalRecordBytes(pair));
    await resolveInternalProductionBaselineServiceRestartAuthorityV1(pair);
    return Object.freeze(pair);
  } finally {
    await (release as (value: unknown) => Promise<void>)(lease);
  }
}
