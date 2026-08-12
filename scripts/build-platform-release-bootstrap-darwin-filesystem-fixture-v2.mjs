#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdtempSync,
  openSync,
  opendirSync,
  readSync,
  realpathSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_NATIVE_BYTES_V2 = 4 * 1024 * 1024;
const DEPLOYMENT_TARGET_V2 = "13.0";
const TOOL_TIMEOUT_MILLISECONDS_V2 = 60_000;
const MAX_TOOL_OUTPUT_BYTES_V2 = 2 * 1024 * 1024;
const PROCESS_GROUP_DEATH_ATTEMPTS_V2 = 300;
const PROCESS_GROUP_DEATH_INTERVAL_MILLISECONDS_V2 = 10;
const PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2 = 3_000;
const PROCESS_READINESS_TIMEOUT_MILLISECONDS_V2 = 3_000;
const TEST_TIMEOUT_MILLISECONDS_V2 = 25;
const TEST_TIMEOUT_DURATION_SECONDS_V2 = "73.271828";
const PUBLICATION_POLICY_V2 =
  "descriptor_exclusive_copy_no_replace_fsync_post_fence_false_authority_v2";
const STAGE_WORKSPACE_POLICY_V2 =
  "retained_on_success_or_failure_until_caller_root_disposal_false_authority_v2";
const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = realpathSync(path.resolve(path.dirname(scriptPath), ".."));
const nativeRoot = path.join(
  repositoryRoot,
  "native/darwin",
);
const sourcePaths = Object.freeze([
  path.join(nativeRoot, "platform-release-bootstrap-filesystem-kernel-v2.c"),
  path.join(nativeRoot, "platform-release-bootstrap-filesystem-fixture-v2.c"),
]);
const headerPath = path.join(
  nativeRoot,
  "platform-release-bootstrap-filesystem-kernel-v2.h",
);

function failure(message, code = "DARWIN_FILESYSTEM_FIXTURE_BUILD_FAILED") {
  const error = new Error(message.slice(0, 1_000));
  error.code = code;
  return error;
}

function fail(message, code = "DARWIN_FILESYSTEM_FIXTURE_BUILD_FAILED") {
  throw failure(message, code);
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactArgv(argv) {
  if (
    argv.length !== 2
    || argv[0] !== "--out-file"
    || typeof argv[1] !== "string"
    || argv[1].length < 1
    || argv[1].length > 4_096
    || argv[1].includes("\0")
    || !path.isAbsolute(argv[1])
    || path.normalize(argv[1]) !== argv[1]
  ) {
    fail(
      "Usage: build-platform-release-bootstrap-darwin-filesystem-fixture-v2.mjs --out-file ABSOLUTE_PATH",
    );
  }
  return argv[1];
}

function exactPrivateOutputParent(outFile) {
  const parent = path.dirname(outFile);
  const observed = lstatSync(parent);
  if (
    observed.isSymbolicLink()
    || !observed.isDirectory()
    || realpathSync(parent) !== parent
    || (observed.mode & 0o7777) !== 0o700
    || observed.uid !== process.getuid()
    || observed.gid !== process.getgid()
    || parent === repositoryRoot
    || parent.startsWith(`${repositoryRoot}${path.sep}`)
  ) {
    fail(
      "Native fixture output parent must be one external empty real process-owned mode-0700 directory",
    );
  }
  const directory = opendirSync(parent, { bufferSize: 1 });
  const membershipErrors = [];
  try {
    if (directory.readSync() !== null) {
      fail(
        "Native fixture output parent must be one external empty real process-owned mode-0700 directory",
      );
    }
  } catch (error) {
    membershipErrors.push(error);
  }
  try {
    directory.closeSync();
  } catch (error) {
    membershipErrors.push(error);
  }
  if (membershipErrors.length > 1) {
    throw new AggregateError(
      membershipErrors,
      "Native fixture output parent membership and close both failed",
      { cause: membershipErrors[0] },
    );
  }
  if (membershipErrors.length === 1) throw membershipErrors[0];
  try {
    lstatSync(outFile);
    fail("Native fixture output must be absent");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return parent;
    throw error;
  }
}

function captureOrdinaryFile(filePath, maxBytes = MAX_NATIVE_BYTES_V2) {
  const real = realpathSync(filePath);
  const descriptor = openSync(
    real,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  const captureErrors = [];
  let captured;
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (
      !before.isFile()
      || before.size < 1n
      || before.size > BigInt(maxBytes)
    ) {
      fail("Native fixture input is not one exact bounded ordinary file");
    }
    const byteLength = Number(before.size);
    const bytes = Buffer.alloc(byteLength);
    let captureComplete = false;
    try {
      let offset = 0;
      while (offset < byteLength) {
        const count = readSync(
          descriptor,
          bytes,
          offset,
          byteLength - offset,
          offset,
        );
        if (count <= 0) {
          fail("Native fixture input changed during its exact capture");
        }
        offset += count;
      }
      const growthProbe = Buffer.alloc(1);
      let growthCount;
      try {
        growthCount = readSync(
          descriptor,
          growthProbe,
          0,
          1,
          byteLength,
        );
      } finally {
        growthProbe.fill(0);
      }
      const after = fstatSync(descriptor, { bigint: true });
      if (
        growthCount !== 0
        || !after.isFile()
        || before.dev !== after.dev
        || before.ino !== after.ino
        || before.mode !== after.mode
        || before.uid !== after.uid
        || before.gid !== after.gid
        || before.nlink !== after.nlink
        || before.size !== after.size
        || before.mtimeNs !== after.mtimeNs
        || before.ctimeNs !== after.ctimeNs
        || BigInt(bytes.byteLength) !== before.size
      ) {
        fail("Native fixture input changed during its exact capture");
      }
      captured = Object.freeze({
        bytes,
        byteLength: bytes.byteLength,
        sha256: sha256(bytes),
      });
      captureComplete = true;
    } finally {
      if (!captureComplete) bytes.fill(0);
    }
  } catch (error) {
    captureErrors.push(error);
  }
  try {
    closeSync(descriptor);
  } catch (error) {
    captureErrors.push(error);
  }
  if (captureErrors.length > 0 && captured !== undefined) {
    captured.bytes.fill(0);
  }
  if (captureErrors.length > 1) {
    throw new AggregateError(
      captureErrors,
      "Native fixture input capture and close both failed",
      { cause: captureErrors[0] },
    );
  }
  if (captureErrors.length === 1) throw captureErrors[0];
  return captured;
}

function assertCaptureCurrent(filePath, expected, maxBytes = MAX_NATIVE_BYTES_V2) {
  const current = captureOrdinaryFile(filePath, maxBytes);
  try {
    if (
      current.byteLength !== expected.byteLength
      || current.sha256 !== expected.sha256
    ) {
      fail("Native fixture build input changed during compilation");
    }
  } finally {
    current.bytes.fill(0);
  }
}

function processGroupAlive(processGroupId) {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    return !(error instanceof Error && "code" in error && error.code === "ESRCH");
  }
}

