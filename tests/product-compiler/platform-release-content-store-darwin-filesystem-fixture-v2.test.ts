import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  symlinkSync,
  truncateSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import type { Stats } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  buildPlatformReleaseContentStoreDarwinFilesystemFixtureV2,
  capturePlatformReleaseContentStoreDarwinFilesystemBinaryAtReadForTestV2,
  crashPlatformReleaseContentStoreDarwinFilesystemFixtureAtCheckpointForTestV2,
  inspectPlatformReleaseContentStoreDarwinFilesystemFixtureV2,
  inspectPlatformReleaseContentStoreDarwinFilesystemRetainedWorkspaceForTestV2,
  PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2,
  runPlatformReleaseContentStoreDarwinFilesystemFixtureAtCheckpointForTestV2,
  runPlatformReleaseContentStoreDarwinFilesystemFixtureV2,
  type PlatformReleaseContentStoreDarwinFilesystemExpectedDirectoryV2,
  type PlatformReleaseContentStoreDarwinFilesystemBuilderFaultScenarioForTestV2,
  type PlatformReleaseContentStoreDarwinFilesystemFixtureV2,
  type PlatformReleaseContentStoreDarwinFilesystemPhysicalEvidenceV2,
} from "../../src/product-compiler/platform-release-content-store-darwin-filesystem-fixture-v2.js";

let fixture: PlatformReleaseContentStoreDarwinFilesystemFixtureV2 | undefined;
const FIXTURE_SOURCE_V2 = path.resolve(
  import.meta.dirname,
  "../../src/product-compiler/platform-release-content-store-darwin-filesystem-fixture-v2.ts",
);
const REPOSITORY_ROOT_V2 = path.resolve(import.meta.dirname, "../..");
const FIXTURE_MODULE_URL_V2 = new URL(
  "../../src/product-compiler/platform-release-content-store-darwin-filesystem-fixture-v2.ts",
  import.meta.url,
).href;
const BUILDER_FAULT_SLEEP_DURATION_SECONDS_V2 = "83.141592";
const BUILDER_FAULT_PROCESS_MARKER_V2 =
  "setfarm-content-store-wrapper-builder-runner-fault-v2";
const BUILDER_FAULT_HARNESS_PROCESS_MARKER_V2 =
  "setfarm-content-store-wrapper-builder-outer-harness-v2";
const BUILDER_FAULT_HARNESS_STDOUT_MAX_BYTES_V2 = 64 * 1024;
const BUILDER_FAULT_HARNESS_STDERR_MAX_BYTES_V2 = 64 * 1024;
const BUILDER_FAULT_HARNESS_DEADLINE_MILLISECONDS_V2 = 7_000;
const BUILDER_FAULT_HARNESS_SETTLEMENT_MILLISECONDS_V2 = 3_000;
const BUILDER_FAULT_HARNESS_DEATH_ATTEMPTS_V2 = 300;
const BUILDER_FAULT_HARNESS_DEATH_INTERVAL_MILLISECONDS_V2 = 10;

type BuilderFaultSerializedErrorV2 = Readonly<{
  causeMessage: string | null;
  code: string | null;
  containmentProven: boolean | null;
  errors: readonly Readonly<{
    causeMessage: string | null;
    code: string | null;
    message: string;
    name: string;
  }>[];
  message: string;
  name: string;
  primaryCauseIsFirst: boolean;
}>;

type BuilderFaultSerializedObservationV2 = Readonly<{
  admissionScope: "test_fixture";
  dispositionFrozen: boolean;
  error: BuilderFaultSerializedErrorV2;
  observationFrozen: boolean;
  productionAuthority: false;
  retainedEvidence: Readonly<{
    binaryPresent: boolean;
    rootEntryKinds: readonly (
      | "published_binary"
      | "retained_stage"
      | "unexpected"
    )[];
    rootMode: number;
    stageEntryNames: readonly string[];
    stageMode: number | null;
  }>;
  retentionDisposition: Readonly<{
    schema:
      "setfarm.platform-release-content-store-filesystem-fixture-retention-disposition.v2";
    admissionScope: "test_fixture";
    productionAuthority: false;
    deletionAuthority: false;
    filesystemMutationPerformed: false;
    rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2";
  }>;
  scenario:
    PlatformReleaseContentStoreDarwinFilesystemBuilderFaultScenarioForTestV2;
}>;

type BuilderFaultHarnessResultV2 = Readonly<{
  containmentProven: boolean;
  failure?: Error;
  observation?: BuilderFaultSerializedObservationV2;
}>;

const BUILDER_FAULT_HARNESS_CHILD_SOURCE_V2 = `
const scenario = process.argv[1];
const serializeNestedError = (error) => ({
  causeMessage: error instanceof Error && error.cause instanceof Error
    ? error.cause.message
    : null,
  code: error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : null,
  message: error instanceof Error ? error.message : String(error),
  name: error instanceof Error ? error.name : typeof error,
});
try {
  const moduleUnderTest = await import(${JSON.stringify(FIXTURE_MODULE_URL_V2)});
  const observation =
    await moduleUnderTest.observePlatformReleaseContentStoreDarwinFilesystemBuilderFaultForTestV2(
      scenario,
    );
  const error = observation.error;
  const nestedErrors = error instanceof AggregateError
    ? error.errors.slice(0, 8).map(serializeNestedError)
    : [];
  const payload = {
    admissionScope: observation.admissionScope,
    dispositionFrozen: Object.isFrozen(observation.retentionDisposition),
    error: {
      causeMessage: error.cause instanceof Error ? error.cause.message : null,
      code: "code" in error && typeof error.code === "string" ? error.code : null,
      containmentProven: "containmentProven" in error
          && typeof error.containmentProven === "boolean"
        ? error.containmentProven
        : null,
      errors: nestedErrors,
      message: error.message,
      name: error.name,
      primaryCauseIsFirst: error instanceof AggregateError
        && error.cause === error.errors[0],
    },
    observationFrozen: Object.isFrozen(observation),
    productionAuthority: observation.productionAuthority,
    retainedEvidence: observation.retainedEvidence,
    retentionDisposition: observation.retentionDisposition,
    scenario: observation.scenario,
  };
  const frame = Buffer.from(JSON.stringify(payload) + "\\n", "utf8");
  if (frame.byteLength > ${BUILDER_FAULT_HARNESS_STDOUT_MAX_BYTES_V2}) {
    throw new Error("builder fault observation frame exceeded its bound");
  }
  await new Promise((resolve, reject) => {
    process.stdout.write(frame, (writeError) => {
      frame.fill(0);
      if (writeError) reject(writeError);
      else resolve();
    });
  });
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await new Promise((resolve) => {
    process.stderr.write("BUILDER_FAULT_HARNESS_CHILD_FAILED:" + message + "\\n", resolve);
  });
  process.exit(91);
}
`;

function builderFaultHarnessErrorV2(message: string, cause?: unknown): Error {
  return new Error(message, cause === undefined ? {} : { cause });
}

function processGroupAliveForBuilderFaultHarnessV2(processGroupId: number): boolean {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    return !(error instanceof Error && "code" in error && error.code === "ESRCH");
  }
}

async function waitForBuilderFaultHarnessProcessGroupDeathV2(
  processGroupId: number,
): Promise<boolean> {
  for (
    let attempt = 0;
    attempt < BUILDER_FAULT_HARNESS_DEATH_ATTEMPTS_V2;
    attempt += 1
  ) {
    if (!processGroupAliveForBuilderFaultHarnessV2(processGroupId)) return true;
    if (attempt + 1 < BUILDER_FAULT_HARNESS_DEATH_ATTEMPTS_V2) {
      await new Promise((resolve) => setTimeout(
        resolve,
        BUILDER_FAULT_HARNESS_DEATH_INTERVAL_MILLISECONDS_V2,
      ));
    }
  }
  return !processGroupAliveForBuilderFaultHarnessV2(processGroupId);
}

function exactPlainRecordKeysV2(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return false;
  }
  const observed = Object.keys(value).sort();
  const expected = [...keys].sort();
  return observed.length === expected.length
    && observed.every((key, index) => key === expected[index]);
}

function parseBuilderFaultHarnessObservationV2(
  stdout: Buffer,
  scenario: PlatformReleaseContentStoreDarwinFilesystemBuilderFaultScenarioForTestV2,
): BuilderFaultSerializedObservationV2 {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(stdout);
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n")) {
    throw builderFaultHarnessErrorV2(
      "Builder fault harness emitted a non-canonical observation frame",
    );
  }
  const parsed: unknown = JSON.parse(text.slice(0, -1));
  if (!exactPlainRecordKeysV2(parsed, [
    "admissionScope",
    "dispositionFrozen",
    "error",
    "observationFrozen",
    "productionAuthority",
    "retainedEvidence",
    "retentionDisposition",
    "scenario",
  ])) {
    throw builderFaultHarnessErrorV2(
      "Builder fault harness observation has an unexpected field set",
    );
  }
  if (
    parsed.admissionScope !== "test_fixture"
    || parsed.dispositionFrozen !== true
    || parsed.observationFrozen !== true
    || parsed.productionAuthority !== false
    || parsed.scenario !== scenario
    || !exactPlainRecordKeysV2(parsed.error, [
      "causeMessage",
      "code",
      "containmentProven",
      "errors",
      "message",
      "name",
      "primaryCauseIsFirst",
    ])
    || typeof parsed.error.message !== "string"
    || parsed.error.message.length > 1_500
    || typeof parsed.error.name !== "string"
    || parsed.error.name.length > 200
    || !(
      parsed.error.causeMessage === null
      || (
        typeof parsed.error.causeMessage === "string"
        && parsed.error.causeMessage.length <= 1_500
      )
    )
    || !(
      parsed.error.code === null
      || (
        typeof parsed.error.code === "string"
        && parsed.error.code.length <= 200
      )
    )
    || !(
      parsed.error.containmentProven === null
      || typeof parsed.error.containmentProven === "boolean"
    )
    || !Array.isArray(parsed.error.errors)
    || parsed.error.errors.length > 8
    || typeof parsed.error.primaryCauseIsFirst !== "boolean"
    || !exactPlainRecordKeysV2(parsed.retainedEvidence, [
      "binaryPresent",
      "rootEntryKinds",
      "rootMode",
      "stageEntryNames",
      "stageMode",
    ])
    || parsed.retainedEvidence.binaryPresent !== false
    || !Array.isArray(parsed.retainedEvidence.rootEntryKinds)
    || parsed.retainedEvidence.rootEntryKinds.length > 2
    || !parsed.retainedEvidence.rootEntryKinds.every((entry) =>
      entry === "published_binary"
      || entry === "retained_stage"
      || entry === "unexpected")
    || parsed.retainedEvidence.rootMode !== 0o700
    || !Array.isArray(parsed.retainedEvidence.stageEntryNames)
    || parsed.retainedEvidence.stageEntryNames.length > 4
    || !parsed.retainedEvidence.stageEntryNames.every((entry) =>
      typeof entry === "string" && entry.length <= 255)
    || (
      parsed.retainedEvidence.stageMode !== null
      && parsed.retainedEvidence.stageMode !== 0o700
    )
    || !exactPlainRecordKeysV2(parsed.retentionDisposition, [
      "admissionScope",
      "deletionAuthority",
      "filesystemMutationPerformed",
      "productionAuthority",
      "rootDisposition",
      "schema",
    ])
    || parsed.retentionDisposition.schema
      !== "setfarm.platform-release-content-store-filesystem-fixture-retention-disposition.v2"
    || parsed.retentionDisposition.admissionScope !== "test_fixture"
    || parsed.retentionDisposition.productionAuthority !== false
    || parsed.retentionDisposition.deletionAuthority !== false
    || parsed.retentionDisposition.filesystemMutationPerformed !== false
    || parsed.retentionDisposition.rootDisposition
      !== "retained_no_atomic_same_uid_conditional_delete_v2"
  ) {
    throw builderFaultHarnessErrorV2(
      "Builder fault harness observation is invalid",
    );
  }
  for (const nested of parsed.error.errors) {
    if (
      !exactPlainRecordKeysV2(nested, [
        "causeMessage",
        "code",
        "message",
        "name",
      ])
      || typeof nested.message !== "string"
      || nested.message.length > 1_500
      || typeof nested.name !== "string"
      || nested.name.length > 200
      || !(
        nested.causeMessage === null
        || (
          typeof nested.causeMessage === "string"
          && nested.causeMessage.length <= 1_500
        )
      )
      || !(
        nested.code === null
        || (typeof nested.code === "string" && nested.code.length <= 200)
      )
    ) {
      throw builderFaultHarnessErrorV2(
        "Builder fault harness nested error is invalid",
      );
    }
  }
  return parsed as BuilderFaultSerializedObservationV2;
}

