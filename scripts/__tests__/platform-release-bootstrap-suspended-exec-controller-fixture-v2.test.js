import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  runSuspendedExecControllerFixtureDescriptorSettlementFaultForTestV2,
  runSuspendedExecControllerFixtureRunnerFaultForTestV2,
} from "../build-platform-release-bootstrap-suspended-exec-controller-fixture-v2.mjs";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUILD_TIMEOUT_MILLISECONDS_V2 = 120_000;
const TEST_TIMEOUT_DURATION_SECONDS_V2 = "73.271828";
const STAGE_PREFIX_V2 = ".setfarm-suspended-exec-build-";
const STAGE_SOURCE_NAME_V2 =
  "platform-release-bootstrap-suspended-exec-controller-fixture-v2.c";
const STAGE_BINARY_NAME_V2 = "suspended-exec-controller-v2";
const builder = join(
  repositoryRoot,
  "scripts",
  "build-platform-release-bootstrap-suspended-exec-controller-fixture-v2.mjs",
);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertBoundedMembershipAndCaptureSourceContract() {
  const source = readFileSync(builder, "utf8");
  const membership = source.slice(
    source.indexOf("function exactPrivateOutputParent"),
    source.indexOf("function captureOrdinaryFile"),
  );
  assert.match(membership, /opendirSync\(parent, \{ bufferSize: 1 \}\)/u);
  assert.equal(membership.match(/directory\.readSync\(\)/gu)?.length, 1);
  assert.doesNotMatch(membership, /readdirSync\(parent\)/u);
  assert.match(
    membership,
    /new AggregateError\(\s*membershipErrors,[\s\S]*cause: membershipErrors\[0\]/u,
  );

  const capture = source.slice(
    source.indexOf("function captureOrdinaryFile"),
    source.indexOf("function assertCaptureCurrent"),
  );
  assert.doesNotMatch(capture, /lstatSync|readFileSync/u);
  const orderedNeedles = [
    "constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK",
    "const before = fstatSync(descriptor, { bigint: true })",
    "!before.isFile()",
    "before.size > BigInt(maxBytes)",
    "const bytes = Buffer.alloc(byteLength)",
    "const count = readSync(",
    "byteLength - offset",
    "offset,",
    "const growthProbe = Buffer.alloc(1)",
    "growthCount = readSync(",
    "byteLength,",
    "const after = fstatSync(descriptor, { bigint: true })",
  ];
  let cursor = -1;
  for (const needle of orderedNeedles) {
    const next = capture.indexOf(needle, cursor + 1);
    assert.ok(next > cursor, `missing ordered capture contract: ${needle}`);
    cursor = next;
  }
  assert.match(
    capture,
    /new AggregateError\(\s*captureErrors,[\s\S]*cause: captureErrors\[0\]/u,
  );

  assert.doesNotMatch(
    source,
    /\b(?:linkSync|renameSync|rmdirSync|rmSync|unlinkSync)\b/u,
  );
  assert.doesNotMatch(source, /spawnSync|maxBuffer/u);
  const runner = source.slice(
    source.indexOf("function processGroupAlive"),
    source.indexOf("function syncDirectory"),
  );
  assert.match(runner, /spawn\(executable, argv, \{/u);
  assert.match(runner, /detached: true/u);
  assert.match(runner, /stdio: \["ignore", "pipe", "pipe"\]/u);
  assert.match(runner, /MAX_TOOL_OUTPUT_BYTES_V2/u);
  assert.match(runner, /child\.stdout\.once\("error"/u);
  assert.match(runner, /child\.stderr\.once\("error"/u);
  assert.match(runner, /PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2/u);
  assert.match(runner, /resolveSettlement\(\{ kind: "watchdog"/u);
  assert.match(runner, /process\.kill\(-child\.pid, "SIGKILL"\)/u);
  assert.match(runner, /child\.kill\("SIGKILL"\)/u);
  assert.match(runner, /error\.code === "ESRCH"/u);
  assert.match(
    runner,
    /waitForProcessGroupDeath\(\s*child\.pid,\s*testFault === "group_death_unproven",\s*\)/u,
  );
  assert.match(runner, /signalDirectChildFallback\(true\)/u);
  assert.match(runner, /testFault === "stdout_stream_error"/u);
  assert.match(runner, /testFault === "stderr_stream_error"/u);
  assert.match(runner, /testFault === "group_kill_failure_settlement_watchdog"/u);
  assert.match(runner, /readinessToken/u);
  assert.match(runner, /SUSPENDED_EXEC_FIXTURE_TOOL_READINESS_TIMEOUT/u);
  assert.match(runner, /primaryFirstFailure\(/u);
  const testAdmission = runner.slice(
    runner.indexOf(
      "export async function runSuspendedExecControllerFixtureRunnerFaultForTestV2",
    ),
  );
  assert.match(
    testAdmission,
    /RunnerFaultForTestV2\(\s*scenario,\s*\)/u,
  );
  assert.match(
    testAdmission,
    /await runExact\(\s*"\/bin\/sleep",\s*\[TEST_TIMEOUT_DURATION_SECONDS_V2\]/u,
  );
  assert.doesNotMatch(testAdmission, /RunnerFaultForTestV2\([^)]*executable/u);
  assert.doesNotMatch(testAdmission, /RunnerFaultForTestV2\([^)]*argv/u);

  const publication = source.slice(
    source.indexOf("function samePublicationPin"),
    source.indexOf("export async function buildPlatformRelease"),
  );
  assert.match(publication, /observed\.dev === expected\.dev/u);
  assert.match(publication, /observed\.ino === expected\.ino/u);
  const publicationNeedles = [
    "constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL",
    "writeSync(",
    "fchmodSync(descriptor, 0o500)",
    "fsyncSync(descriptor)",
    "publicationPin = fstatSync(descriptor, { bigint: true })",
    "closeSync(descriptor)",
    "syncDirectory(outputParent)",
    "capturePinnedPublication(",
  ];
  let publicationCursor = -1;
  for (const needle of publicationNeedles) {
    const next = publication.indexOf(needle, publicationCursor + 1);
    assert.ok(next > publicationCursor, `missing ordered publication contract: ${needle}`);
    publicationCursor = next;
  }

  const finalFence = source.slice(
    source.indexOf("const publication = publishCapturedBinary"),
    source.indexOf("return Object.freeze({", source.indexOf(
      "const publication = publishCapturedBinary",
    )),
  );
  assert.match(
    finalFence,
    /capturePinnedPublication\(\s*outFile,\s*publication\.publicationPin,\s*captured,\s*\)/u,
  );
  assert.match(
    source,
    /device: publication\.publicationPin\.dev\.toString\(\)/u,
  );
  assert.match(
    source,
    /inode: publication\.publicationPin\.ino\.toString\(\)/u,
  );
}

function assertDescriptorSettlementSourceContract() {
  const source = readFileSync(builder, "utf8");
  const settlement = source.slice(
    source.indexOf("function runDescriptorOperationPrimaryFirst"),
    source.indexOf("function samePublicationPin"),
  );
  assert.match(
    settlement,
    /const descriptorToClose = descriptor;[\s\S]*descriptor = undefined;[\s\S]*closeSync\(descriptorToClose\);/u,
  );
  assert.equal(
    settlement.match(/closeSync\(descriptorToClose\)/gu)?.length,
    1,
  );
  assert.match(
    settlement,
    /primaryFirstFailure\(primary, closeErrors, message\);/u,
  );
  assert.doesNotMatch(settlement, /finally\s*\{[\s\S]*closeSync/u);
  assert.match(
    settlement,
    /constants\.O_RDONLY \| constants\.O_DIRECTORY \| constants\.O_NOFOLLOW/u,
  );
  const seam = source.slice(
    source.indexOf(
      "export function runSuspendedExecControllerFixtureDescriptorSettlementFaultForTestV2",
    ),
    source.indexOf("function syncDirectory"),
  );
  assert.match(
    seam,
    /runSuspendedExecControllerFixtureDescriptorSettlementFaultForTestV2\(\s*scenario,\s*\)/u,
  );
  assert.match(
    seam,
    /openSync\(scriptPath, constants\.O_RDONLY \| constants\.O_NOFOLLOW\)/u,
  );
  assert.match(seam, /"operation_failure"/u);
  assert.match(seam, /"close_failure"/u);
  assert.match(seam, /"operation_and_close_failure"/u);
  assert.doesNotMatch(seam, /process\.env|callback|filePath|directory/u);
}

function build(outFile, extraEnv = {}) {
  return spawnSync(process.execPath, [builder, "--out-file", outFile], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      LANG: "tr_TR.UTF-8",
      PATH: "/hostile-path",
      SOURCE_DATE_EPOCH: "999999999",
      ...extraEnv,
    },
    maxBuffer: 2 * 1024 * 1024,
    timeout: BUILD_TIMEOUT_MILLISECONDS_V2,
    killSignal: "SIGKILL",
  });
}

function buildAsync(outFile, extraEnv = {}) {
  const child = spawn(process.execPath, [builder, "--out-file", outFile], {
    cwd: repositoryRoot,
    env: {
      LANG: "tr_TR.UTF-8",
      PATH: "/hostile-path",
      SOURCE_DATE_EPOCH: "999999999",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  return {
    child,
    completed: new Promise((resolve) => {
      child.once("close", (status, signal) => resolve({
        signal,
        status,
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8"),
      }));
    }),
  };
}

async function captureFailure(action) {
  try {
    await action();
  } catch (error) {
    return error;
  }
  throw new Error("expected action to fail");
}

function retainedStageRoot(root) {
  const stageNames = readdirSync(root).filter((name) =>
    name.startsWith(STAGE_PREFIX_V2));
  assert.equal(stageNames.length, 1);
  const stageRoot = join(root, stageNames[0]);
  assert.equal(statSync(stageRoot).isDirectory(), true);
  assert.equal(statSync(stageRoot).mode & 0o7777, 0o700);
  return stageRoot;
}

function assertRetainedPartialStage(root) {
  const stageRoot = retainedStageRoot(root);
  assert.deepEqual(readdirSync(stageRoot), [STAGE_SOURCE_NAME_V2]);
  assert.equal(statSync(join(stageRoot, STAGE_SOURCE_NAME_V2)).mode & 0o7777, 0o400);
}

async function waitForRetainedStage(root) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    if (readdirSync(root).some((name) => name.startsWith(STAGE_PREFIX_V2))) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("retained stage did not appear");
}

async function awaitBounded(completed, milliseconds = 10_000) {
  let timer;
  try {
    return await Promise.race([
      completed,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("builder did not settle within test bound")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

describe("Darwin suspended-exec controller fixture builder", () => {
  it("publishes deterministic universal bytes under an exact false-authority compile contract", {
    skip: process.platform !== "darwin",
  }, () => {
    const firstAlias = mkdtempSync(join(tmpdir(), "setfarm-suspended-exec-a-"));
    const secondAlias = mkdtempSync(join(tmpdir(), "setfarm-suspended-exec-b-"));
    const firstRoot = realpathSync(firstAlias);
    const secondRoot = realpathSync(secondAlias);
    try {
      chmodSync(firstRoot, 0o700);
      chmodSync(secondRoot, 0o700);
      const firstPath = join(firstRoot, "controller");
      const secondPath = join(secondRoot, "controller");
      const first = build(firstPath);
      const second = build(secondPath);
      assert.equal(first.status, 0, first.stderr);
      assert.equal(second.status, 0, second.stderr);
      assert.equal(first.signal, null);
      assert.equal(first.stdout.endsWith("\n"), false);

      const firstBytes = readFileSync(firstPath);
      const secondBytes = readFileSync(secondPath);
      const receipt = JSON.parse(first.stdout);
      const secondReceipt = JSON.parse(second.stdout);
      assert.equal(receipt.buildRecipeHash, secondReceipt.buildRecipeHash);
      assert.equal(receipt.binary.sha256, secondReceipt.binary.sha256);
      const { stableIdentity: firstStableIdentity, ...firstStableBinary } =
        receipt.binary;
      const { stableIdentity: secondStableIdentity, ...secondStableBinary } =
        secondReceipt.binary;
      assert.deepEqual(
        { ...receipt, binary: firstStableBinary },
        { ...secondReceipt, binary: secondStableBinary },
      );
      assert.deepEqual(Object.keys(receipt).sort(), [
        "admissionScope",
        "binary",
        "buildRecipeHash",
        "compileContract",
        "credentialUse",
        "descriptorExecution",
        "libprocApiStability",
        "productionAuthority",
        "publicationPolicy",
        "schema",
        "signingAuthority",
        "stageWorkspacePolicy",
        "trustConclusion",
      ]);
      assert.deepEqual(Object.keys(receipt.binary).sort(), [
        "architectureSet",
        "byteLength",
        "mode",
        "sha256",
        "stableIdentity",
      ]);
      assert.deepEqual(Object.keys(receipt.compileContract).sort(), [
        "compileFlags",
        "deploymentTarget",
        "frameworks",
        "spawnFlags",
      ]);
      assert.deepEqual(firstBytes, secondBytes);
      assert.equal(
        receipt.schema,
        "setfarm.platform-release-bootstrap-suspended-exec-controller-fixture-build-receipt.v2",
      );
      assert.equal(receipt.admissionScope, "test_fixture");
      assert.equal(receipt.productionAuthority, false);
      assert.equal(receipt.credentialUse, "none");
      assert.equal(receipt.descriptorExecution, false);
      assert.equal(receipt.libprocApiStability, "private_unproven");
      assert.equal(receipt.trustConclusion, "characterization_only");
      assert.equal(receipt.signingAuthority, "adhoc_or_unsigned_test_fixture");
      assert.equal(
        receipt.publicationPolicy,
        "descriptor_exclusive_copy_no_replace_fsync_post_fence_false_authority_v2",
      );
      assert.equal(
        receipt.stageWorkspacePolicy,
        "retained_on_success_or_failure_until_caller_root_disposal_false_authority_v2",
      );
      assert.deepEqual(receipt.binary.architectureSet, ["arm64", "x86_64"]);
      assert.equal(receipt.binary.byteLength, firstBytes.byteLength);
      assert.equal(receipt.binary.sha256, sha256(firstBytes));
      assert.equal(receipt.binary.mode, "0500");
      const firstStat = statSync(firstPath, { bigint: true });
      const secondStat = statSync(secondPath, { bigint: true });
      assert.deepEqual(firstStableIdentity, {
        objectKind: "ordinary_file",
        device: firstStat.dev.toString(),
        inode: firstStat.ino.toString(),
      });
      assert.deepEqual(secondStableIdentity, {
        objectKind: "ordinary_file",
        device: secondStat.dev.toString(),
        inode: secondStat.ino.toString(),
      });
      assert.match(receipt.buildRecipeHash, /^[a-f0-9]{64}$/u);
      assert.equal(statSync(firstPath).mode & 0o7777, 0o500);
      assert.equal(receipt.compileContract.deploymentTarget, "13.0");
      assert.deepEqual(
        receipt.compileContract.frameworks,
        ["CoreFoundation", "Security"],
      );
      assert.deepEqual(receipt.compileContract.spawnFlags, [
        "POSIX_SPAWN_START_SUSPENDED",
        "POSIX_SPAWN_CLOEXEC_DEFAULT",
      ]);
      assert.deepEqual(receipt.compileContract.compileFlags, [
        "-std=c17",
        "-O2",
        "-Wall",
        "-Wextra",
        "-Werror",
        "-fno-ident",
        "-mmacosx-version-min=13.0",
        "-arch",
        "arm64",
        "-arch",
        "x86_64",
        "-isysroot",
        "MACOSX_SDK_V2",
        "-framework",
        "Security",
        "-framework",
        "CoreFoundation",
      ]);

      const architectures = spawnSync("/usr/bin/lipo", ["-archs", firstPath], {
        encoding: "utf8",
        env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" },
      });
      assert.equal(architectures.status, 0, architectures.stderr);
      assert.deepEqual(
        new Set(architectures.stdout.trim().split(/\s+/u)),
        new Set(["arm64", "x86_64"]),
      );

      const firstStage = retainedStageRoot(firstRoot);
      const secondStage = retainedStageRoot(secondRoot);
      assert.deepEqual(readdirSync(firstStage).sort(), [
        STAGE_BINARY_NAME_V2,
        STAGE_SOURCE_NAME_V2,
      ].sort());
      assert.deepEqual(readdirSync(secondStage).sort(), [
        STAGE_BINARY_NAME_V2,
        STAGE_SOURCE_NAME_V2,
      ].sort());
      assert.deepEqual(readFileSync(join(firstStage, STAGE_BINARY_NAME_V2)), firstBytes);
      assert.deepEqual(readFileSync(join(secondStage, STAGE_BINARY_NAME_V2)), secondBytes);
      assert.equal(
        statSync(join(firstStage, STAGE_BINARY_NAME_V2)).mode & 0o7777,
        0o500,
      );

      const repeated = build(firstPath);
      assert.equal(repeated.status, 1);
      assert.equal(sha256(readFileSync(firstPath)), receipt.binary.sha256);
    } finally {
      rmSync(firstAlias, { recursive: true, force: true });
      rmSync(secondAlias, { recursive: true, force: true });
    }
  });

  it("rejects unknown arguments and non-private output parents", {
    skip: process.platform !== "darwin",
  }, () => {
    const badArgv = spawnSync(process.execPath, [builder, "--unknown"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    assert.equal(badArgv.status, 1);
    assert.match(badArgv.stderr, /Usage:/u);

    const publicAlias = mkdtempSync(join(tmpdir(), "setfarm-suspended-exec-mode-"));
    const publicRoot = realpathSync(publicAlias);
    try {
      chmodSync(publicRoot, 0o755);
      const result = build(join(publicRoot, "controller"));
      assert.equal(result.status, 1);
      assert.match(result.stderr, /mode-0700 directory/u);
    } finally {
      rmSync(publicAlias, { recursive: true, force: true });
    }

    const nonemptyAlias = mkdtempSync(
      join(tmpdir(), "setfarm-suspended-exec-over-limit-"),
    );
    const nonemptyRoot = realpathSync(nonemptyAlias);
    try {
      chmodSync(nonemptyRoot, 0o700);
      for (let index = 0; index < 4_097; index += 1) {
        writeFileSync(join(nonemptyRoot, `foreign-${index}`), "", { mode: 0o600 });
      }
      const result = build(join(nonemptyRoot, "controller"));
      assert.equal(result.status, 1);
      assert.match(result.stderr, /external empty/u);
    } finally {
      rmSync(nonemptyAlias, { recursive: true, force: true });
    }

    const repositoryResult = build(join(repositoryRoot, "forbidden-controller"));
    assert.equal(repositoryResult.status, 1);
    assert.match(repositoryResult.stderr, /external empty/u);

    const timeoutAlias = mkdtempSync(
      join(tmpdir(), "setfarm-suspended-exec-timeout-"),
    );
    const timeoutRoot = realpathSync(timeoutAlias);
    try {
      chmodSync(timeoutRoot, 0o700);
      const timeoutOutput = join(timeoutRoot, "controller");
      const timedOut = build(timeoutOutput, {
        SETFARM_SUSPENDED_EXEC_TEST_FORCE_TOOL_TIMEOUT_V2: "1",
      });
      assert.equal(timedOut.status, 1);
      assert.equal(timedOut.signal, null);
      assert.equal(timedOut.error, undefined);
      assert.match(
        timedOut.stderr,
        /SUSPENDED_EXEC_FIXTURE_TOOL_TIMEOUT:.*timed out/u,
      );
      assert.equal(existsSync(timeoutOutput), false);
      assertRetainedPartialStage(timeoutRoot);
      const processes = spawnSync("/bin/ps", ["-ax", "-o", "command="], {
        encoding: "utf8",
        env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" },
        maxBuffer: 8 * 1024 * 1024,
        timeout: 2_000,
        killSignal: "SIGKILL",
      });
      assert.equal(processes.status, 0, processes.stderr);
      assert.equal(
        processes.stdout.split("\n").some((line) =>
          line.includes(`/bin/sleep ${TEST_TIMEOUT_DURATION_SECONDS_V2}`)),
        false,
      );
    } finally {
      rmSync(timeoutAlias, { recursive: true, force: true });
    }
  });

  it("retains partial, compiler-error, compiled, and partial-publication evidence", {
    skip: process.platform !== "darwin",
  }, () => {
    const outputLimitAlias = mkdtempSync(
      join(tmpdir(), "setfarm-suspended-exec-output-limit-"),
    );
    const toolErrorAlias = mkdtempSync(
      join(tmpdir(), "setfarm-suspended-exec-tool-error-"),
    );
    const partialCompilerAlias = mkdtempSync(
      join(tmpdir(), "setfarm-suspended-exec-partial-compiler-"),
    );
    const compiledAlias = mkdtempSync(
      join(tmpdir(), "setfarm-suspended-exec-compiled-"),
    );
    const partialPublicationAlias = mkdtempSync(
      join(tmpdir(), "setfarm-suspended-exec-partial-publication-"),
    );
    const postPublicationAlias = mkdtempSync(
      join(tmpdir(), "setfarm-suspended-exec-post-publication-"),
    );
    const aliases = [
      outputLimitAlias,
      toolErrorAlias,
      partialCompilerAlias,
      compiledAlias,
      partialPublicationAlias,
      postPublicationAlias,
    ];
    try {
      for (const alias of aliases) chmodSync(realpathSync(alias), 0o700);

      const outputLimitRoot = realpathSync(outputLimitAlias);
      const outputLimitPath = join(outputLimitRoot, "controller");
      const outputLimited = build(outputLimitPath, {
        SETFARM_SUSPENDED_EXEC_TEST_FORCE_TOOL_OUTPUT_LIMIT_V2: "1",
      });
      assert.equal(outputLimited.status, 1);
      assert.match(outputLimited.stderr, /SUSPENDED_EXEC_FIXTURE_TOOL_OUTPUT_LIMIT/u);
      assert.equal(existsSync(outputLimitPath), false);
      assertRetainedPartialStage(outputLimitRoot);

      const toolErrorRoot = realpathSync(toolErrorAlias);
      const toolErrorPath = join(toolErrorRoot, "controller");
      const toolError = build(toolErrorPath, {
        SETFARM_SUSPENDED_EXEC_TEST_FORCE_TOOL_ERROR_V2: "1",
      });
      assert.equal(toolError.status, 1);
      assert.match(toolError.stderr, /SUSPENDED_EXEC_FIXTURE_BUILD_FAILED/u);
      assert.equal(existsSync(toolErrorPath), false);
      assertRetainedPartialStage(toolErrorRoot);

      const partialCompilerRoot = realpathSync(partialCompilerAlias);
      const partialCompilerPath = join(partialCompilerRoot, "controller");
      const partialCompiler = build(partialCompilerPath, {
        SETFARM_SUSPENDED_EXEC_TEST_FORCE_PARTIAL_COMPILER_OUTPUT_FAILURE_V2: "1",
      });
      assert.equal(partialCompiler.status, 1);
      assert.equal(existsSync(partialCompilerPath), false);
      const partialCompilerStage = retainedStageRoot(partialCompilerRoot);
      assert.deepEqual(readdirSync(partialCompilerStage).sort(), [
        STAGE_BINARY_NAME_V2,
        STAGE_SOURCE_NAME_V2,
      ].sort());
      assert.equal(
        readFileSync(join(partialCompilerStage, STAGE_BINARY_NAME_V2), "utf8"),
        "partial-compiler-output",
      );

      const compiledRoot = realpathSync(compiledAlias);
      const compiledPath = join(compiledRoot, "controller");
      const compiledFailure = build(compiledPath, {
        SETFARM_SUSPENDED_EXEC_TEST_FORCE_POST_COMPILE_FAILURE_V2: "1",
      });
      assert.equal(compiledFailure.status, 1);
      assert.equal(existsSync(compiledPath), false);
      const compiledStage = retainedStageRoot(compiledRoot);
      assert.deepEqual(readdirSync(compiledStage).sort(), [
        STAGE_BINARY_NAME_V2,
        STAGE_SOURCE_NAME_V2,
      ].sort());
      const compiledBytes = readFileSync(join(compiledStage, STAGE_BINARY_NAME_V2));
      assert.ok(compiledBytes.byteLength > 16);

      const partialPublicationRoot = realpathSync(partialPublicationAlias);
      const partialPublicationPath = join(partialPublicationRoot, "controller");
      const partialPublication = build(partialPublicationPath, {
        SETFARM_SUSPENDED_EXEC_TEST_FORCE_PARTIAL_PUBLICATION_FAILURE_V2: "1",
      });
      assert.equal(partialPublication.status, 1);
      assert.match(partialPublication.stderr, /forced partial write/u);
      const partialBytes = readFileSync(partialPublicationPath);
      assert.equal(partialBytes.byteLength, 16);
      const partialStage = retainedStageRoot(partialPublicationRoot);
      const retainedBinary = readFileSync(join(partialStage, STAGE_BINARY_NAME_V2));
      assert.ok(retainedBinary.byteLength > partialBytes.byteLength);
      assert.deepEqual(partialBytes, retainedBinary.subarray(0, 16));
      assert.equal(statSync(partialPublicationPath).mode & 0o7777, 0o500);

      const postPublicationRoot = realpathSync(postPublicationAlias);
      const postPublicationPath = join(postPublicationRoot, "controller");
      const postPublication = build(postPublicationPath, {
        SETFARM_SUSPENDED_EXEC_TEST_FORCE_POST_PUBLICATION_FAILURE_V2: "1",
      });
      assert.equal(postPublication.status, 1);
      const postPublicationBytes = readFileSync(postPublicationPath);
      assert.deepEqual(
        postPublicationBytes,
        readFileSync(join(
          retainedStageRoot(postPublicationRoot),
          STAGE_BINARY_NAME_V2,
        )),
      );
      assert.ok(postPublicationBytes.byteLength > 16);
    } finally {
      for (const alias of aliases) rmSync(alias, { recursive: true, force: true });
    }
  });

  it("kills a readiness-proven timed-out tool's whole process group and proves the grandchild absent", {
    skip: process.platform !== "darwin",
  }, () => {
    const alias = mkdtempSync(join(tmpdir(), "setfarm-suspended-exec-grandchild-"));
    const root = realpathSync(alias);
    try {
      chmodSync(root, 0o700);
      const output = join(root, "controller");
      const marker = `setfarm-suspended-exec-grandchild-${basename(root)}`;
      const result = build(output, {
        SETFARM_SUSPENDED_EXEC_TEST_FORCE_GRANDCHILD_TIMEOUT_V2: "1",
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /SUSPENDED_EXEC_FIXTURE_TOOL_TIMEOUT/u);
      assert.doesNotMatch(result.stderr, /READINESS/u);
      assert.equal(existsSync(output), false);
      assertRetainedPartialStage(root);
      const processes = spawnSync("/bin/ps", ["-ax", "-o", "command="], {
        encoding: "utf8",
        env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" },
        maxBuffer: 8 * 1024 * 1024,
        timeout: 2_000,
        killSignal: "SIGKILL",
      });
      assert.equal(processes.status, 0, processes.stderr);
      assert.equal(processes.stdout.includes(marker), false);
    } finally {
      rmSync(alias, { recursive: true, force: true });
    }
  });

  it("preserves a foreign output that wins the O_EXCL publication race", {
    skip: process.platform !== "darwin",
  }, async () => {
    const alias = mkdtempSync(join(tmpdir(), "setfarm-suspended-exec-o-excl-"));
    const root = realpathSync(alias);
    let running;
    try {
      chmodSync(root, 0o700);
      const output = join(root, "controller");
      const foreign = Buffer.from("foreign-output-must-survive", "utf8");
      running = buildAsync(output, {
        SETFARM_SUSPENDED_EXEC_TEST_PAUSE_BEFORE_PUBLICATION_V2: "1",
      });
      await waitForRetainedStage(root);
      writeFileSync(output, foreign, { flag: "wx", mode: 0o600 });
      const result = await awaitBounded(running.completed);
      running = undefined;
      assert.equal(result.status, 1);
      assert.equal(result.signal, null);
      assert.match(result.stderr, /EEXIST/u);
      assert.deepEqual(readFileSync(output), foreign);
      assert.equal(statSync(output).mode & 0o7777, 0o600);
      const stage = retainedStageRoot(root);
      assert.deepEqual(readdirSync(stage).sort(), [
        STAGE_BINARY_NAME_V2,
        STAGE_SOURCE_NAME_V2,
      ].sort());
    } finally {
      running?.child.kill("SIGKILL");
      rmSync(alias, { recursive: true, force: true });
    }
  });

  it("runtime-proves stream and bounded containment failure ordering", {
    skip: process.platform !== "darwin",
  }, async () => {
    for (const stream of ["stdout", "stderr"]) {
      const streamStartedAt = Date.now();
      const streamError = await captureFailure(() =>
        runSuspendedExecControllerFixtureRunnerFaultForTestV2(
          `${stream}_stream_error`,
        ));
      assert.equal(
        streamError.code,
        `SUSPENDED_EXEC_FIXTURE_TOOL_${stream.toUpperCase()}_STREAM_FAILED`,
      );
      assert.match(streamError.message, new RegExp(`${stream} stream failed`, "u"));
      assert.ok(streamError.cause instanceof Error);
      assert.ok(Date.now() - streamStartedAt < 3_000);
    }

    const settlementStartedAt = Date.now();
    const settlementError = await captureFailure(() =>
      runSuspendedExecControllerFixtureRunnerFaultForTestV2(
        "group_kill_failure_settlement_watchdog",
      ));
    const settlementElapsed = Date.now() - settlementStartedAt;
    assert.ok(settlementError instanceof AggregateError);
    assert.equal(
      settlementError.code,
      "SUSPENDED_EXEC_FIXTURE_TOOL_TIMEOUT",
    );
    assert.equal(settlementError.cause, settlementError.errors[0]);
    assert.deepEqual(
      settlementError.errors.map((error) => error.code),
      [
        "SUSPENDED_EXEC_FIXTURE_TOOL_TIMEOUT",
        "SUSPENDED_EXEC_FIXTURE_TOOL_GROUP_KILL_FAILED",
        "SUSPENDED_EXEC_FIXTURE_TOOL_SETTLEMENT_TIMEOUT",
      ],
    );
    assert.ok(settlementElapsed >= 2_900);
    assert.ok(settlementElapsed < 6_000);

    const deathStartedAt = Date.now();
    const deathError = await captureFailure(() =>
      runSuspendedExecControllerFixtureRunnerFaultForTestV2(
        "group_death_unproven",
      ));
    const deathElapsed = Date.now() - deathStartedAt;
    assert.ok(deathError instanceof AggregateError);
    assert.equal(deathError.cause, deathError.errors[0]);
    assert.deepEqual(
      deathError.errors.map((error) => error.code),
      [
        "SUSPENDED_EXEC_FIXTURE_TOOL_TIMEOUT",
        "SUSPENDED_EXEC_FIXTURE_TOOL_GROUP_DEATH_UNPROVEN",
      ],
    );
    assert.ok(deathElapsed >= 2_900);
    assert.ok(deathElapsed < 6_000);

    const processes = spawnSync("/bin/ps", ["-ax", "-o", "command="], {
      encoding: "utf8",
      env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" },
      maxBuffer: 8 * 1024 * 1024,
      timeout: 2_000,
      killSignal: "SIGKILL",
    });
    assert.equal(processes.status, 0, processes.stderr);
    assert.equal(
      processes.stdout.includes(`/bin/sleep ${TEST_TIMEOUT_DURATION_SECONDS_V2}`),
      false,
    );
  });

  it("preserves descriptor operation primacy and reports close failures", async () => {
    assert.equal(
      runSuspendedExecControllerFixtureDescriptorSettlementFaultForTestV2.length,
      1,
    );
    const invalid = await captureFailure(() =>
      runSuspendedExecControllerFixtureDescriptorSettlementFaultForTestV2(
        "invalid",
      ));
    assert.equal(invalid.code, "SUSPENDED_EXEC_FIXTURE_BUILD_FAILED");
    assert.equal(
      invalid.message,
      "Suspended-exec fixture descriptor test scenario is invalid",
    );

    const operation = await captureFailure(() =>
      runSuspendedExecControllerFixtureDescriptorSettlementFaultForTestV2(
        "operation_failure",
      ));
    assert.equal(operation instanceof AggregateError, false);
    assert.equal(
      operation.code,
      "SUSPENDED_EXEC_FIXTURE_DESCRIPTOR_OPERATION_FAILED",
    );
    assert.equal(
      operation.message,
      "Suspended-exec fixture forced descriptor operation failure",
    );

    const close = await captureFailure(() =>
      runSuspendedExecControllerFixtureDescriptorSettlementFaultForTestV2(
        "close_failure",
      ));
    assert.equal(close instanceof AggregateError, false);
    assert.equal(
      close.code,
      "SUSPENDED_EXEC_FIXTURE_DESCRIPTOR_CLOSE_FAILED",
    );
    assert.equal(
      close.message,
      "Suspended-exec fixture forced descriptor close failure",
    );

    const combined = await captureFailure(() =>
      runSuspendedExecControllerFixtureDescriptorSettlementFaultForTestV2(
        "operation_and_close_failure",
      ));
    assert.ok(combined instanceof AggregateError);
    assert.equal(combined.errors.length, 2);
    assert.equal(combined.cause, combined.errors[0]);
    assert.deepEqual(
      combined.errors.map((error) => error.code),
      [
        "SUSPENDED_EXEC_FIXTURE_DESCRIPTOR_OPERATION_FAILED",
        "SUSPENDED_EXEC_FIXTURE_DESCRIPTOR_CLOSE_FAILED",
      ],
    );
    assert.equal(
      combined.code,
      "SUSPENDED_EXEC_FIXTURE_DESCRIPTOR_OPERATION_FAILED",
    );
    assertDescriptorSettlementSourceContract();
  });

  it("uses bounded directory membership and descriptor-fixed ordinary-file capture", () => {
    assertBoundedMembershipAndCaptureSourceContract();
  });
});