async function waitForProcessGroupDeath(
  processGroupId,
  testForceUnproven = false,
) {
  for (let attempt = 0; attempt < PROCESS_GROUP_DEATH_ATTEMPTS_V2; attempt += 1) {
    if (!testForceUnproven && !processGroupAlive(processGroupId)) return true;
    if (attempt + 1 < PROCESS_GROUP_DEATH_ATTEMPTS_V2) {
      await new Promise((resolve) =>
        setTimeout(resolve, PROCESS_GROUP_DEATH_INTERVAL_MILLISECONDS_V2));
    }
  }
  return !testForceUnproven && !processGroupAlive(processGroupId);
}

function primaryFirstFailure(primary, containmentErrors, message) {
  const errors = primary === undefined
    ? [...containmentErrors]
    : [primary, ...containmentErrors];
  if (errors.length === 0) return;
  if (errors.length === 1) throw errors[0];
  const aggregate = new AggregateError(
    errors,
    `${message}: ${errors[0] instanceof Error ? errors[0].message : "failed"}`,
    { cause: errors[0] },
  );
  aggregate.code = errors[0] instanceof Error && "code" in errors[0]
    ? String(errors[0].code)
    : "DARWIN_FILESYSTEM_FIXTURE_BUILD_FAILED";
  throw aggregate;
}