async function runBuilderFaultScenarioInSubprocessV2(
  scenario:
    PlatformReleaseContentStoreDarwinFilesystemBuilderFaultScenarioForTestV2,
): Promise<BuilderFaultHarnessResultV2> {
  const child = spawn(process.execPath, [
    "--import",
    "tsx",
    "--input-type=module",
    "--eval",
    BUILDER_FAULT_HARNESS_CHILD_SOURCE_V2,
    scenario,
    BUILDER_FAULT_HARNESS_PROCESS_MARKER_V2,
  ], {
    cwd: REPOSITORY_ROOT_V2,
    detached: true,
    env: {
      HOME: "/var/empty",
      LANG: "C",
      LC_ALL: "C",
      PATH: "/usr/bin:/bin",
      SOURCE_DATE_EPOCH: "0",
      TMPDIR: os.tmpdir(),
      TZ: "UTC",
    },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const harnessProcessId =
    child.pid !== undefined
    && Number.isSafeInteger(child.pid)
    && child.pid > 1
      ? child.pid
      : undefined;
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  const containmentErrors: Error[] = [];
  let stdoutByteLength = 0;
  let stderrByteLength = 0;
  let outputLimitLatched = false;
  let firstFailure: Error | undefined;
  let terminationRequested = false;
  let settled = false;
  let settlementTimer: NodeJS.Timeout | undefined;
  let deadlineTimer: NodeJS.Timeout | undefined;
  let resolveSettlement!: (result: Readonly<{
    kind: "close" | "watchdog";
    status: number | null;
    signal: NodeJS.Signals | null;
  }>) => void;
  const settlement = new Promise<Readonly<{
    kind: "close" | "watchdog";
    status: number | null;
    signal: NodeJS.Signals | null;
  }>>((resolve) => {
    resolveSettlement = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    child.once("close", (status, signal) => {
      resolveSettlement({ kind: "close", status, signal });
    });
  });
  const recordContainmentError = (message: string, cause?: unknown): void => {
    containmentErrors.push(builderFaultHarnessErrorV2(message, cause));
  };
  const signalDirectHarness = (): void => {
    try {
      child.kill("SIGKILL");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
        recordContainmentError(
          "Builder fault harness direct SIGKILL failed",
          error,
        );
      }
    }
  };
  const signalHarnessProcessGroup = (): void => {
    if (harnessProcessId === undefined) {
      signalDirectHarness();
      return;
    }
    try {
      process.kill(-harnessProcessId, "SIGKILL");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
        recordContainmentError(
          "Builder fault harness process-group SIGKILL failed",
          error,
        );
      }
      signalDirectHarness();
    }
  };
  const requestTermination = (): void => {
    if (terminationRequested) return;
    terminationRequested = true;
    if (!settled) {
      settlementTimer = setTimeout(() => {
        recordContainmentError(
          "Builder fault harness did not settle after termination",
        );
        signalDirectHarness();
        resolveSettlement({ kind: "watchdog", status: null, signal: null });
      }, BUILDER_FAULT_HARNESS_SETTLEMENT_MILLISECONDS_V2);
    }
    signalHarnessProcessGroup();
  };
  const latchFailure = (error: Error): void => {
    if (firstFailure === undefined) firstFailure = error;
    else containmentErrors.push(error);
    requestTermination();
  };
  const captureOutput = (name: "stdout" | "stderr", chunk: Buffer): void => {
    const bytes = Buffer.from(chunk);
    if (outputLimitLatched || firstFailure !== undefined) {
      bytes.fill(0);
      return;
    }
    const current = name === "stdout" ? stdoutByteLength : stderrByteLength;
    const maximum = name === "stdout"
      ? BUILDER_FAULT_HARNESS_STDOUT_MAX_BYTES_V2
      : BUILDER_FAULT_HARNESS_STDERR_MAX_BYTES_V2;
    if (current + bytes.byteLength > maximum) {
      outputLimitLatched = true;
      bytes.fill(0);
      latchFailure(builderFaultHarnessErrorV2(
        `Builder fault harness exceeded bounded ${name}`,
      ));
      return;
    }
    if (name === "stdout") {
      stdoutChunks.push(bytes);
      stdoutByteLength += bytes.byteLength;
    } else {
      stderrChunks.push(bytes);
      stderrByteLength += bytes.byteLength;
    }
  };
  child.stdout.on("data", (chunk: Buffer) => captureOutput("stdout", chunk));
  child.stderr.on("data", (chunk: Buffer) => captureOutput("stderr", chunk));
  child.stdout.once("error", (error) => latchFailure(
    builderFaultHarnessErrorV2("Builder fault harness stdout failed", error),
  ));
  child.stderr.once("error", (error) => latchFailure(
    builderFaultHarnessErrorV2("Builder fault harness stderr failed", error),
  ));
  child.once("error", (error) => latchFailure(
    builderFaultHarnessErrorV2("Builder fault harness could not start", error),
  ));
  deadlineTimer = setTimeout(() => latchFailure(builderFaultHarnessErrorV2(
    `Builder fault harness exceeded ${BUILDER_FAULT_HARNESS_DEADLINE_MILLISECONDS_V2}ms`,
  )), BUILDER_FAULT_HARNESS_DEADLINE_MILLISECONDS_V2);

  const result = await settlement;
  if (deadlineTimer !== undefined) clearTimeout(deadlineTimer);
  if (settlementTimer !== undefined) clearTimeout(settlementTimer);
  const stderrText = Buffer.concat(stderrChunks, stderrByteLength)
    .toString("utf8").slice(0, 1_500);
  if (
    firstFailure === undefined
    && (
      result.kind !== "close"
      || result.status !== 0
      || result.signal !== null
      || stderrByteLength !== 0
    )
  ) {
    firstFailure = builderFaultHarnessErrorV2(
      `Builder fault harness failed status=${String(result.status)} signal=${String(result.signal)} stderr=${stderrText}`,
    );
  }
  if (
    harnessProcessId !== undefined
    && processGroupAliveForBuilderFaultHarnessV2(harnessProcessId)
  ) {
    firstFailure ??= builderFaultHarnessErrorV2(
      "Builder fault harness process group outlived its leader",
    );
    signalHarnessProcessGroup();
  }
  const harnessDeathProven = harnessProcessId === undefined
    ? false
    : await waitForBuilderFaultHarnessProcessGroupDeathV2(
      harnessProcessId,
    );
  if (!harnessDeathProven) {
    recordContainmentError(
      "Builder fault harness process-group death was not proven by ESRCH",
    );
  }
  let observation: BuilderFaultSerializedObservationV2 | undefined;
  if (
    firstFailure === undefined
    && containmentErrors.length === 0
  ) {
    try {
      observation = parseBuilderFaultHarnessObservationV2(
        Buffer.concat(stdoutChunks, stdoutByteLength),
        scenario,
      );
    } catch (error) {
      firstFailure = builderFaultHarnessErrorV2(
        "Builder fault harness observation could not be parsed exactly",
        error,
      );
    }
  }
  for (const chunk of stdoutChunks) chunk.fill(0);
  for (const chunk of stderrChunks) chunk.fill(0);
  const errors = firstFailure === undefined
    ? containmentErrors
    : [firstFailure, ...containmentErrors];
  const failure = errors.length === 0
    ? undefined
    : errors.length === 1
      ? errors[0]
      : new AggregateError(
        errors,
        `Builder fault harness and containment failed: ${errors[0]!.message}`,
        { cause: errors[0] },
      );
  return Object.freeze({
    containmentProven: harnessDeathProven && failure === undefined,
    ...(failure === undefined ? {} : { failure }),
    ...(observation === undefined ? {} : { observation }),
  });
}

