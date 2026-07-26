import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  closeSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  EVIDENCE_COMMAND_MAX_OUTPUT_BYTES_V2,
  EVIDENCE_COMMAND_MAX_TEST_FILE_BYTES_V2,
  EVIDENCE_COMMAND_TIMEOUT_MS_V2,
} from "../evidence/schemas/command-runner-v2.js";
import {
  acquireNetworkSandboxLaunchContextInternalV2,
} from "./network-sandbox-v2.js";
import {
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_NAMES_V2,
} from "./schemas/network-isolation-negative-probe-v2.js";

export type PrivateNodeTestCommandErrorCodeV2 =
  | "NODE_TEST_COMMAND_V2_INPUT_INVALID"
  | "NODE_TEST_COMMAND_V2_HOST_DRIFT"
  | "NODE_TEST_COMMAND_V2_SPAWN_FAILED"
  | "NODE_TEST_COMMAND_V2_CLEANUP_FAILED";

export class PrivateNodeTestCommandErrorV2 extends Error {
  readonly code: PrivateNodeTestCommandErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: PrivateNodeTestCommandErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PrivateNodeTestCommandErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function fail(
  code: PrivateNodeTestCommandErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PrivateNodeTestCommandErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function exactTestFile(input: Readonly<{
  bundleRoot: string;
  testPath: string;
  testContentHash: string;
}>): Readonly<{
  runtimeLogicalLocator:
    | "candidate-bundle/application/cli.setfarm.test.js"
    | "candidate-bundle/application/app.setfarm.test.js";
  contentHash: string;
  byteLength: number;
}> {
  if (
    !path.isAbsolute(input.bundleRoot)
    || !path.isAbsolute(input.testPath)
    || !/^[a-f0-9]{64}$/u.test(input.testContentHash)
  ) {
    return fail(
      "NODE_TEST_COMMAND_V2_INPUT_INVALID",
      "Node test command requires canonical bundle, test and content authority",
    );
  }
  const bundleRoot = realpathSync(input.bundleRoot);
  const testPath = realpathSync(input.testPath);
  const relative = path.relative(bundleRoot, testPath);
  const runtimeLogicalLocator =
    relative === "application/cli.setfarm.test.js"
      ? "candidate-bundle/application/cli.setfarm.test.js" as const
      : relative === "application/app.setfarm.test.js"
        ? "candidate-bundle/application/app.setfarm.test.js" as const
        : null;
  if (
    bundleRoot !== input.bundleRoot
    || testPath !== input.testPath
    || runtimeLogicalLocator === null
  ) {
    return fail(
      "NODE_TEST_COMMAND_V2_INPUT_INVALID",
      "Node test command accepts only one exact sealed runtime test member",
    );
  }
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      testPath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    const pathAfter = lstatSync(testPath);
    const contentHash = sha256(bytes);
    bytes.fill(0);
    if (
      !before.isFile()
      || before.nlink !== 1
      || (before.mode & 0o7777) !== 0o444
      || before.size < 1
      || before.size > EVIDENCE_COMMAND_MAX_TEST_FILE_BYTES_V2
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.mode !== after.mode
      || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs
      || before.ctimeMs !== after.ctimeMs
      || after.dev !== pathAfter.dev
      || after.ino !== pathAfter.ino
      || after.mode !== pathAfter.mode
      || after.size !== pathAfter.size
      || contentHash !== input.testContentHash
    ) {
      return fail(
        "NODE_TEST_COMMAND_V2_INPUT_INVALID",
        "Node test command member changed before spawn",
      );
    }
    return Object.freeze({
      runtimeLogicalLocator,
      contentHash,
      byteLength: before.size,
    });
  } catch (error) {
    if (error instanceof PrivateNodeTestCommandErrorV2) throw error;
    return fail(
      "NODE_TEST_COMMAND_V2_INPUT_INVALID",
      "Node test command member could not be captured",
      error,
    );
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export type NodeTestTapSummaryV2 =
  | Readonly<{
      status: "valid_terminal_summary";
      protocol: "node_test_tap_v13";
      testCount: number;
      suiteCount: number;
      passCount: number;
      failCount: number;
      cancelledCount: number;
      skippedCount: number;
      todoCount: number;
      durationMicros: number;
      summaryHash: string;
    }>
  | Readonly<{
      status: "invalid_or_incomplete_summary";
      protocol: "node_test_tap_v13";
      stdoutContentHash: string;
    }>;

function exactIntegerLine(line: string, label: string): number | undefined {
  const match = new RegExp(`^# ${label} ([0-9]+)$`, "u").exec(line);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? value : undefined;
}

function parseNodeTestTapSummaryV2(stdout: Buffer): NodeTestTapSummaryV2 {
  const stdoutContentHash = sha256(stdout);
  const text = stdout.toString("utf8");
  if (
    Buffer.from(text, "utf8").compare(stdout) !== 0
    || !text.startsWith("TAP version 13\n")
  ) {
    return Object.freeze({
      status: "invalid_or_incomplete_summary" as const,
      protocol: "node_test_tap_v13" as const,
      stdoutContentHash,
    });
  }
  const lines = text.split("\n");
  while (lines.at(-1) === "") lines.pop();
  const terminal = lines.slice(-9);
  const plan = /^1\.\.([0-9]+)$/u.exec(terminal[0] ?? "");
  const testCount = exactIntegerLine(terminal[1] ?? "", "tests");
  const suiteCount = exactIntegerLine(terminal[2] ?? "", "suites");
  const passCount = exactIntegerLine(terminal[3] ?? "", "pass");
  const failCount = exactIntegerLine(terminal[4] ?? "", "fail");
  const cancelledCount = exactIntegerLine(terminal[5] ?? "", "cancelled");
  const skippedCount = exactIntegerLine(terminal[6] ?? "", "skipped");
  const todoCount = exactIntegerLine(terminal[7] ?? "", "todo");
  const duration = /^# duration_ms ([0-9]+(?:\.[0-9]+)?)$/u.exec(
    terminal[8] ?? "",
  );
  const planCount = plan ? Number(plan[1]) : undefined;
  const durationMicros = duration
    ? Math.round(Number(duration[1]) * 1_000)
    : undefined;
  const values = [
    planCount,
    testCount,
    suiteCount,
    passCount,
    failCount,
    cancelledCount,
    skippedCount,
    todoCount,
    durationMicros,
  ];
  if (
    terminal.length !== 9
    || values.some((value) =>
      value === undefined
      || !Number.isSafeInteger(value)
      || value < 0)
    || planCount !== testCount
  ) {
    return Object.freeze({
      status: "invalid_or_incomplete_summary" as const,
      protocol: "node_test_tap_v13" as const,
      stdoutContentHash,
    });
  }
  const identity = {
    status: "valid_terminal_summary" as const,
    protocol: "node_test_tap_v13" as const,
    testCount: testCount!,
    suiteCount: suiteCount!,
    passCount: passCount!,
    failCount: failCount!,
    cancelledCount: cancelledCount!,
    skippedCount: skippedCount!,
    todoCount: todoCount!,
    durationMicros: durationMicros!,
  };
  return Object.freeze({
    ...identity,
    summaryHash: hashCanonicalJson({
      schema: "setfarm.node-test-tap-summary-hash.v2",
      summary: identity,
    }),
  });
}

type PrivateNodeTestCommandTerminationV2 =
  | Readonly<{
      status: "exited";
      exitCode: number;
      signal: null;
    }>
  | Readonly<{
      status: "signal_exit";
      exitCode: null;
      signal: string;
    }>
  | Readonly<{
      status: "platform_terminated";
      reason: "output_limit" | "timeout";
      exitCode: null;
      signal: "SIGKILL";
    }>;

export type PrivateNodeTestCommandResultV2 = Readonly<{
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  pid: number;
  termination: PrivateNodeTestCommandTerminationV2;
  stdout: Buffer;
  stderr: Buffer;
  tapSummary: NodeTestTapSummaryV2;
  runtimeTestMemberLocator:
    | "candidate-bundle/application/cli.setfarm.test.js"
    | "candidate-bundle/application/app.setfarm.test.js";
  testContentHash: string;
  testByteLength: number;
  directArgvHash: string;
  environmentInstanceHash: string;
  normalizedEnvironmentHash:
    typeof NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2;
  sandboxExecutableContentHash: string;
  sandboxExecutablePhysicalIdentityHash: string;
  sandboxProfileHash: string;
}>;

type BoundedSpawnResultV2 = Readonly<{
  pid: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  forcedReason: "output_limit" | "timeout" | null;
  stdout: Buffer;
  stderr: Buffer;
}>;

function killProcessGroup(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // The complete group may already have exited.
    }
  }
}