async function runExact(
  executable,
  argv,
  timeoutMilliseconds = TOOL_TIMEOUT_MILLISECONDS_V2,
  options = undefined,
) {
  const readinessToken = options?.readinessToken;
  const testFault = options?.testFault;
  const allowedTestFaults = new Set([
    "stdout_stream_error",
    "group_kill_failure_settlement_watchdog",
    "group_death_unproven",
  ]);
  if (
    options !== undefined
    && (
      options === null
      || typeof options !== "object"
      || Object.keys(options).some((key) =>
        key !== "readinessToken" && key !== "testFault")
      || (
        readinessToken !== undefined
        && (
          typeof readinessToken !== "string"
          || readinessToken.length < 1
          || readinessToken.length > 1_024
        )
      )
      || (
        testFault !== undefined
        && !allowedTestFaults.has(testFault)
      )
    )
  ) {
    fail("Darwin filesystem fixture tool readiness contract is invalid");
  }

  const child = spawn(executable, argv, {
    cwd: repositoryRoot,
    detached: true,
    env: {
      HOME: "/var/empty",
      LANG: "C",
      LC_ALL: "C",
      PATH: "/usr/bin:/bin",
      SOURCE_DATE_EPOCH: "0",
      TZ: "UTC",
    },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdoutChunks = [];
  const stderrChunks = [];
  const containmentErrors = [];
  let stdoutByteLength = 0;
  let stderrByteLength = 0;
  let firstCause;
  let terminationRequested = false;
  let childSettled = false;
  let settlementTimer;
  let executionTimer;
  let readinessTimer;
  let readinessObserved = readinessToken === undefined;
  let resolveSettlement;

  const settled = new Promise((resolve) => {
    resolveSettlement = (result) => {
      if (childSettled) return;
      childSettled = true;
      resolve(result);
    };
    child.once("close", (status, signal) => {
      resolveSettlement({ kind: "close", signal, status });
    });
  });

  const latchContainmentError = (message, code, cause) => {
    const error = failure(message, code);
    error.cause = cause;
    containmentErrors.push(error);
  };
  const signalDirectChildFallback = (force = false) => {
    if (!Number.isInteger(child.pid) || child.pid < 1) return;
    if (
      testFault === "group_kill_failure_settlement_watchdog"
      && !force
    ) {
      return;
    }
    try {
      child.kill("SIGKILL");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
        latchContainmentError(
          `Darwin filesystem fixture tool ${path.basename(executable)} direct-child fallback kill failed`,
          "DARWIN_FILESYSTEM_FIXTURE_TOOL_CHILD_KILL_FAILED",
          error,
        );
      }
    }
  };
  const armSettlementWatchdog = () => {
    if (childSettled || settlementTimer !== undefined) return;
    settlementTimer = setTimeout(() => {
      const settlementFailure = failure(
        `Darwin filesystem fixture tool ${path.basename(executable)} did not settle after termination`,
        "DARWIN_FILESYSTEM_FIXTURE_TOOL_SETTLEMENT_TIMEOUT",
      );
      if (firstCause === undefined) firstCause = settlementFailure;
      else containmentErrors.push(settlementFailure);
      signalDirectChildFallback(true);
      resolveSettlement({ kind: "watchdog", signal: null, status: null });
    }, PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2);
  };
  const requestTermination = () => {
    if (terminationRequested) return;
    terminationRequested = true;
    armSettlementWatchdog();
    if (!Number.isInteger(child.pid) || child.pid < 1) return;
    try {
      if (testFault === "group_kill_failure_settlement_watchdog") {
        throw failure(
          "Injected Darwin filesystem fixture process-group kill failure",
          "DARWIN_FILESYSTEM_FIXTURE_TEST_INJECTED_GROUP_KILL_FAILURE",
        );
      }
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
        latchContainmentError(
          `Darwin filesystem fixture tool ${path.basename(executable)} process-group kill failed`,
          "DARWIN_FILESYSTEM_FIXTURE_TOOL_GROUP_KILL_FAILED",
          error,
        );
        signalDirectChildFallback();
      }
    }
  };
  const latchFirstCause = (error, terminate) => {
    if (firstCause === undefined) firstCause = error;
    else containmentErrors.push(error);
    if (terminate) requestTermination();
  };
  const armExecutionTimeout = () => {
    if (executionTimer !== undefined || terminationRequested) return;
    executionTimer = setTimeout(() => {
      latchFirstCause(
        failure(
          `Darwin filesystem fixture tool ${path.basename(executable)} timed out after ${timeoutMilliseconds}ms`,
          "DARWIN_FILESYSTEM_FIXTURE_TOOL_TIMEOUT",
        ),
        true,
      );
    }, timeoutMilliseconds);
  };
  const observeReadiness = () => {
    if (readinessObserved || readinessToken === undefined) return;
    const stdout = Buffer.concat(stdoutChunks, stdoutByteLength).toString("utf8");
    if (!stdout.includes(readinessToken)) return;
    readinessObserved = true;
    if (readinessTimer !== undefined) clearTimeout(readinessTimer);
    readinessTimer = undefined;
    armExecutionTimeout();
  };
  const captureOutput = (name, chunk) => {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const currentByteLength = name === "stdout"
      ? stdoutByteLength
      : stderrByteLength;
    if (currentByteLength + bytes.byteLength > MAX_TOOL_OUTPUT_BYTES_V2) {
      latchFirstCause(
        failure(
          `Darwin filesystem fixture tool ${path.basename(executable)} exceeded the bounded ${name} capture`,
          "DARWIN_FILESYSTEM_FIXTURE_TOOL_OUTPUT_LIMIT",
        ),
        true,
      );
      return;
    }
    if (firstCause !== undefined) return;
    if (name === "stdout") {
      stdoutChunks.push(bytes);
      stdoutByteLength += bytes.byteLength;
      observeReadiness();
    } else {
      stderrChunks.push(bytes);
      stderrByteLength += bytes.byteLength;
    }
  };
  const streamFailure = (name, error) => {
    const wrapped = failure(
      `Darwin filesystem fixture tool ${path.basename(executable)} ${name} stream failed`,
      `DARWIN_FILESYSTEM_FIXTURE_TOOL_${name.toUpperCase()}_STREAM_FAILED`,
    );
    wrapped.cause = error;
    latchFirstCause(wrapped, true);
  };

  child.stdout.on("data", (chunk) => captureOutput("stdout", chunk));
  child.stderr.on("data", (chunk) => captureOutput("stderr", chunk));
  child.stdout.once("error", (error) => streamFailure("stdout", error));
  child.stderr.once("error", (error) => streamFailure("stderr", error));
  child.once("error", (error) => {
    const wrapped = failure(
      `Darwin filesystem fixture tool ${path.basename(executable)} could not start`,
      "DARWIN_FILESYSTEM_FIXTURE_TOOL_SPAWN_FAILED",
    );
    wrapped.cause = error;
    latchFirstCause(wrapped, true);
  });

  if (testFault === "stdout_stream_error") {
    queueMicrotask(() => {
      child.stdout.destroy(new Error(
        "Injected Darwin filesystem fixture stdout stream failure",
      ));
    });
  }

  if (readinessToken === undefined) {
    armExecutionTimeout();
  } else {
    readinessTimer = setTimeout(() => {
      latchFirstCause(
        failure(
          `Darwin filesystem fixture tool ${path.basename(executable)} readiness was not observed`,
          "DARWIN_FILESYSTEM_FIXTURE_TOOL_READINESS_TIMEOUT",
        ),
        true,
      );
    }, PROCESS_READINESS_TIMEOUT_MILLISECONDS_V2);
  }

  const result = await settled;
  if (executionTimer !== undefined) clearTimeout(executionTimer);
  if (readinessTimer !== undefined) clearTimeout(readinessTimer);
  if (settlementTimer !== undefined) clearTimeout(settlementTimer);

  if (
    readinessToken !== undefined
    && !readinessObserved
    && firstCause === undefined
  ) {
    firstCause = failure(
      `Darwin filesystem fixture tool ${path.basename(executable)} exited before readiness`,
      "DARWIN_FILESYSTEM_FIXTURE_TOOL_READINESS_MISSING",
    );
  }
  const stderr = Buffer.concat(stderrChunks, stderrByteLength).toString("utf8");
  if (
    firstCause === undefined
    && (result.status !== 0 || result.signal !== null)
  ) {
    firstCause = failure(
      `Darwin filesystem fixture tool failed: ${(
        stderr || `status=${String(result.status)} signal=${String(result.signal)}`
      ).slice(0, 500)}`,
    );
  }

  if (Number.isInteger(child.pid) && child.pid > 0 && processGroupAlive(child.pid)) {
    if (firstCause === undefined) {
      firstCause = failure(
        `Darwin filesystem fixture tool ${path.basename(executable)} left its process group alive`,
        "DARWIN_FILESYSTEM_FIXTURE_TOOL_GROUP_OUTLIVED_LEADER",
      );
    }
    requestTermination();
  }
  if (
    Number.isInteger(child.pid)
    && child.pid > 0
    && !await waitForProcessGroupDeath(
      child.pid,
      testFault === "group_death_unproven",
    )
  ) {
    containmentErrors.push(failure(
      `Darwin filesystem fixture tool ${path.basename(executable)} process-group death was not proven by ESRCH`,
      "DARWIN_FILESYSTEM_FIXTURE_TOOL_GROUP_DEATH_UNPROVEN",
    ));
  }

  primaryFirstFailure(
    firstCause,
    containmentErrors,
    "Darwin filesystem fixture tool and containment both failed",
  );
  return Buffer.concat(stdoutChunks, stdoutByteLength).toString("utf8").trim();
}