function sha256V2(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function expectedDirectoryV2(
  directory: string,
): PlatformReleaseContentStoreDarwinFilesystemExpectedDirectoryV2 {
  const status = lstatSync(directory, { bigint: true });
  assert.equal(status.isSymbolicLink(), false);
  assert.equal(status.isDirectory(), true);
  return Object.freeze({
    device: status.dev.toString(),
    inode: status.ino.toString(),
    ownerUid: status.uid.toString(),
    ownerGid: status.gid.toString(),
    mode: Number(status.mode & 0o7777n),
  });
}

function assertDirectoryEvidenceV2(
  evidence: PlatformReleaseContentStoreDarwinFilesystemPhysicalEvidenceV2,
  expected: PlatformReleaseContentStoreDarwinFilesystemExpectedDirectoryV2,
): void {
  assert.equal(evidence.device, expected.device);
  assert.equal(evidence.inode, expected.inode);
  assert.equal(evidence.ownerUid, expected.ownerUid);
  assert.equal(evidence.ownerGid, expected.ownerGid);
  assert.equal(evidence.mode, expected.mode);
}

function cleanupOwnedStoreV2(alias: string, releases: string): void {
  if (existsSync(releases)) {
    for (const entry of readdirSync(releases)) {
      const releaseRoot = path.join(releases, entry);
      if (existsSync(releaseRoot)) chmodSync(releaseRoot, 0o700);
    }
  }
  rmSync(alias, { recursive: true, force: true });
}

function darwinProcessStateV2(processId: number): string {
  const observed = spawnSync(
    "/bin/ps",
    ["-o", "state=", "-p", String(processId)],
    {
      encoding: "buffer",
      env: {
        LANG: "C",
        LC_ALL: "C",
        PATH: "/usr/bin:/bin",
        TZ: "UTC",
      },
      maxBuffer: 1_024,
      shell: false,
    },
  );
  assert.equal(observed.status, 0);
  assert.equal(observed.signal, null);
  assert.equal(observed.error, undefined);
  assert.deepEqual(observed.stderr, Buffer.alloc(0));
  assert.equal(observed.stdout.byteLength, 5);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(observed.stdout);
  assert.match(text, /^[A-Z][A-Za-z+< ]{3}\n$/u);
  const state = text.slice(0, -1).trimEnd();
  assert.doesNotMatch(state, / /u);
  return state;
}

async function assertCheckpointDisplacementV2(
  nativeFixture: PlatformReleaseContentStoreDarwinFilesystemFixtureV2,
  checkpoint: 9 | 11,
  displacedChild: "attestations" | ".staging",
): Promise<void> {
  const storeAlias = mkdtempSync(
    path.join(os.tmpdir(), `setfarm-content-store-checkpoint-${checkpoint}-v2-`),
  );
  const storeRoot = realpathSync(storeAlias);
  const locks = path.join(storeRoot, ".locks");
  const staging = path.join(storeRoot, ".staging");
  const releases = path.join(storeRoot, "releases");
  const attestations = path.join(storeRoot, "attestations");
  const selected = displacedChild === "attestations" ? attestations : staging;
  const displaced = path.join(
    storeRoot,
    displacedChild === "attestations"
      ? ".attestations-displaced-v2"
      : ".staging-displaced-v2",
  );
  const sentinelAlias = mkdtempSync(
    path.join(os.tmpdir(), `setfarm-content-store-sentinel-${checkpoint}-v2-`),
  );
  const sentinelRoot = realpathSync(sentinelAlias);
  let rootDescriptor = -1;
  let sentinelDescriptor = -1;
  try {
    chmodSync(storeRoot, 0o700);
    chmodSync(sentinelRoot, 0o700);
    for (const child of [locks, staging, releases, attestations]) {
      mkdirSync(child, { mode: 0o700 });
      chmodSync(child, 0o700);
    }
    assert.deepEqual(readdirSync(sentinelRoot), []);
    sentinelDescriptor = openSync(
      sentinelRoot,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const sentinelBefore = fstatSync(sentinelDescriptor, { bigint: true });
    rootDescriptor = openSync(
      storeRoot,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const expected = Object.freeze({
      root: expectedDirectoryV2(storeRoot),
      locks: expectedDirectoryV2(locks),
      staging: expectedDirectoryV2(staging),
      releases: expectedDirectoryV2(releases),
      attestations: expectedDirectoryV2(attestations),
    });
    const manifestBytes = Buffer.from(
      `{"checkpoint":${checkpoint},"schema":"setfarm.test-content-store-manifest.v2"}`,
      "utf8",
    );
    const manifestPayloadHash = sha256V2(manifestBytes);
    const attestationBytes = Buffer.from(
      `{"checkpoint":${checkpoint},"manifestPayloadHash":"${manifestPayloadHash}","schema":"setfarm.test-content-store-attestation.v2"}`,
      "utf8",
    );
    const attestationHash = sha256V2(attestationBytes);
    const result = await runPlatformReleaseContentStoreDarwinFilesystemFixtureAtCheckpointForTestV2(
      nativeFixture,
      Object.freeze({
        rootDescriptor,
        ...expected,
        manifestPayloadHash,
        attestationHash,
        manifestBytes,
        attestationBytes,
        checkpoint,
      }),
      (observation) => {
        assert.equal(observation.processState.startsWith("T"), true);
        assert.equal(
          darwinProcessStateV2(observation.processId).startsWith("T"),
          true,
        );
        renameSync(selected, displaced);
        symlinkSync(sentinelRoot, selected, "dir");
      },
    );

    assert.equal(result.status, "error");
    assert.equal(result.error.lastCheckpoint, 13);
    if (checkpoint === 9) {
      assert.equal(result.error.primaryCode, 12);
      assert.equal(result.error.primaryCodeName, "revalidation_failed");
      assert.equal(result.error.cleanupCode, 0);
      assert.equal(result.error.terminalCode, 12);
      assert.equal(result.error.terminalCodeName, "revalidation_failed");
    } else {
      assert.equal(result.error.primaryCode, 0);
      assert.equal(result.error.primaryCodeName, "ok");
      assert.equal(result.error.cleanupCode, 6);
      assert.equal(result.error.cleanupCodeName, "parent_changed");
      assert.equal(result.error.terminalCode, 14);
      assert.equal(result.error.terminalCodeName, "cleanup_failed");
    }
    assert.equal(lstatSync(selected).isSymbolicLink(), true);
    assert.equal(readlinkSync(selected), sentinelRoot);
    assert.deepEqual(readdirSync(sentinelRoot), []);
    const sentinelAfter = fstatSync(sentinelDescriptor, { bigint: true });
    assert.deepEqual(sentinelAfter, sentinelBefore);
    assert.equal(lstatSync(displaced).isDirectory(), true);
    assert.equal(lstatSync(displaced).mode & 0o7777, 0o700);
    assert.deepEqual(readdirSync(locks), []);

    const releaseRoot = path.join(releases, manifestPayloadHash);
    assert.deepEqual(readdirSync(releases), [manifestPayloadHash]);
    assert.deepEqual(readdirSync(releaseRoot), ["manifest.json"]);
    assert.deepEqual(
      readFileSync(path.join(releaseRoot, "manifest.json")),
      manifestBytes,
    );
    if (checkpoint === 9) {
      const displacedAttestation = path.join(displaced, `${attestationHash}.json`);
      assert.deepEqual(readdirSync(displaced), [`${attestationHash}.json`]);
      assert.deepEqual(readFileSync(displacedAttestation), attestationBytes);
      assert.equal(lstatSync(displacedAttestation).mode & 0o7777, 0o444);
      assert.deepEqual(readdirSync(staging), []);
      assert.deepEqual(readdirSync(attestations), []);
      assert.deepEqual(readdirSync(storeRoot).sort(), [
        ".attestations-displaced-v2",
        ".locks",
        ".staging",
        "attestations",
        "releases",
      ]);
    } else {
      const stageName = `publish-${manifestPayloadHash}-${attestationHash}`;
      const displacedStage = path.join(displaced, stageName);
      const displacedRelease = path.join(displacedStage, "release");
      assert.deepEqual(readdirSync(displaced), [stageName]);
      assert.deepEqual(readdirSync(displacedStage), ["release"]);
      assert.deepEqual(readdirSync(displacedRelease), []);
      assert.equal(lstatSync(displacedStage).mode & 0o7777, 0o700);
      assert.equal(lstatSync(displacedRelease).mode & 0o7777, 0o700);
      assert.deepEqual(readdirSync(attestations), [`${attestationHash}.json`]);
      assert.deepEqual(
        readFileSync(path.join(attestations, `${attestationHash}.json`)),
        attestationBytes,
      );
      assert.deepEqual(readdirSync(staging), []);
      assert.deepEqual(readdirSync(storeRoot).sort(), [
        ".locks",
        ".staging",
        ".staging-displaced-v2",
        "attestations",
        "releases",
      ]);
    }
  } finally {
    if (rootDescriptor >= 0) closeSync(rootDescriptor);
    if (sentinelDescriptor >= 0) closeSync(sentinelDescriptor);
    if (existsSync(selected) && lstatSync(selected).isSymbolicLink()) {
      unlinkSync(selected);
    }
    cleanupOwnedStoreV2(storeAlias, releases);
    if (existsSync(sentinelAlias)) rmdirSync(sentinelAlias);
  }
}

function assertExactFixtureFileV2(
  filePath: string,
  bytes: Buffer,
  mode: number,
  linkCount: number,
): Stats {
  const status = lstatSync(filePath);
  assert.equal(status.isSymbolicLink(), false);
  assert.equal(status.isFile(), true);
  assert.equal(status.mode & 0o7777, mode);
  assert.equal(status.nlink, linkCount);
  assert.equal(status.size, bytes.byteLength);
  assert.deepEqual(readFileSync(filePath), bytes);
  return status;
}

function assertRawRecoveryAuthorityV2(
  result: ReturnType<typeof runPlatformReleaseContentStoreDarwinFilesystemFixtureV2>,
): void {
  assert.equal(result.productionAuthority, false);
  assert.equal(result.result.authenticatedLeaseLedgerPresent, false);
  assert.equal(result.result.unauthenticatedStaleLeaseRecoveryEnabled, true);
  assert.equal(
    result.result.staleLeaseRecoveryPolicy,
    "unauthenticated_fixture_exact_inode_and_f_tlock_only_v2",
  );
  assert.equal(
    result.result.unlinkAuthorityPolicy,
    "preserve_unless_exact_identity_revalidated_no_same_uid_atomic_unlink_v2",
  );
}

async function assertCrashReplayV2(
  nativeFixture: PlatformReleaseContentStoreDarwinFilesystemFixtureV2,
  checkpoint: 2 | 4 | 8 | 10 | 12,
): Promise<void> {
  const storeAlias = mkdtempSync(
    path.join(os.tmpdir(), `setfarm-content-store-crash-${checkpoint}-v2-`),
  );
  const storeRoot = realpathSync(storeAlias);
  const locks = path.join(storeRoot, ".locks");
  const staging = path.join(storeRoot, ".staging");
  const releases = path.join(storeRoot, "releases");
  const attestations = path.join(storeRoot, "attestations");
  const sentinelAlias = [4, 8, 10].includes(checkpoint)
    ? mkdtempSync(
      path.join(os.tmpdir(), `setfarm-content-store-crash-sentinel-${checkpoint}-v2-`),
    )
    : "";
  const sentinelRoot = sentinelAlias === "" ? "" : realpathSync(sentinelAlias);
  let rootDescriptor = -1;
  let sentinelDescriptor = -1;
  try {
    chmodSync(storeRoot, 0o700);
    for (const child of [locks, staging, releases, attestations]) {
      mkdirSync(child, { mode: 0o700 });
      chmodSync(child, 0o700);
    }
    let sentinelBefore: ReturnType<typeof fstatSync> | undefined;
    if (sentinelRoot !== "") {
      chmodSync(sentinelRoot, 0o700);
      assert.deepEqual(readdirSync(sentinelRoot), []);
      sentinelDescriptor = openSync(
        sentinelRoot,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      sentinelBefore = fstatSync(sentinelDescriptor, { bigint: true });
    }
    rootDescriptor = openSync(
      storeRoot,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const descriptorBefore = fstatSync(rootDescriptor, { bigint: true });
    const manifestBytes = Buffer.from(
      `crash-manifest-checkpoint-${checkpoint}`,
      "utf8",
    );
    const attestationBytes = Buffer.from(
      `crash-attestation-checkpoint-${checkpoint}`,
      "utf8",
    );
    const manifestPayloadHash = sha256V2(manifestBytes);
    const attestationHash = sha256V2(attestationBytes);
    const expected = Object.freeze({
      root: expectedDirectoryV2(storeRoot),
      locks: expectedDirectoryV2(locks),
      staging: expectedDirectoryV2(staging),
      releases: expectedDirectoryV2(releases),
      attestations: expectedDirectoryV2(attestations),
    });
    const checkpointInput = Object.freeze({
      rootDescriptor,
      ...expected,
      manifestPayloadHash,
      attestationHash,
      manifestBytes,
      attestationBytes,
      checkpoint,
    });
    const crash = await crashPlatformReleaseContentStoreDarwinFilesystemFixtureAtCheckpointForTestV2(
      nativeFixture,
      checkpointInput,
    );
    assert.deepEqual(crash, {
      activeRunReleased: true,
      admissionScope: "test_fixture",
      binaryFencePreserved: true,
      callerDescriptorPreserved: true,
      checkpoint,
      exitCode: null,
      productionAuthority: false,
      schema:
        "setfarm.platform-release-content-store-filesystem-fixture-checkpoint-crash.v2",
      signal: "SIGKILL",
      stderrByteLength: 0,
      stdoutByteLength: 0,
    });
    assert.equal(Object.isFrozen(crash), true);
    const descriptorAfterCrash = fstatSync(rootDescriptor, { bigint: true });
    assert.equal(descriptorAfterCrash.dev, descriptorBefore.dev);
    assert.equal(descriptorAfterCrash.ino, descriptorBefore.ino);

    const contentLeaseName = `content-${manifestPayloadHash}.lock`;
    const attestationLeaseName = `attestation-${attestationHash}.lock`;
    const expectedLeases = checkpoint === 2
      ? [contentLeaseName]
      : [attestationLeaseName, contentLeaseName].sort();
    assert.deepEqual(readdirSync(locks).sort(), expectedLeases);
    for (const leaseName of expectedLeases) {
      const lease = lstatSync(path.join(locks, leaseName), { bigint: true });
      assert.equal(lease.isFile(), true);
      assert.equal(lease.isSymbolicLink(), false);
      assert.equal(lease.mode & 0o7777n, 0o600n);
      assert.equal(lease.nlink, 1n);
      assert.equal(lease.size, 0n);
      assert.equal(lease.uid.toString(), expected.root.ownerUid);
      assert.equal(lease.gid.toString(), expected.root.ownerGid);
    }

    const stageName = `publish-${manifestPayloadHash}-${attestationHash}`;
    const stageRoot = path.join(staging, stageName);
    const stageRelease = path.join(stageRoot, "release");
    const stageManifest = path.join(stageRelease, "manifest.json");
    const stageAttestation = path.join(stageRoot, "attestation.json");
    const releaseRoot = path.join(releases, manifestPayloadHash);
    const manifest = path.join(releaseRoot, "manifest.json");
    const attestation = path.join(attestations, `${attestationHash}.json`);

    const foreignSentinelLink = sentinelRoot === ""
      ? ""
      : path.join(stageRoot, "foreign-sentinel-link");
    const assertCrashResidue = (withForeignSentinel = false): void => {
      if (checkpoint === 2) {
        assert.deepEqual(readdirSync(staging), []);
        assert.deepEqual(readdirSync(releases), []);
        assert.deepEqual(readdirSync(attestations), []);
        return;
      }
      if (checkpoint === 12) {
        assert.deepEqual(readdirSync(staging), []);
        assert.deepEqual(readdirSync(releases), [manifestPayloadHash]);
        assert.deepEqual(readdirSync(releaseRoot), ["manifest.json"]);
        assertExactFixtureFileV2(manifest, manifestBytes, 0o444, 1);
        assert.deepEqual(readdirSync(attestations), [`${attestationHash}.json`]);
        assertExactFixtureFileV2(attestation, attestationBytes, 0o444, 1);
        assert.equal(lstatSync(releaseRoot).mode & 0o7777, 0o555);
        return;
      }
      assert.deepEqual(readdirSync(staging), [stageName]);
      assert.equal(lstatSync(stageRoot).mode & 0o7777, 0o700);
      assert.equal(lstatSync(stageRelease).mode & 0o7777, 0o700);
      const expectedStageEntries = withForeignSentinel
        ? ["attestation.json", "foreign-sentinel-link", "release"]
        : ["attestation.json", "release"];
      if (withForeignSentinel) {
        assert.equal(lstatSync(foreignSentinelLink).isSymbolicLink(), true);
        assert.equal(readlinkSync(foreignSentinelLink), sentinelRoot);
      }
      if (checkpoint === 4) {
        assert.deepEqual(readdirSync(stageRoot).sort(), expectedStageEntries);
        assert.deepEqual(readdirSync(stageRelease), ["manifest.json"]);
        assertExactFixtureFileV2(stageManifest, manifestBytes, 0o444, 1);
        assertExactFixtureFileV2(stageAttestation, attestationBytes, 0o444, 1);
        assert.deepEqual(readdirSync(releases), []);
        assert.deepEqual(readdirSync(attestations), []);
      } else if (checkpoint === 8) {
        assert.deepEqual(readdirSync(stageRoot).sort(), expectedStageEntries);
        assert.deepEqual(readdirSync(stageRelease), ["manifest.json"]);
        const staged = assertExactFixtureFileV2(
          stageManifest,
          manifestBytes,
          0o444,
          2,
        );
        const published = assertExactFixtureFileV2(
          manifest,
          manifestBytes,
          0o444,
          2,
        );
        assert.equal(staged.dev, published.dev);
        assert.equal(staged.ino, published.ino);
        assertExactFixtureFileV2(stageAttestation, attestationBytes, 0o444, 1);
        assert.equal(lstatSync(releaseRoot).mode & 0o7777, 0o700);
        assert.deepEqual(readdirSync(attestations), []);
      } else {
        assert.deepEqual(readdirSync(stageRoot).sort(), expectedStageEntries);
        assert.deepEqual(readdirSync(stageRelease), []);
        const staged = assertExactFixtureFileV2(
          stageAttestation,
          attestationBytes,
          0o444,
          2,
        );
        const published = assertExactFixtureFileV2(
          attestation,
          attestationBytes,
          0o444,
          2,
        );
        assert.equal(staged.dev, published.dev);
        assert.equal(staged.ino, published.ino);
        assertExactFixtureFileV2(manifest, manifestBytes, 0o444, 1);
        assert.equal(lstatSync(releaseRoot).mode & 0o7777, 0o555);
      }
    };
    assertCrashResidue();
    if (foreignSentinelLink !== "") {
      symlinkSync(sentinelRoot, foreignSentinelLink, "dir");
    }

    const replay = runPlatformReleaseContentStoreDarwinFilesystemFixtureV2(
      nativeFixture,
      Object.freeze({ ...checkpointInput, checkpoint: 0 as const }),
    );
    assertRawRecoveryAuthorityV2(replay);
    assert.deepEqual(readdirSync(locks), []);
    if (checkpoint === 2) {
      assert.equal(replay.status, "ok");
      assert.equal(replay.result.contentLeaseRecovered, true);
      assert.equal(replay.result.attestationLeaseRecovered, false);
      assert.equal(replay.result.releaseDisposition, "published");
      assert.equal(replay.result.attestationDisposition, "published");
    } else if (checkpoint === 12) {
      assert.equal(replay.status, "ok");
      assert.equal(replay.result.contentLeaseRecovered, true);
      assert.equal(replay.result.attestationLeaseRecovered, true);
      assert.equal(replay.result.releaseDisposition, "adopted_identical");
      assert.equal(replay.result.attestationDisposition, "adopted_identical");
    } else {
      assert.equal(replay.status, "error");
      assert.equal(replay.error.primaryCode, 6);
      assert.equal(replay.error.primaryCodeName, "state_conflict");
      assert.equal(replay.error.terminalCode, 6);
      assert.equal(replay.result.contentLeaseRecovered, true);
      assert.equal(replay.result.attestationLeaseRecovered, true);
    }
    if (checkpoint === 2 || checkpoint === 12) {
      assert.deepEqual(readdirSync(staging), []);
      assert.deepEqual(readdirSync(releases), [manifestPayloadHash]);
      assert.deepEqual(readdirSync(releaseRoot), ["manifest.json"]);
      assertExactFixtureFileV2(manifest, manifestBytes, 0o444, 1);
      assert.equal(lstatSync(releaseRoot).mode & 0o7777, 0o555);
      assert.deepEqual(readdirSync(attestations), [`${attestationHash}.json`]);
      assertExactFixtureFileV2(attestation, attestationBytes, 0o444, 1);
    } else {
      assertCrashResidue(foreignSentinelLink !== "");
    }
    if (sentinelRoot !== "" && sentinelBefore !== undefined) {
      assert.deepEqual(readdirSync(sentinelRoot), []);
      assert.deepEqual(
        fstatSync(sentinelDescriptor, { bigint: true }),
        sentinelBefore,
      );
    }
  } finally {
    if (rootDescriptor >= 0) closeSync(rootDescriptor);
    if (sentinelDescriptor >= 0) closeSync(sentinelDescriptor);
    cleanupOwnedStoreV2(storeAlias, releases);
    if (sentinelAlias !== "" && existsSync(sentinelAlias)) {
      rmdirSync(sentinelAlias);
    }
  }
}

before(async () => {
  if (process.platform === "darwin") {
    fixture = await buildPlatformReleaseContentStoreDarwinFilesystemFixtureV2();
  }
});

after(() => {
  if (fixture !== undefined) {
    assert.deepEqual(fixture.dispose(), {
      schema:
        "setfarm.platform-release-content-store-filesystem-fixture-retention-disposition.v2",
      admissionScope: "test_fixture",
      productionAuthority: false,
      deletionAuthority: false,
      filesystemMutationPerformed: false,
      rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2",
    });
  }
  fixture = undefined;
});

describe("Darwin content-store filesystem fixture v2 runner", () => {
  it("contains the builder process and retains false-authority workspace evidence", () => {
    const source = readFileSync(FIXTURE_SOURCE_V2, "utf8");
    const capture = source.slice(
      source.indexOf("function captureBinaryV2"),
      source.indexOf("export function capturePlatformReleaseContentStore"),
    );
    const captureOrder = [
      "constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK",
      "const descriptorBefore = fstatSync(descriptor, { bigint: true })",
      "const byteLength = Number(descriptorBefore.size)",
      "bytes = Buffer.allocUnsafeSlow(byteLength)",
      "const count = readSync(",
      "const eof = Buffer.alloc(1)",
      "const descriptorAfter = fstatSync(descriptor, { bigint: true })",
      "const pathAfter = lstatSync(binary, { bigint: true })",
      "closeSync(descriptor)",
    ];
    let captureCursor = -1;
    for (const needle of captureOrder) {
      const next = capture.indexOf(needle, captureCursor + 1);
      assert.ok(next > captureCursor, `missing ordered binary capture contract: ${needle}`);
      captureCursor = next;
    }
    assert.match(capture, /new AggregateError\(\s*\[primary, closeFailure\]/u);

    const receipt = source.slice(
      source.indexOf("function parseBuildReceiptV2"),
      source.indexOf("function assertPinnedFileCurrentV2"),
    );
    for (const contract of [
      /"publicationPolicy"/u,
      /"stageWorkspacePolicy"/u,
      /"trustConclusion"/u,
      /"stableIdentity"/u,
      /stableIdentity\.device/u,
      /stableIdentity\.inode/u,
      /stableIdentity\.objectKind/u,
    ]) {
      assert.match(receipt, contract);
    }

    const runner = source.slice(
      source.indexOf("async function runContainedBuilderV2"),
      source.indexOf("async function buildFixtureV2"),
    );
    for (const contract of [
      /child\.stdout\.once\("error"/u,
      /child\.stderr\.once\("error"/u,
      /detached: testFault === undefined/u,
      /process\.kill\(-child\.pid, "SIGKILL"\)/u,
      /child\.kill\("SIGKILL"\)/u,
      /outputLimitLatched/u,
      /PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2/u,
      /signalDirectChild\(true\)/u,
      /waitForProcessGroupDeathV2\(child\.pid\)/u,
    ]) {
      assert.match(runner, contract);
    }
    assert.match(
      runner,
      /if \(testFault !== undefined\) \{[\s\S]*signalDirectChild\(\);[\s\S]*return;[\s\S]*process\.kill\(-child\.pid, "SIGKILL"\)/u,
    );
    assert.match(
      runner,
      /if \(\s*testFault === undefined\s*&& child\.pid !== undefined[\s\S]{0,200}processGroupAliveV2\(child\.pid\)/u,
    );
    assert.match(
      runner,
      /else if \(\s*testFault === undefined\s*&& child\.pid !== undefined[\s\S]{0,200}waitForProcessGroupDeathV2\(child\.pid\)/u,
    );
    assert.doesNotMatch(runner, /spawnSync\(/u);

    const build = source.slice(
      source.indexOf("async function buildFixtureV2"),
      source.indexOf("export async function buildPlatformReleaseContentStore"),
    );
    assert.match(build, /await runContainedBuilderV2\(buildRoot, binary\)/u);
    assert.match(build, /inner detached clang\/xcrun/u);
    assert.doesNotMatch(build, /cleanup|unlinkSync|rmdirSync|rmSync/u);

    const disposal = source.slice(
      source.indexOf("function disposeFixtureV2"),
      source.indexOf("type ContainedBuildResultV2"),
    );
    assert.match(disposal, /filesystemMutationPerformed: false/u);
    assert.match(disposal, /deletionAuthority: false/u);
    assert.doesNotMatch(disposal, /unlinkSync|rmdirSync|rmSync/u);

    const faultObservationType = source.slice(
      source.indexOf(
        "export type PlatformReleaseContentStoreDarwinFilesystemBuilderFaultObservationForTestV2",
      ),
      source.indexOf(
        "export type PlatformReleaseContentStoreDarwinFilesystemFixtureInputV2",
      ),
    );
    assert.doesNotMatch(faultObservationType, /alias: string|root: string/u);
    const faultEvidenceCapture = source.slice(
      source.indexOf("function captureBuilderFaultRetainedEvidenceForTestV2"),
      source.indexOf(
        "export async function observePlatformReleaseContentStoreDarwinFilesystemBuilderFaultForTestV2",
      ),
    );
    for (const contract of [
      /exactBoundedDirectoryNamesV2\(\s*buildRoot\.root,\s*2,/u,
      /RETAINED_STAGE_ENTRY_NAMES_V2\.length/u,
      /assertDirectoryCurrentV2/u,
      /assertRootCurrentV2/u,
      /rootEntryKinds: Object\.freeze/u,
      /stageEntryNames = Object\.freeze/u,
    ]) {
      assert.match(faultEvidenceCapture, contract);
    }
    const faultObservation = source.slice(
      source.indexOf(
        "export async function observePlatformReleaseContentStoreDarwinFilesystemBuilderFaultForTestV2",
      ),
      source.indexOf("async function buildFixtureV2"),
    );
    const pathlessReceipt = faultObservation.slice(
      faultObservation.lastIndexOf("return Object.freeze({"),
    );
    assert.match(pathlessReceipt, /retainedEvidence,/u);
    assert.doesNotMatch(pathlessReceipt, /\balias:|\broot:/u);

    const harnessTestSource = readFileSync(import.meta.filename, "utf8");
    const outerHarness = harnessTestSource.slice(
      harnessTestSource.indexOf(
        "async function runBuilderFaultScenarioInSubprocessV2(",
      ),
      harnessTestSource.indexOf("function sha256V2("),
    );
    for (const contract of [
      /detached: true/u,
      /stdio: \["ignore", "pipe", "pipe"\]/u,
      /process\.kill\(-harnessProcessId, "SIGKILL"\)/u,
      /child\.kill\("SIGKILL"\)/u,
      /outputLimitLatched/u,
      /BUILDER_FAULT_HARNESS_DEADLINE_MILLISECONDS_V2/u,
      /BUILDER_FAULT_HARNESS_SETTLEMENT_MILLISECONDS_V2/u,
      /waitForBuilderFaultHarnessProcessGroupDeathV2/u,
    ]) {
      assert.match(outerHarness, contract);
    }
    assert.doesNotMatch(
      outerHarness,
      /process\.send|child\.on\("message"|["']ipc["']|BUILDER_FAULT_IPC|(?:rmSync|rmdirSync|unlinkSync)\(|subjectProcess|workspace/u,
    );
    assert.doesNotMatch(source, /process\.send|BUILDER_FAULT_IPC/u);

    const childHarness = harnessTestSource.slice(
      harnessTestSource.indexOf("const BUILDER_FAULT_HARNESS_CHILD_SOURCE_V2"),
      harnessTestSource.indexOf("function builderFaultHarnessErrorV2("),
    );
    assert.match(
      childHarness,
      /retainedEvidence: observation\.retainedEvidence/u,
    );
    assert.match(childHarness, /process\.exit\(0\)/u);
    assert.doesNotMatch(
      childHarness,
      /process\.send|child\.on\("message"|["']ipc["']|BUILDER_FAULT_IPC|(?:rmSync|rmdirSync|unlinkSync)\(|process\.kill|\.kill\(|lstatSync|opendirSync|path\.join|observation\.root|exactNames/u,
    );
    const serializedPayload = childHarness.slice(
      childHarness.indexOf("const payload = {"),
      childHarness.indexOf("const frame = Buffer.from"),
    );
    assert.doesNotMatch(serializedPayload, /alias|processId|\broot:/u);
  });

  it("runtime-proves bounded builder failure containment and retention", {
    skip: process.platform !== "darwin",
  }, async () => {
    const observe = async (
      scenario:
        PlatformReleaseContentStoreDarwinFilesystemBuilderFaultScenarioForTestV2,
    ) => {
      const harness = await runBuilderFaultScenarioInSubprocessV2(scenario);
      assert.equal(
        harness.failure,
        undefined,
        harness.failure?.stack ?? harness.failure?.message,
      );
      assert.equal(harness.containmentProven, true);
      assert.ok(harness.observation);
      const observation = harness.observation;
      assert.equal(observation.observationFrozen, true);
      assert.equal(observation.admissionScope, "test_fixture");
      assert.equal(observation.productionAuthority, false);
      assert.equal(observation.scenario, scenario);
      assert.equal(observation.retainedEvidence.rootMode, 0o700);
      assert.equal(observation.retainedEvidence.binaryPresent, false);
      assert.equal(
        observation.retainedEvidence.rootEntryKinds.every((entry) =>
          entry === "retained_stage"),
        true,
      );
      if (scenario !== "nested_builder_invocation_failure") {
        assert.deepEqual(observation.retainedEvidence, {
          binaryPresent: false,
          rootEntryKinds: [],
          rootMode: 0o700,
          stageEntryNames: [],
          stageMode: null,
        });
      }
      assert.deepEqual(observation.retentionDisposition, {
        schema:
          "setfarm.platform-release-content-store-filesystem-fixture-retention-disposition.v2",
        admissionScope: "test_fixture",
        productionAuthority: false,
        deletionAuthority: false,
        filesystemMutationPerformed: false,
        rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2",
      });
      assert.equal(observation.dispositionFrozen, true);
      return observation;
    };
    const aggregateErrors = (
      error: BuilderFaultSerializedErrorV2,
    ): BuilderFaultSerializedErrorV2["errors"] => {
      assert.equal(error.name, "AggregateError");
      assert.equal(error.primaryCauseIsFirst, true);
      assert.equal(error.causeMessage, error.errors[0]?.message);
      return error.errors;
    };
    try {
      const streamStartedAt = Date.now();
      const stream = await observe("stdout_stream_error");
      assert.equal(
        stream.error.name,
        "PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2",
      );
      assert.equal(stream.error.code, "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED");
      assert.match(stream.error.message, /stdout stream failed/u);
      assert.match(
        stream.error.causeMessage ?? "",
        /Injected.*stdout stream failure/u,
      );
      assert.ok(Date.now() - streamStartedAt < 3_000);

      const stderrStreamStartedAt = Date.now();
      const stderrStream = await observe("stderr_stream_error");
      assert.equal(
        stderrStream.error.name,
        "PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2",
      );
      assert.equal(
        stderrStream.error.code,
        "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      );
      assert.match(stderrStream.error.message, /stderr stream failed/u);
      assert.match(
        stderrStream.error.causeMessage ?? "",
        /Injected.*stderr stream failure/u,
      );
      assert.ok(Date.now() - stderrStreamStartedAt < 3_000);

      const settlementStartedAt = Date.now();
      const settlement = await observe(
        "group_kill_failure_settlement_watchdog",
      );
      const settlementErrors = aggregateErrors(settlement.error);
      assert.deepEqual(
        settlementErrors.map((error) => error.message),
        [
          "Native content-store fixture builder timed out after 25ms",
          "Native content-store fixture builder process-group kill failed",
          "Native content-store fixture builder did not settle after termination",
        ],
      );
      const settlementElapsed = Date.now() - settlementStartedAt;
      assert.ok(settlementElapsed >= 2_900);
      assert.ok(settlementElapsed < 6_000);

      const deathStartedAt = Date.now();
      const death = await observe("group_death_unproven");
      const deathErrors = aggregateErrors(death.error);
      assert.deepEqual(
        deathErrors.map((error) => error.message),
        [
          "Native content-store fixture builder timed out after 25ms",
          "Native content-store fixture builder process-group death was not proven by ESRCH",
        ],
      );
      assert.equal(
        death.error.containmentProven,
        false,
      );
      const deathElapsed = Date.now() - deathStartedAt;
      assert.ok(deathElapsed >= 2_900);
      assert.ok(deathElapsed < 6_000);

      const overflowStartedAt = Date.now();
      const overflow = await observe("multi_chunk_output_overflow");
      const overflowErrors = aggregateErrors(overflow.error);
      assert.equal(overflowErrors.length, 2);
      assert.match(
        overflowErrors[0]!.message,
        /exceeded bounded (?:stdout|stderr)/u,
      );
      assert.equal(
        overflowErrors[1]!.message,
        "Native content-store fixture builder process-group death was not proven by ESRCH",
      );
      const overflowElapsed = Date.now() - overflowStartedAt;
      assert.ok(overflowElapsed >= 2_900);
      assert.ok(overflowElapsed < 6_000);

      const nested = await observe("nested_builder_invocation_failure");
      assert.equal(
        nested.error.name,
        "PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2",
      );
      assert.equal(nested.error.code, "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED");
      assert.match(nested.error.message, /builder emitted stderr/u);
      assert.deepEqual(nested.retainedEvidence.rootEntryKinds, [
        "retained_stage",
      ]);
      assert.equal(nested.retainedEvidence.stageMode, 0o700);
      assert.deepEqual(nested.retainedEvidence.stageEntryNames, [
        "platform-release-content-store-filesystem-fixture-v2.c",
        "platform-release-content-store-filesystem-kernel-v2.c",
        "platform-release-content-store-filesystem-kernel-v2.h",
      ]);

      const processes = spawnSync("/bin/ps", ["-ax", "-o", "command="], {
        encoding: "utf8",
        env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" },
        maxBuffer: 8 * 1024 * 1024,
        timeout: 2_000,
        killSignal: "SIGKILL",
      });
      assert.equal(processes.status, 0, processes.stderr);
      assert.equal(
        processes.stdout.includes(
          `/bin/sleep ${BUILDER_FAULT_SLEEP_DURATION_SECONDS_V2}`,
        ),
        false,
      );
      assert.equal(
        processes.stdout.includes(BUILDER_FAULT_PROCESS_MARKER_V2),
        false,
      );
      assert.equal(
        processes.stdout.includes(BUILDER_FAULT_HARNESS_PROCESS_MARKER_V2),
        false,
      );
    } finally {
      // The harness has no deletion authority; all fault roots remain retained.
    }
  });

  it("bounds binary capture before allocation and rejects exact-read drift", {
    skip: process.getuid === undefined,
  }, () => {
    const alias = mkdtempSync(
      path.join(os.tmpdir(), "setfarm-content-store-binary-capture-v2-"),
    );
    const root = realpathSync(alias);
    const binary = path.join(root, "fixture-binary");
    const writeBinary = (bytes: Buffer): void => {
      writeFileSync(binary, bytes, { flag: "wx", mode: 0o500 });
      chmodSync(binary, 0o500);
    };
    try {
      const admitted = Buffer.alloc(64, 0x5a);
      writeBinary(admitted);
      const captured =
        capturePlatformReleaseContentStoreDarwinFilesystemBinaryAtReadForTestV2(
          binary,
          () => {},
        );
      assert.deepEqual(captured, {
        admissionScope: "test_fixture",
        productionAuthority: false,
        binarySha256: sha256V2(admitted),
        binaryByteLength: admitted.byteLength,
      });
      assert.equal(Object.isFrozen(captured), true);
      assert.deepEqual(Object.keys(captured), [
        "admissionScope",
        "productionAuthority",
        "binarySha256",
        "binaryByteLength",
      ]);

      unlinkSync(binary);
      writeBinary(Buffer.alloc(64, 0x47));
      assert.throws(
        () =>
          capturePlatformReleaseContentStoreDarwinFilesystemBinaryAtReadForTestV2(
            binary,
            () => {
              chmodSync(binary, 0o600);
              truncateSync(binary, 64 * 1024 * 1024);
              chmodSync(binary, 0o500);
            },
          ),
        (error: unknown) =>
          error
            instanceof PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2
          && error.code === "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED"
          && /grew beyond its descriptor length/u.test(error.message),
      );

      unlinkSync(binary);
      writeBinary(Buffer.alloc(64 * 1024, 0x45));
      assert.throws(
        () =>
          capturePlatformReleaseContentStoreDarwinFilesystemBinaryAtReadForTestV2(
            binary,
            () => {
              chmodSync(binary, 0o600);
              truncateSync(binary, 1);
              chmodSync(binary, 0o500);
            },
          ),
        (error: unknown) =>
          error
            instanceof PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2
          && error.code === "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED"
          && /reached EOF before its descriptor length/u.test(error.message),
      );

      unlinkSync(binary);
      writeBinary(Buffer.from([0x41]));
      chmodSync(binary, 0o600);
      truncateSync(binary, 5 * 1024 * 1024);
      chmodSync(binary, 0o500);
      let hookCalled = false;
      assert.throws(
        () =>
          capturePlatformReleaseContentStoreDarwinFilesystemBinaryAtReadForTestV2(
            binary,
            () => {
              hookCalled = true;
            },
          ),
        (error: unknown) =>
          error
            instanceof PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2
          && error.code === "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED"
          && /not one exact owned mode-0500 file/u.test(error.message),
      );
      assert.equal(hookCalled, false);
    } finally {
      rmSync(alias, { recursive: true, force: true });
    }
  });

  it("publishes, adopts, rejects a partial pair, and preserves the caller descriptor", {
    skip: process.platform !== "darwin",
  }, () => {
    assert.ok(fixture);
    assert.deepEqual(Object.keys(fixture), [
      "buildRecipeHash",
      "binarySha256",
      "binaryByteLength",
      "dispose",
    ]);
    assert.match(fixture.buildRecipeHash, /^[a-f0-9]{64}$/u);
    assert.match(fixture.binarySha256, /^[a-f0-9]{64}$/u);
    assert.equal(fixture.binaryByteLength > 0, true);
    assert.equal(Object.isFrozen(fixture), true);
    const inspection = inspectPlatformReleaseContentStoreDarwinFilesystemFixtureV2(
      fixture,
    );
    assert.deepEqual(inspection, {
      buildRecipeHash: fixture.buildRecipeHash,
      binarySha256: fixture.binarySha256,
      binaryByteLength: fixture.binaryByteLength,
    });
    assert.equal(Object.isFrozen(inspection), true);
    const unauthenticated = (error: unknown): boolean =>
      error instanceof PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2
      && error.code === "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED";
    assert.throws(
      () => inspectPlatformReleaseContentStoreDarwinFilesystemFixtureV2(
        new Proxy(fixture!, {}),
      ),
      unauthenticated,
    );
    const clonedPublicReceipt = structuredClone({
      buildRecipeHash: fixture.buildRecipeHash,
      binarySha256: fixture.binarySha256,
      binaryByteLength: fixture.binaryByteLength,
    });
    assert.throws(
      () => inspectPlatformReleaseContentStoreDarwinFilesystemFixtureV2(
        clonedPublicReceipt as PlatformReleaseContentStoreDarwinFilesystemFixtureV2,
      ),
      unauthenticated,
    );
    assert.throws(
      () => inspectPlatformReleaseContentStoreDarwinFilesystemFixtureV2(
        Object.freeze({
          ...clonedPublicReceipt,
          dispose() {},
        }),
      ),
      unauthenticated,
    );

    const storeAlias = mkdtempSync(
      path.join(os.tmpdir(), "setfarm-content-store-runner-test-v2-"),
    );
    const storeRoot = realpathSync(storeAlias);
    const locks = path.join(storeRoot, ".locks");
    const staging = path.join(storeRoot, ".staging");
    const releases = path.join(storeRoot, "releases");
    const attestations = path.join(storeRoot, "attestations");
    let rootDescriptor = -1;
    try {
      chmodSync(storeRoot, 0o700);
      for (const child of [locks, staging, releases, attestations]) {
        mkdirSync(child, { mode: 0o700 });
        chmodSync(child, 0o700);
      }
      const expected = Object.freeze({
        root: expectedDirectoryV2(storeRoot),
        locks: expectedDirectoryV2(locks),
        staging: expectedDirectoryV2(staging),
        releases: expectedDirectoryV2(releases),
        attestations: expectedDirectoryV2(attestations),
      });
      rootDescriptor = openSync(
        storeRoot,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      const descriptorBefore = fstatSync(rootDescriptor, { bigint: true });
      const manifestBytes = Buffer.from(
        '{"schema":"setfarm.test-content-store-manifest.v2"}',
        "utf8",
      );
      const manifestPayloadHash = sha256V2(manifestBytes);
      const attestationBytes = Buffer.from(
        `{"manifestPayloadHash":"${manifestPayloadHash}","schema":"setfarm.test-content-store-attestation.v2"}`,
        "utf8",
      );
      const attestationHash = sha256V2(attestationBytes);
      const input = Object.freeze({
        rootDescriptor,
        ...expected,
        manifestPayloadHash,
        attestationHash,
        manifestBytes,
        attestationBytes,
        checkpoint: 0 as const,
      });
      assert.throws(
        () => runPlatformReleaseContentStoreDarwinFilesystemFixtureV2(
          fixture!,
          {
            ...input,
            checkpoint: 1,
          } as unknown as Parameters<
            typeof runPlatformReleaseContentStoreDarwinFilesystemFixtureV2
          >[1],
        ),
        (error: unknown) =>
          error instanceof PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2
          && error.code === "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      );
      assert.deepEqual(readdirSync(locks), []);
      assert.deepEqual(readdirSync(staging), []);
      assert.deepEqual(readdirSync(releases), []);
      assert.deepEqual(readdirSync(attestations), []);

      const published = runPlatformReleaseContentStoreDarwinFilesystemFixtureV2(
        fixture,
        input,
      );
      assert.equal(published.status, "ok");
      assert.equal(published.admissionScope, "test_fixture");
      assert.equal(
        published.capability,
        "darwin_descriptor_relative_content_store_fixture_v2",
      );
      assert.equal(published.productionAuthority, false);
      assert.equal(published.error.primaryCode, 0);
      assert.equal(published.error.primaryCodeName, "ok");
      assert.equal(published.error.terminalCode, 0);
      assert.equal(published.error.terminalCodeName, "ok");
      assert.equal(published.result.releaseDisposition, "published");
      assert.equal(published.result.attestationDisposition, "published");
      assert.equal(published.result.contentLeaseAcquired, true);
      assert.equal(published.result.attestationLeaseAcquired, true);
      assert.equal(published.result.contentLeaseRecovered, false);
      assert.equal(published.result.attestationLeaseRecovered, false);
      assert.equal(published.result.authenticatedLeaseLedgerPresent, false);
      assert.equal(published.result.leasesReleased, true);
      assert.equal(published.result.stageCleaned, true);
      assert.equal(
        published.result.staleLeaseRecoveryPolicy,
        "unauthenticated_fixture_exact_inode_and_f_tlock_only_v2",
      );
      assert.equal(
        published.result.unauthenticatedStaleLeaseRecoveryEnabled,
        true,
      );
      assert.equal(
        published.result.unlinkAuthorityPolicy,
        "preserve_unless_exact_identity_revalidated_no_same_uid_atomic_unlink_v2",
      );
      assert.equal(published.result.unlinkAuthorityPolicyCode, 1);
      assert.equal(
        published.result.sameUidAtomicConditionalUnlinkAvailable,
        false,
      );
      assert.equal(Object.isFrozen(published), true);
      assert.equal(Object.isFrozen(published.result.evidence.manifest), true);
      assertDirectoryEvidenceV2(published.result.evidence.root, expected.root);
      assertDirectoryEvidenceV2(published.result.evidence.locks, expected.locks);
      assertDirectoryEvidenceV2(published.result.evidence.staging, expected.staging);
      assertDirectoryEvidenceV2(published.result.evidence.releases, expected.releases);
      assertDirectoryEvidenceV2(
        published.result.evidence.attestations,
        expected.attestations,
      );
      assert.equal(
        published.result.evidence.manifest.byteLength,
        String(manifestBytes.byteLength),
      );
      assert.equal(published.result.evidence.manifest.mode, 0o444);
      assert.equal(
        published.result.evidence.attestation.byteLength,
        String(attestationBytes.byteLength),
      );
      assert.equal(published.result.evidence.attestation.mode, 0o444);
      assert.equal(published.result.evidence.releaseRoot.mode, 0o555);

      const releaseRoot = path.join(releases, manifestPayloadHash);
      const manifest = path.join(releaseRoot, "manifest.json");
      const attestation = path.join(attestations, `${attestationHash}.json`);
      assert.deepEqual(readdirSync(storeRoot).sort(), [
        ".locks",
        ".staging",
        "attestations",
        "releases",
      ]);
      assert.deepEqual(readdirSync(locks), []);
      assert.deepEqual(readdirSync(staging), []);
      assert.deepEqual(readdirSync(releases), [manifestPayloadHash]);
      assert.deepEqual(readdirSync(releaseRoot), ["manifest.json"]);
      assert.deepEqual(readdirSync(attestations), [`${attestationHash}.json`]);
      assert.deepEqual(readFileSync(manifest), manifestBytes);
      assert.deepEqual(readFileSync(attestation), attestationBytes);
      assert.equal(lstatSync(releaseRoot).mode & 0o7777, 0o555);
      assert.equal(lstatSync(manifest).mode & 0o7777, 0o444);
      assert.equal(lstatSync(attestation).mode & 0o7777, 0o444);

      const adopted = runPlatformReleaseContentStoreDarwinFilesystemFixtureV2(
        fixture,
        input,
      );
      assert.equal(adopted.status, "ok");
      assert.equal(adopted.result.releaseDisposition, "adopted_identical");
      assert.equal(adopted.result.attestationDisposition, "adopted_identical");
      assert.deepEqual(readFileSync(manifest), manifestBytes);
      assert.deepEqual(readFileSync(attestation), attestationBytes);

      unlinkSync(attestation);
      const partial = runPlatformReleaseContentStoreDarwinFilesystemFixtureV2(
        fixture,
        input,
      );
      assert.equal(partial.status, "error");
      assert.equal(partial.error.primaryCode, 6);
      assert.equal(partial.error.primaryCodeName, "state_conflict");
      assert.equal(existsSync(manifest), true);
      assert.equal(existsSync(attestation), false);
      assert.deepEqual(readdirSync(locks), []);
      assert.deepEqual(readdirSync(staging), []);

      const descriptorAfter = fstatSync(rootDescriptor, { bigint: true });
      assert.equal(descriptorAfter.dev, descriptorBefore.dev);
      assert.equal(descriptorAfter.ino, descriptorBefore.ino);
      assert.equal(descriptorAfter.isDirectory(), true);

      const pollutedAlias = mkdtempSync(
        path.join(os.tmpdir(), "setfarm-content-store-root-extra-v2-"),
      );
      const pollutedRoot = realpathSync(pollutedAlias);
      const pollutedLocks = path.join(pollutedRoot, ".locks");
      const pollutedStaging = path.join(pollutedRoot, ".staging");
      const pollutedReleases = path.join(pollutedRoot, "releases");
      const pollutedAttestations = path.join(pollutedRoot, "attestations");
      let pollutedDescriptor = -1;
      try {
        chmodSync(pollutedRoot, 0o700);
        for (const child of [
          pollutedLocks,
          pollutedStaging,
          pollutedReleases,
          pollutedAttestations,
        ]) {
          mkdirSync(child, { mode: 0o700 });
          chmodSync(child, 0o700);
        }
        writeFileSync(
          path.join(pollutedRoot, "unexpected-direct-root-entry"),
          Buffer.from("unexpected", "utf8"),
          { flag: "wx", mode: 0o600 },
        );
        pollutedDescriptor = openSync(
          pollutedRoot,
          constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
        );
        const rootExtra = runPlatformReleaseContentStoreDarwinFilesystemFixtureV2(
          fixture,
          Object.freeze({
            rootDescriptor: pollutedDescriptor,
            root: expectedDirectoryV2(pollutedRoot),
            locks: expectedDirectoryV2(pollutedLocks),
            staging: expectedDirectoryV2(pollutedStaging),
            releases: expectedDirectoryV2(pollutedReleases),
            attestations: expectedDirectoryV2(pollutedAttestations),
            manifestPayloadHash,
            attestationHash,
            manifestBytes,
            attestationBytes,
            checkpoint: 0 as const,
          }),
        );
        assert.equal(rootExtra.status, "error");
        assert.equal(rootExtra.error.primaryCode, 6);
        assert.equal(rootExtra.error.primaryCodeName, "state_conflict");
        assert.deepEqual(readdirSync(pollutedLocks), []);
        assert.deepEqual(readdirSync(pollutedStaging), []);
        assert.deepEqual(readdirSync(pollutedReleases), []);
        assert.deepEqual(readdirSync(pollutedAttestations), []);
      } finally {
        if (pollutedDescriptor >= 0) closeSync(pollutedDescriptor);
        rmSync(pollutedAlias, { recursive: true, force: true });
      }

    } finally {
      if (rootDescriptor >= 0) closeSync(rootDescriptor);
      const releaseEntries = existsSync(releases) ? readdirSync(releases) : [];
      for (const entry of releaseEntries) {
        const releaseRoot = path.join(releases, entry);
        if (existsSync(releaseRoot)) chmodSync(releaseRoot, 0o700);
      }
      rmSync(storeAlias, { recursive: true, force: true });
    }
  });

  it("rejects an attestations symlink displacement before attestation link", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.ok(fixture);
    await assertCheckpointDisplacementV2(fixture, 9, "attestations");
  });

  it("preserves a displaced staging residue before cleanup", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.ok(fixture);
    await assertCheckpointDisplacementV2(fixture, 11, ".staging");
  });

  it("settles a stopped child and preserves the callback's thrown cause", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.ok(fixture);
    const storeAlias = mkdtempSync(
      path.join(os.tmpdir(), "setfarm-content-store-callback-throw-v2-"),
    );
    const storeRoot = realpathSync(storeAlias);
    const locks = path.join(storeRoot, ".locks");
    const staging = path.join(storeRoot, ".staging");
    const releases = path.join(storeRoot, "releases");
    const attestations = path.join(storeRoot, "attestations");
    let rootDescriptor = -1;
    try {
      chmodSync(storeRoot, 0o700);
      for (const child of [locks, staging, releases, attestations]) {
        mkdirSync(child, { mode: 0o700 });
        chmodSync(child, 0o700);
      }
      rootDescriptor = openSync(
        storeRoot,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      const descriptorBefore = fstatSync(rootDescriptor, { bigint: true });
      const manifestBytes = Buffer.from("callback-throw-manifest", "utf8");
      const attestationBytes = Buffer.from("callback-throw-attestation", "utf8");
      const callbackCause = new Error("exact-checkpoint-callback-cause");
      await assert.rejects(
        runPlatformReleaseContentStoreDarwinFilesystemFixtureAtCheckpointForTestV2(
          fixture,
          Object.freeze({
            rootDescriptor,
            root: expectedDirectoryV2(storeRoot),
            locks: expectedDirectoryV2(locks),
            staging: expectedDirectoryV2(staging),
            releases: expectedDirectoryV2(releases),
            attestations: expectedDirectoryV2(attestations),
            manifestPayloadHash: sha256V2(manifestBytes),
            attestationHash: sha256V2(attestationBytes),
            manifestBytes,
            attestationBytes,
            checkpoint: 1 as const,
          }),
          (observation) => {
            assert.equal(observation.processState.startsWith("T"), true);
            assert.equal(
              darwinProcessStateV2(observation.processId).startsWith("T"),
              true,
            );
            throw callbackCause;
          },
        ),
        (error: unknown) => error === callbackCause,
      );
      const descriptorAfter = fstatSync(rootDescriptor, { bigint: true });
      assert.equal(descriptorAfter.dev, descriptorBefore.dev);
      assert.equal(descriptorAfter.ino, descriptorBefore.ino);
      assert.deepEqual(readdirSync(locks), []);
      assert.deepEqual(readdirSync(staging), []);
      assert.deepEqual(readdirSync(releases), []);
      assert.deepEqual(readdirSync(attestations), []);
      assert.equal(
        inspectPlatformReleaseContentStoreDarwinFilesystemFixtureV2(fixture)
          .binarySha256,
        fixture.binarySha256,
      );
    } finally {
      if (rootDescriptor >= 0) closeSync(rootDescriptor);
      cleanupOwnedStoreV2(storeAlias, releases);
    }
  });

  for (const checkpoint of [2, 4, 8, 10, 12] as const) {
    it(`replays the exact fail-closed crash census at checkpoint ${checkpoint}`, {
      skip: process.platform !== "darwin",
    }, async () => {
      assert.ok(fixture);
      await assertCrashReplayV2(fixture, checkpoint);
    });
  }

  it("does not steal or unlink a live content lease from a stopped owner", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.ok(fixture);
    const storeAlias = mkdtempSync(
      path.join(os.tmpdir(), "setfarm-content-store-active-lock-v2-"),
    );
    const storeRoot = realpathSync(storeAlias);
    const locks = path.join(storeRoot, ".locks");
    const staging = path.join(storeRoot, ".staging");
    const releases = path.join(storeRoot, "releases");
    const attestations = path.join(storeRoot, "attestations");
    let rootDescriptor = -1;
    try {
      chmodSync(storeRoot, 0o700);
      for (const child of [locks, staging, releases, attestations]) {
        mkdirSync(child, { mode: 0o700 });
        chmodSync(child, 0o700);
      }
      rootDescriptor = openSync(
        storeRoot,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      const manifestBytes = Buffer.from("active-lock-manifest", "utf8");
      const attestationBytes = Buffer.from("active-lock-attestation", "utf8");
      const manifestPayloadHash = sha256V2(manifestBytes);
      const attestationHash = sha256V2(attestationBytes);
      const expected = Object.freeze({
        root: expectedDirectoryV2(storeRoot),
        locks: expectedDirectoryV2(locks),
        staging: expectedDirectoryV2(staging),
        releases: expectedDirectoryV2(releases),
        attestations: expectedDirectoryV2(attestations),
      });
      const checkpointInput = Object.freeze({
        rootDescriptor,
        ...expected,
        manifestPayloadHash,
        attestationHash,
        manifestBytes,
        attestationBytes,
        checkpoint: 2 as const,
      });
      const contentLeaseName = `content-${manifestPayloadHash}.lock`;
      const contentLease = path.join(locks, contentLeaseName);
      const first = await runPlatformReleaseContentStoreDarwinFilesystemFixtureAtCheckpointForTestV2(
        fixture,
        checkpointInput,
        (observation) => {
          assert.equal(observation.processState.startsWith("T"), true);
          assert.equal(
            darwinProcessStateV2(observation.processId).startsWith("T"),
            true,
          );
          assert.deepEqual(readdirSync(locks), [contentLeaseName]);
          const liveBefore = lstatSync(contentLease, { bigint: true });
          assert.equal(liveBefore.mode & 0o7777n, 0o600n);
          assert.equal(liveBefore.nlink, 1n);
          assert.equal(liveBefore.size, 0n);
          const contender = runPlatformReleaseContentStoreDarwinFilesystemFixtureV2(
            fixture!,
            Object.freeze({ ...checkpointInput, checkpoint: 0 as const }),
          );
          assert.equal(contender.status, "error");
          assert.equal(contender.error.primaryCode, 15);
          assert.equal(contender.error.primaryCodeName, "lease_failed");
          assert.equal(contender.error.terminalCode, 15);
          assert.equal(contender.error.terminalCodeName, "lease_failed");
          assert.equal(contender.error.leaseCode, 1);
          assert.equal(contender.error.leaseCodeName, "content_acquire_failed");
          assert.equal(contender.result.contentLeaseRecovered, false);
          assert.equal(contender.result.attestationLeaseRecovered, false);
          assertRawRecoveryAuthorityV2(contender);
          assert.deepEqual(readdirSync(locks), [contentLeaseName]);
          const liveAfter = lstatSync(contentLease, { bigint: true });
          assert.deepEqual(liveAfter, liveBefore);
        },
      );
      assert.equal(first.status, "ok");
      assert.equal(first.result.contentLeaseRecovered, false);
      assert.equal(first.result.attestationLeaseRecovered, false);
      assert.equal(first.result.releaseDisposition, "published");
      assert.equal(first.result.attestationDisposition, "published");
      assertRawRecoveryAuthorityV2(first);
      assert.deepEqual(readdirSync(locks), []);
      assert.deepEqual(readdirSync(staging), []);
      const releaseRoot = path.join(releases, manifestPayloadHash);
      assert.equal(lstatSync(releaseRoot).mode & 0o7777, 0o555);
      assertExactFixtureFileV2(
        path.join(releaseRoot, "manifest.json"),
        manifestBytes,
        0o444,
        1,
      );
      assertExactFixtureFileV2(
        path.join(attestations, `${attestationHash}.json`),
        attestationBytes,
        0o444,
        1,
      );
    } finally {
      if (rootDescriptor >= 0) closeSync(rootDescriptor);
      cleanupOwnedStoreV2(storeAlias, releases);
    }
  });

  it("authenticates the exact retained stage and rejects bounded membership drift", {
    skip: process.platform !== "darwin",
  }, async () => {
    const drifted =
      await buildPlatformReleaseContentStoreDarwinFilesystemFixtureV2();
    const retained =
      inspectPlatformReleaseContentStoreDarwinFilesystemRetainedWorkspaceForTestV2(
        drifted,
      );
    assert.deepEqual(Object.keys(retained), [
      "admissionScope",
      "alias",
      "binary",
      "deletionAuthority",
      "productionAuthority",
      "root",
      "stage",
    ]);
    assert.equal(retained.admissionScope, "test_fixture");
    assert.equal(retained.productionAuthority, false);
    assert.equal(retained.deletionAuthority, false);
    assert.equal(lstatSync(retained.stage).mode & 0o7777, 0o700);
    assert.deepEqual(readdirSync(retained.root).sort(), [
      path.basename(retained.stage),
      "content-store-filesystem-fixture-v2",
    ].sort());
    assert.deepEqual(readdirSync(retained.stage).sort(), [
      "content-store-filesystem-fixture-v2",
      "platform-release-content-store-filesystem-fixture-v2.c",
      "platform-release-content-store-filesystem-kernel-v2.c",
      "platform-release-content-store-filesystem-kernel-v2.h",
    ]);
    const unexpected = path.join(retained.stage, "unexpected-member");
    writeFileSync(unexpected, "foreign\n", { flag: "wx", mode: 0o600 });
    assert.throws(
      () => inspectPlatformReleaseContentStoreDarwinFilesystemFixtureV2(drifted),
      (error: unknown) =>
        error
          instanceof PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2
          && error.code === "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
    );
    assert.deepEqual(
      drifted.dispose(),
      {
        schema:
          "setfarm.platform-release-content-store-filesystem-fixture-retention-disposition.v2",
        admissionScope: "test_fixture",
        productionAuthority: false,
        deletionAuthority: false,
        filesystemMutationPerformed: false,
        rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2",
      },
    );
    assert.equal(readFileSync(unexpected, "utf8"), "foreign\n");
  });

  it("logically disposes without mutating a replaced retained root", {
    skip: process.platform !== "darwin",
  }, async () => {
    const disposable =
      await buildPlatformReleaseContentStoreDarwinFilesystemFixtureV2();
    const retained =
      inspectPlatformReleaseContentStoreDarwinFilesystemRetainedWorkspaceForTestV2(
        disposable,
    );
    const displaced = `${retained.root}-displaced`;
    const sentinel = path.join(retained.root, "foreign-sentinel");
    renameSync(retained.root, displaced);
    mkdirSync(retained.root, { mode: 0o700 });
    chmodSync(retained.root, 0o700);
    writeFileSync(sentinel, "foreign\n", { flag: "wx", mode: 0o600 });
    const disposition = disposable.dispose();
    assert.deepEqual(disposition, {
      schema:
        "setfarm.platform-release-content-store-filesystem-fixture-retention-disposition.v2",
      admissionScope: "test_fixture",
      productionAuthority: false,
      deletionAuthority: false,
      filesystemMutationPerformed: false,
      rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2",
    });
    assert.equal(Object.isFrozen(disposition), true);
    assert.equal(readFileSync(sentinel, "utf8"), "foreign\n");
    assert.deepEqual(readdirSync(retained.root), ["foreign-sentinel"]);
    assert.equal(
      readdirSync(displaced).includes("content-store-filesystem-fixture-v2"),
      true,
    );
    assert.throws(
      () => inspectPlatformReleaseContentStoreDarwinFilesystemFixtureV2(disposable),
      (error: unknown) =>
        error
          instanceof PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2
        && error.code === "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
    );
  });

  it("rejects a disposed authenticated handle without recreating state", {
    skip: process.platform !== "darwin",
  }, () => {
    assert.ok(fixture);
    const disposed = fixture;
    const retained =
      inspectPlatformReleaseContentStoreDarwinFilesystemRetainedWorkspaceForTestV2(
        disposed,
      );
    const disposition = disposed.dispose();
    fixture = undefined;
    assert.equal(disposition.filesystemMutationPerformed, false);
    assert.equal(existsSync(retained.root), true);
    assert.throws(
      () => inspectPlatformReleaseContentStoreDarwinFilesystemFixtureV2(disposed),
      (error: unknown) =>
        error instanceof PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2
        && error.code === "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
    );
  });
});