function spawnBoundedNodeTestV2(input: Readonly<{
  sandboxExecutablePath: string;
  sandboxProfile: string;
  nodeExecutablePath: string;
  testPath: string;
  cwd: string;
  environment: NodeJS.ProcessEnv;
}>): Promise<BoundedSpawnResultV2> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.sandboxExecutablePath, [
      "-p",
      input.sandboxProfile,
      input.nodeExecutablePath,
      "--test",
      input.testPath,
    ], {
      cwd: input.cwd,
      detached: true,
      env: input.environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    if (child.stdout === null || child.stderr === null) {
      if (child.pid !== undefined) killProcessGroup(child.pid);
      reject(new PrivateNodeTestCommandErrorV2(
        "NODE_TEST_COMMAND_V2_SPAWN_FAILED",
        "Authenticated Node test process did not expose fixed output pipes",
      ));
      return;
    }
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let forcedReason: "output_limit" | "timeout" | null = null;
    let spawnFailure: unknown;
    let closed = false;
    const appendBounded = (
      chunks: Buffer[],
      chunk: Buffer,
      observedBytes: number,
    ): number => {
      const remaining = EVIDENCE_COMMAND_MAX_OUTPUT_BYTES_V2
        - Math.min(observedBytes, EVIDENCE_COMMAND_MAX_OUTPUT_BYTES_V2);
      if (remaining > 0) chunks.push(Buffer.from(chunk.subarray(0, remaining)));
      return observedBytes + chunk.byteLength;
    };
    const terminate = (reason: "output_limit" | "timeout"): void => {
      if (closed || forcedReason !== null) return;
      forcedReason = reason;
      if (child.pid !== undefined) killProcessGroup(child.pid);
    };
    const timer = setTimeout(
      () => terminate("timeout"),
      EVIDENCE_COMMAND_TIMEOUT_MS_V2,
    );
    child.once("error", (error) => {
      spawnFailure = error;
      clearTimeout(timer);
      if (child.pid !== undefined) killProcessGroup(child.pid);
    });
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes = appendBounded(stdoutChunks, chunk, stdoutBytes);
      if (stdoutBytes > EVIDENCE_COMMAND_MAX_OUTPUT_BYTES_V2) {
        terminate("output_limit");
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes = appendBounded(stderrChunks, chunk, stderrBytes);
      if (stderrBytes > EVIDENCE_COMMAND_MAX_OUTPUT_BYTES_V2) {
        terminate("output_limit");
      }
    });
    child.once("close", (exitCode, signal) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      if (child.pid !== undefined) killProcessGroup(child.pid);
      const stdout = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks);
      if (spawnFailure !== undefined || child.pid === undefined) {
        stdout.fill(0);
        stderr.fill(0);
        reject(new PrivateNodeTestCommandErrorV2(
          "NODE_TEST_COMMAND_V2_SPAWN_FAILED",
          "Authenticated Node test process could not start",
          { cause: spawnFailure },
        ));
        return;
      }
      resolve(Object.freeze({
        pid: child.pid,
        exitCode,
        signal,
        forcedReason,
        stdout,
        stderr,
      }));
    });
  });
}