export async function runDarwinFilesystemFixtureRunnerFaultForTestV2(
  scenario,
) {
  if (
    scenario !== "stdout_stream_error"
    && scenario !== "group_kill_failure_settlement_watchdog"
    && scenario !== "group_death_unproven"
  ) {
    fail("Darwin filesystem fixture runner test scenario is invalid");
  }
  await runExact(
    "/bin/sleep",
    [TEST_TIMEOUT_DURATION_SECONDS_V2],
    scenario === "stdout_stream_error"
      ? TOOL_TIMEOUT_MILLISECONDS_V2
      : TEST_TIMEOUT_MILLISECONDS_V2,
    { testFault: scenario },
  );
  fail("Darwin filesystem fixture runner test scenario did not fail closed");
}

function runDescriptorOperationPrimaryFirst(
  openDescriptor,
  operation,
  message,
  afterDescriptorCloseForTest,
) {
  let descriptor;
  let primary;
  try {
    descriptor = openDescriptor();
    operation(descriptor);
  } catch (error) {
    primary = error;
  }
  const closeErrors = [];
  if (descriptor !== undefined) {
    const descriptorToClose = descriptor;
    descriptor = undefined;
    try {
      closeSync(descriptorToClose);
      afterDescriptorCloseForTest?.();
    } catch (error) {
      closeErrors.push(error);
    }
  }
  primaryFirstFailure(primary, closeErrors, message);
}