/**
 * @internal Executes the exact sealed generated-test member through the
 * authenticated Node runtime and code-owned network sandbox. Paths remain
 * private to this execution boundary.
 */
export async function executePrivateNodeTestCommandV2(input: Readonly<{
  bundleRoot: string;
  testPath: string;
  testContentHash: string;
  nodeExecutablePath: string;
}>): Promise<PrivateNodeTestCommandResultV2> {
  const test = exactTestFile(input);
  let scratchRoot: string | undefined;
  let capturedProcess: BoundedSpawnResultV2 | undefined;
  try {
    const sandboxBefore =
      await acquireNetworkSandboxLaunchContextInternalV2();
    scratchRoot = realpathSync(
      mkdtempSync(path.join(tmpdir(), "setfarm-node-test-command-v2-")),
    );
    const runHome = path.join(scratchRoot, "home");
    const runTmp = path.join(scratchRoot, "tmp");
    const runCache = path.join(scratchRoot, "cache");
    for (const directory of [runHome, runTmp, runCache]) {
      mkdirSync(directory, { mode: 0o700 });
    }
    const environment = Object.freeze({
      CI: "true",
      HOME: runHome,
      HOST: "127.0.0.1",
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      NO_COLOR: "1",
      PORT: "0",
      RUNTIME_URL: "http://127.0.0.1:0",
      RUN_CACHE_DIR: runCache,
      RUN_HOME: runHome,
      RUN_TMPDIR: runTmp,
      TEMP: runTmp,
      TMP: runTmp,
      TMPDIR: runTmp,
      TZ: "UTC",
    });
    if (
      JSON.stringify(Object.keys(environment).sort())
        !== JSON.stringify(
          [...NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_NAMES_V2].sort(),
        )
    ) {
      return fail(
        "NODE_TEST_COMMAND_V2_INPUT_INVALID",
        "Code-owned test environment no longer equals its normalized allowlist",
      );
    }
    const environmentInstanceHash = hashCanonicalJson({
      schema: "setfarm.node-test-command-environment-instance.v2",
      environment,
    });
    const started = Date.now();
    capturedProcess = await spawnBoundedNodeTestV2({
      sandboxExecutablePath: sandboxBefore.sandboxExecutablePath,
      sandboxProfile: sandboxBefore.sandboxProfile,
      nodeExecutablePath: input.nodeExecutablePath,
      testPath: input.testPath,
      cwd: input.bundleRoot,
      environment,
    });
    const child = capturedProcess;
    const finished = Date.now();
    const sandboxAfter =
      await acquireNetworkSandboxLaunchContextInternalV2();
    if (
      sandboxAfter.sandboxExecutableContentHash
        !== sandboxBefore.sandboxExecutableContentHash
      || sandboxAfter.sandboxExecutablePhysicalIdentityHash
        !== sandboxBefore.sandboxExecutablePhysicalIdentityHash
      || sandboxAfter.sandboxProfileHash !== sandboxBefore.sandboxProfileHash
    ) {
      child.stdout.fill(0);
      child.stderr.fill(0);
      return fail(
        "NODE_TEST_COMMAND_V2_HOST_DRIFT",
        "Network sandbox authority changed across generated-test execution",
      );
    }
    const termination: PrivateNodeTestCommandTerminationV2 =
      child.forcedReason !== null
        ? Object.freeze({
            status: "platform_terminated" as const,
            reason: child.forcedReason,
            exitCode: null,
            signal: "SIGKILL" as const,
          })
        : child.exitCode !== null
          ? Object.freeze({
              status: "exited" as const,
              exitCode: child.exitCode,
              signal: null,
            })
          : Object.freeze({
              status: "signal_exit" as const,
              exitCode: null,
              signal: child.signal ?? "SIGUNKNOWN",
            });
    return Object.freeze({
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date(finished).toISOString(),
      durationMs: finished - started,
      pid: child.pid,
      termination,
      stdout: child.stdout,
      stderr: child.stderr,
      tapSummary: parseNodeTestTapSummaryV2(child.stdout),
      runtimeTestMemberLocator: test.runtimeLogicalLocator,
      testContentHash: test.contentHash,
      testByteLength: test.byteLength,
      directArgvHash: hashCanonicalJson({
        schema: "setfarm.node-test-command-direct-argv-hash.v2",
        directArgv: [
          "node",
          "--test",
          test.runtimeLogicalLocator,
        ],
      }),
      environmentInstanceHash,
      normalizedEnvironmentHash:
        NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
      sandboxExecutableContentHash:
        sandboxBefore.sandboxExecutableContentHash,
      sandboxExecutablePhysicalIdentityHash:
        sandboxBefore.sandboxExecutablePhysicalIdentityHash,
      sandboxProfileHash: sandboxBefore.sandboxProfileHash,
    });
  } catch (error) {
    capturedProcess?.stdout.fill(0);
    capturedProcess?.stderr.fill(0);
    if (
      error instanceof PrivateNodeTestCommandErrorV2
      || (
        error !== null
        && typeof error === "object"
        && "code" in error
        && typeof error.code === "string"
        && error.code.startsWith("NETWORK_ISOLATION_V2_")
      )
    ) {
      throw error;
    }
    return fail(
      "NODE_TEST_COMMAND_V2_SPAWN_FAILED",
      "Private Node test execution failed at one typed platform boundary",
      error,
    );
  } finally {
    if (scratchRoot !== undefined) {
      try {
        rmSync(scratchRoot, { force: true, recursive: true });
      } catch (error) {
        capturedProcess?.stdout.fill(0);
        capturedProcess?.stderr.fill(0);
        throw new PrivateNodeTestCommandErrorV2(
          "NODE_TEST_COMMAND_V2_CLEANUP_FAILED",
          "Private Node test scratch allocation could not be destroyed",
          { cause: error },
        );
      }
    }
  }
}