export function runDarwinFilesystemFixtureDescriptorSettlementFaultForTestV2(
  scenario,
) {
  if (
    scenario !== "operation_failure"
    && scenario !== "close_failure"
    && scenario !== "operation_and_close_failure"
  ) {
    fail("Darwin filesystem fixture descriptor test scenario is invalid");
  }
  const operationError = failure(
    "Darwin filesystem fixture forced descriptor operation failure",
    "DARWIN_FILESYSTEM_FIXTURE_DESCRIPTOR_OPERATION_FAILED",
  );
  const closeError = failure(
    "Darwin filesystem fixture forced descriptor close failure",
    "DARWIN_FILESYSTEM_FIXTURE_DESCRIPTOR_CLOSE_FAILED",
  );
  runDescriptorOperationPrimaryFirst(
    () => openSync(scriptPath, constants.O_RDONLY | constants.O_NOFOLLOW),
    () => {
      if (
        scenario === "operation_failure"
        || scenario === "operation_and_close_failure"
      ) {
        throw operationError;
      }
    },
    "Darwin filesystem fixture descriptor operation and close both failed",
    scenario === "close_failure"
      || scenario === "operation_and_close_failure"
      ? () => {
          throw closeError;
        }
      : undefined,
  );
  fail("Darwin filesystem fixture descriptor test scenario did not fail closed");
}

function fullSyncFile(filePath) {
  runDescriptorOperationPrimaryFirst(
    () => openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW),
    (descriptor) => fsyncSync(descriptor),
    "Native fixture file fsync and descriptor close both failed",
  );
}

function syncDirectory(directory) {
  runDescriptorOperationPrimaryFirst(
    () => openSync(
      directory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    ),
    (descriptor) => fsyncSync(descriptor),
    "Native fixture directory fsync and descriptor close both failed",
  );
}

function writeCapturedSource(filePath, bytes) {
  runDescriptorOperationPrimaryFirst(
    () => openSync(
      filePath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL
        | constants.O_NOFOLLOW,
      0o400,
    ),
    (descriptor) => {
      let offset = 0;
      while (offset < bytes.byteLength) {
        const count = writeSync(
          descriptor,
          bytes,
          offset,
          bytes.byteLength - offset,
          offset,
        );
        if (count < 1) fail("Native fixture captured source write ended early");
        offset += count;
      }
      fsyncSync(descriptor);
    },
    "Native fixture captured source write and descriptor close both failed",
  );
}

function samePublicationPin(observed, expected) {
  return (
    !observed.isSymbolicLink()
    && observed.isFile()
    && observed.dev === expected.dev
    && observed.ino === expected.ino
    && observed.uid === expected.uid
    && observed.gid === expected.gid
    && observed.mode === expected.mode
    && observed.nlink === expected.nlink
    && observed.size === expected.size
    && observed.mtimeNs === expected.mtimeNs
    && observed.ctimeNs === expected.ctimeNs
  );
}

function capturePinnedPublication(outFile, publicationPin, captured) {
  const beforeCapture = lstatSync(outFile, { bigint: true });
  if (!samePublicationPin(beforeCapture, publicationPin)) {
    fail("Native fixture publication changed before its exact fence");
  }
  const published = captureOrdinaryFile(outFile, MAX_NATIVE_BYTES_V2);
  const afterCapture = lstatSync(outFile, { bigint: true });
  if (
    !samePublicationPin(afterCapture, publicationPin)
    || published.sha256 !== captured.sha256
    || published.byteLength !== captured.byteLength
  ) {
    published.bytes.fill(0);
    fail("Native fixture publication failed its exact stable-identity fence");
  }
  return published;
}

function publishCapturedBinary(outFile, outputParent, captured) {
  const publicationErrors = [];
  let descriptor;
  let publicationPin;
  try {
    descriptor = openSync(
      outFile,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL
        | constants.O_NOFOLLOW,
      0o500,
    );
    const forcedPartialFailure =
      process.env
        .SETFARM_DARWIN_FILESYSTEM_FIXTURE_TEST_FORCE_PARTIAL_PUBLICATION_FAILURE_V2
        === "1";
    const publicationByteLength = forcedPartialFailure
      ? Math.min(16, captured.bytes.byteLength)
      : captured.bytes.byteLength;
    let offset = 0;
    while (offset < publicationByteLength) {
      const count = writeSync(
        descriptor,
        captured.bytes,
        offset,
        publicationByteLength - offset,
        offset,
      );
      if (count < 1) fail("Native fixture publication write ended early");
      offset += count;
    }
    fchmodSync(descriptor, 0o500);
    fsyncSync(descriptor);
    if (forcedPartialFailure) {
      fail("Native fixture publication stopped after a forced partial write");
    }
    publicationPin = fstatSync(descriptor, { bigint: true });
    if (
      !publicationPin.isFile()
      || publicationPin.uid !== BigInt(process.getuid())
      || publicationPin.gid !== BigInt(process.getgid())
      || (publicationPin.mode & 0o7777n) !== 0o500n
      || publicationPin.nlink !== 1n
      || publicationPin.size !== BigInt(captured.byteLength)
    ) {
      fail("Native fixture publication descriptor metadata is invalid");
    }
  } catch (error) {
    publicationErrors.push(error);
  }
  if (descriptor !== undefined) {
    try {
      closeSync(descriptor);
    } catch (error) {
      publicationErrors.push(error);
    }
    try {
      syncDirectory(outputParent);
    } catch (error) {
      publicationErrors.push(error);
    }
  }
  primaryFirstFailure(
    publicationErrors[0],
    publicationErrors.slice(1),
    "Native fixture publication and durability close both failed",
  );

  const published = capturePinnedPublication(
    outFile,
    publicationPin,
    captured,
  );
  return Object.freeze({ publicationPin, published });
}

export async function buildPlatformReleaseBootstrapDarwinFilesystemFixtureV2(
  outFile,
) {
  if (process.platform !== "darwin") {
    fail("Darwin filesystem native fixture requires macOS");
  }
  const outputParent = exactPrivateOutputParent(outFile);
  const xcrun = captureOrdinaryFile("/usr/bin/xcrun");
  const clangPath = await runExact(
    "/usr/bin/xcrun",
    ["--sdk", "macosx", "--find", "clang"],
  );
  const sdkPath = await runExact(
    "/usr/bin/xcrun",
    ["--sdk", "macosx", "--show-sdk-path"],
  );
  const sdkVersion = await runExact(
    "/usr/bin/xcrun",
    ["--sdk", "macosx", "--show-sdk-version"],
  );
  const sdkBuildVersion = await runExact(
    "/usr/bin/xcrun",
    ["--sdk", "macosx", "--show-sdk-build-version"],
  );
  const clang = captureOrdinaryFile(clangPath, 256 * 1024 * 1024);
  const lipo = captureOrdinaryFile("/usr/bin/lipo");
  const clangVersion = await runExact(clangPath, ["--version"]);
  const sources = [...sourcePaths, headerPath].map((filePath) => ({
    file: path.basename(filePath),
    capture: captureOrdinaryFile(filePath),
  }));
  const compileRecipeFlags = Object.freeze([
    "-std=c17",
    "-O2",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-fno-ident",
    `-mmacosx-version-min=${DEPLOYMENT_TARGET_V2}`,
    "-arch",
    "arm64",
    "-arch",
    "x86_64",
    "-isysroot",
    "MACOSX_SDK_V2",
  ]);
  const compileFlags = Object.freeze(
    compileRecipeFlags.map((entry) =>
      entry === "MACOSX_SDK_V2" ? sdkPath : entry),
  );
  const buildIdentity = {
    schema:
      "setfarm.platform-release-bootstrap-darwin-filesystem-fixture-build-identity.v2",
    admissionScope: "test_fixture",
    compileFlags: [...compileRecipeFlags],
    deploymentTarget: DEPLOYMENT_TARGET_V2,
    productionAuthority: false,
    publicationPolicy: PUBLICATION_POLICY_V2,
    signingAuthority: "adhoc_or_unsigned_test_fixture",
    sources: sources.map(({ file, capture }) => ({
      byteLength: capture.byteLength,
      file,
      sha256: capture.sha256,
    })),
    stageWorkspacePolicy: STAGE_WORKSPACE_POLICY_V2,
    toolchain: {
      clangByteLength: clang.byteLength,
      clangSha256: clang.sha256,
      clangVersionHash: sha256(Buffer.from(clangVersion, "utf8")),
      sdkBuildVersion,
      sdkVersion,
      xcrunByteLength: xcrun.byteLength,
      xcrunSha256: xcrun.sha256,
    },
    trustConclusion: "characterization_only",
  };
  const buildRecipeHash = sha256(
    Buffer.from(canonicalJson(buildIdentity), "utf8"),
  );
  const stageRoot = mkdtempSync(
    path.join(outputParent, ".setfarm-native-fixture-build-"),
  );
  chmodSync(stageRoot, 0o700);
  const stageBinary = path.join(stageRoot, "darwin-filesystem-fixture-v2");
  let captured;
  let published;
  try {
    for (const source of sources) {
      writeCapturedSource(
        path.join(stageRoot, source.file),
        source.capture.bytes,
      );
    }
    syncDirectory(stageRoot);
    if (
      process.env.SETFARM_DARWIN_FILESYSTEM_FIXTURE_TEST_FORCE_TOOL_TIMEOUT_V2
        === "1"
    ) {
      await runExact(
        "/bin/sleep",
        [TEST_TIMEOUT_DURATION_SECONDS_V2],
        TEST_TIMEOUT_MILLISECONDS_V2,
      );
    }
    if (
      process.env
        .SETFARM_DARWIN_FILESYSTEM_FIXTURE_TEST_FORCE_GRANDCHILD_TIMEOUT_V2
        === "1"
    ) {
      const marker = `setfarm-darwin-filesystem-grandchild-${path.basename(outputParent)}`;
      const readinessToken = `SETFARM_DARWIN_FILESYSTEM_GRANDCHILD_READY:${marker}`;
      await runExact(
        process.execPath,
        [
          "-e",
          "const { spawn } = require('node:child_process'); const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', process.argv[1]], { stdio: 'ignore' }); child.once('spawn', () => { process.stdout.write(process.argv[2]); setInterval(() => {}, 1000); }); child.once('error', () => process.exit(91));",
          marker,
          readinessToken,
        ],
        TEST_TIMEOUT_MILLISECONDS_V2,
        { readinessToken },
      );
    }
    if (
      process.env
        .SETFARM_DARWIN_FILESYSTEM_FIXTURE_TEST_FORCE_TOOL_OUTPUT_LIMIT_V2
        === "1"
    ) {
      await runExact(
        process.execPath,
        [
          "-e",
          `process.stdout.write(Buffer.alloc(${MAX_TOOL_OUTPUT_BYTES_V2 + 1}, 120));`,
        ],
      );
    }
    if (
      process.env.SETFARM_DARWIN_FILESYSTEM_FIXTURE_TEST_FORCE_TOOL_ERROR_V2
        === "1"
    ) {
      await runExact("/usr/bin/false", []);
    }
    if (
      process.env
        .SETFARM_DARWIN_FILESYSTEM_FIXTURE_TEST_FORCE_PARTIAL_COMPILER_OUTPUT_FAILURE_V2
        === "1"
    ) {
      await runExact(
        process.execPath,
        [
          "-e",
          "const fs = require('node:fs'); const fd = fs.openSync(process.argv[1], 'wx', 0o600); fs.writeSync(fd, Buffer.from('partial-compiler-output', 'utf8')); fs.fsyncSync(fd); fs.closeSync(fd); process.exit(23);",
          stageBinary,
        ],
      );
    }
    await runExact(clangPath, [
      ...compileFlags,
      ...sourcePaths.map((sourcePath) =>
        path.join(stageRoot, path.basename(sourcePath))),
      "-o",
      stageBinary,
    ]);
    assertCaptureCurrent("/usr/bin/xcrun", xcrun);
    assertCaptureCurrent(clangPath, clang, 256 * 1024 * 1024);
    assertCaptureCurrent("/usr/bin/lipo", lipo);
    for (const source of sources) {
      assertCaptureCurrent(
        path.join(nativeRoot, source.file),
        source.capture,
      );
    }
    if (
      await runExact(
        "/usr/bin/xcrun",
        ["--sdk", "macosx", "--show-sdk-path"],
      ) !== sdkPath
      || await runExact(clangPath, ["--version"]) !== clangVersion
      || await runExact(
        "/usr/bin/xcrun",
        ["--sdk", "macosx", "--show-sdk-version"],
      ) !== sdkVersion
      || await runExact(
        "/usr/bin/xcrun",
        ["--sdk", "macosx", "--show-sdk-build-version"],
      ) !== sdkBuildVersion
    ) {
      fail("Native fixture toolchain selection changed during compilation");
    }
    const architectureSet = (await runExact(
      "/usr/bin/lipo",
      ["-archs", stageBinary],
    ))
      .split(/\s+/u)
      .filter(Boolean)
      .sort();
    if (canonicalJson(architectureSet) !== canonicalJson(["arm64", "x86_64"])) {
      fail("Native fixture binary does not contain the exact universal architecture set");
    }
    chmodSync(stageBinary, 0o500);
    fullSyncFile(stageBinary);
    syncDirectory(stageRoot);
    captured = captureOrdinaryFile(stageBinary, MAX_NATIVE_BYTES_V2);
    const stageStat = lstatSync(stageBinary);
    if (
      stageStat.nlink !== 1
      || stageStat.uid !== process.getuid()
      || stageStat.gid !== process.getgid()
      || (stageStat.mode & 0o7777) !== 0o500
    ) {
      fail("Native fixture compiler output has invalid metadata");
    }
    if (
      process.env
        .SETFARM_DARWIN_FILESYSTEM_FIXTURE_TEST_FORCE_POST_COMPILE_FAILURE_V2
        === "1"
    ) {
      fail("Native fixture stopped after a forced post-compile failure");
    }
    if (
      process.env
        .SETFARM_DARWIN_FILESYSTEM_FIXTURE_TEST_PAUSE_BEFORE_PUBLICATION_V2
        === "1"
    ) {
      await runExact("/bin/sleep", ["1"]);
    }
    const publication = publishCapturedBinary(outFile, outputParent, captured);
    published = publication.published;
    if (
      process.env
        .SETFARM_DARWIN_FILESYSTEM_FIXTURE_TEST_FORCE_POST_PUBLICATION_FAILURE_V2
        === "1"
    ) {
      fail("Native fixture stopped after a forced post-publication failure");
    }
    const finalPublished = capturePinnedPublication(
      outFile,
      publication.publicationPin,
      captured,
    );
    published.bytes.fill(0);
    published = finalPublished;
    return Object.freeze({
      schema:
        "setfarm.platform-release-bootstrap-darwin-filesystem-fixture-build-receipt.v2",
      admissionScope: "test_fixture",
      binary: Object.freeze({
        architectureSet: Object.freeze(["arm64", "x86_64"]),
        byteLength: published.byteLength,
        mode: "0500",
        sha256: published.sha256,
        stableIdentity: Object.freeze({
          objectKind: "ordinary_file",
          device: publication.publicationPin.dev.toString(),
          inode: publication.publicationPin.ino.toString(),
        }),
      }),
      buildRecipeHash,
      productionAuthority: false,
      publicationPolicy: PUBLICATION_POLICY_V2,
      signingAuthority: "adhoc_or_unsigned_test_fixture",
      stageWorkspacePolicy: STAGE_WORKSPACE_POLICY_V2,
      trustConclusion: "characterization_only",
    });
  } finally {
    for (const source of sources) source.capture.bytes.fill(0);
    xcrun.bytes.fill(0);
    clang.bytes.fill(0);
    lipo.bytes.fill(0);
    captured?.bytes.fill(0);
    published?.bytes.fill(0);
  }
}


async function main() {
  const receipt = await buildPlatformReleaseBootstrapDarwinFilesystemFixtureV2(
    exactArgv(process.argv.slice(2)),
  );
  process.stdout.write(Buffer.from(canonicalJson(receipt), "utf8"));
}

if (process.argv[1] && realpathSync(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    const code = error instanceof Error && "code" in error
      ? String(error.code)
      : "DARWIN_FILESYSTEM_FIXTURE_BUILD_FAILED";
    process.stderr.write(
      `[build-platform-release-bootstrap-darwin-filesystem-fixture-v2] ${code}: ${
        error instanceof Error ? error.message : "failed"
      }\n`,
    );
    process.exitCode = 1;
  });
}
