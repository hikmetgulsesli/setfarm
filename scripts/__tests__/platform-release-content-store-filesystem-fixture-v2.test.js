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
  runContentStoreFilesystemFixtureDescriptorSettlementFaultForTestV2,
  runContentStoreFilesystemFixtureRunnerFaultForTestV2,
} from "../build-platform-release-content-store-filesystem-fixture-v2.mjs";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUILD_TIMEOUT_MILLISECONDS_V2 = 120_000;
const TEST_TIMEOUT_DURATION_SECONDS_V2 = "73.271831";
const PUBLICATION_READINESS_TOKEN_V2 =
  "SETFARM_CONTENT_STORE_FIXTURE_PUBLICATION_READY_V2";
const OUTER_RUN_TIMEOUT_MILLISECONDS_V2 = 30_000;
const OUTER_SETTLEMENT_TIMEOUT_MILLISECONDS_V2 = 3_000;
const OUTER_GROUP_DEATH_ATTEMPTS_V2 = 300;
const OUTER_GROUP_DEATH_INTERVAL_MILLISECONDS_V2 = 10;
const MAX_OUTER_OUTPUT_BYTES_V2 = 2 * 1024 * 1024;
const STAGE_PREFIX_V2 = ".setfarm-content-store-fixture-build-";
const STAGE_SOURCE_NAMES_V2 = Object.freeze([
  "platform-release-content-store-filesystem-fixture-v2.c",
  "platform-release-content-store-filesystem-kernel-v2.c",
  "platform-release-content-store-filesystem-kernel-v2.h",
]);
const STAGE_BINARY_NAME_V2 = "content-store-filesystem-fixture-v2";
const builder = join(
  repositoryRoot,
  "scripts",
  "build-platform-release-content-store-filesystem-fixture-v2.mjs",
);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertRetainedWorkspaceSourceContract() {
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
  const captureNeedles = [
    "constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK",
    "const before = fstatSync(descriptor, { bigint: true })",
    "!before.isFile()",
    "before.size > BigInt(maxBytes)",
    "const bytes = Buffer.alloc(byteLength)",
    "const count = readSync(",
    "byteLength - offset",
    "const growthProbe = Buffer.alloc(1)",
    "growthCount = readSync(",
    "const after = fstatSync(descriptor, { bigint: true })",
  ];
  let captureCursor = -1;
  for (const needle of captureNeedles) {
    const next = capture.indexOf(needle, captureCursor + 1);
    assert.ok(next > captureCursor, `missing ordered capture contract: ${needle}`);
    captureCursor = next;
  }

  assert.doesNotMatch(
    source,
    /\b(?:linkSync|renameSync|rmdirSync|rmSync|unlinkSync)\b/u,
  );
  assert.doesNotMatch(source, /spawnSync|maxBuffer|beforeStageCleanup/u);
  const runner = source.slice(
    source.indexOf("function processGroupAlive"),
    source.indexOf("function fullSyncFile"),
  );
  const runnerContracts = [
    /spawn\(executable, argv, \{/u,
    /detached: true/u,
    /stdio: \["ignore", "pipe", "pipe"\]/u,
    /MAX_TOOL_OUTPUT_BYTES_V2/u,
    /let outputLimitExceeded = false/u,
    /if \(outputLimitExceeded \|\| firstCause !== undefined\) return/u,
    /outputLimitExceeded = true;[\s\S]*CONTENT_STORE_FIXTURE_TOOL_OUTPUT_LIMIT/u,
    /child\.stdout\.once\("error"/u,
    /child\.stderr\.once\("error"/u,
    /PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2/u,
    /resolveSettlement\(\{ kind: "watchdog"/u,
    /process\.kill\(-child\.pid, "SIGKILL"\)/u,
    /child\.kill\("SIGKILL"\)/u,
    /error\.code === "ESRCH"/u,
    /testFault === "group_death_unproven"\s*\|\| testFault === "multi_chunk_output_overflow"/u,
    /readinessToken/u,
    /CONTENT_STORE_FIXTURE_TOOL_READINESS_TIMEOUT/u,
    /primaryFirstFailure\(/u,
  ];
  for (const contract of runnerContracts) assert.match(runner, contract);

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
    assert.ok(
      next > publicationCursor,
      `missing ordered publication contract: ${needle}`,
    );
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
    /descriptor_exclusive_copy_no_replace_fsync_post_fence_false_authority_v2/u,
  );
  assert.match(
    source,
    /retained_on_success_or_failure_until_caller_root_disposal_false_authority_v2/u,
  );
  assert.match(
    source,
    /device: publication\.publicationPin\.dev\.toString\(\)/u,
  );
  assert.match(
    source,
    /inode: publication\.publicationPin\.ino\.toString\(\)/u,
  );
  assert.match(source, /SETFARM_CONTENT_STORE_FIXTURE_PUBLICATION_READY_V2/u);

  const testSource = readFileSync(fileURLToPath(import.meta.url), "utf8");
  const outerHarness = testSource.slice(
    testSource.lastIndexOf("function outerProcessGroupAlive"),
    testSource.lastIndexOf("function retainedStageRoot"),
  );
  const outerHarnessContracts = [
    /detached: true/u,
    /MAX_OUTER_OUTPUT_BYTES_V2/u,
    /OUTER_RUN_TIMEOUT_MILLISECONDS_V2/u,
    /OUTER_SETTLEMENT_TIMEOUT_MILLISECONDS_V2/u,
    /process\.kill\(-child\.pid, "SIGKILL"\)/u,
    /child\.kill\("SIGKILL"\)/u,
    /waitForOuterProcessGroupDeath\(child\.pid\)/u,
    /PUBLICATION_READINESS_TOKEN_V2/u,
    /disposalSafe:/u,
  ];
  for (const contract of outerHarnessContracts) {
    assert.match(outerHarness, contract);
  }
  assert.doesNotMatch(
    outerHarness,
    /waitForRetainedStage|awaitBounded/u,
  );
  const raceTest = testSource.slice(
    testSource.lastIndexOf('it("preserves a foreign output'),
    testSource.lastIndexOf('it("runtime-proves stream'),
  );
  assert.doesNotMatch(
    raceTest,
    /running\?\.child\.kill/u,
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
      "export function runContentStoreFilesystemFixtureDescriptorSettlementFaultForTestV2",
    ),
    source.indexOf("function fullSyncFile"),
  );
  assert.match(
    seam,
    /runContentStoreFilesystemFixtureDescriptorSettlementFaultForTestV2\(\s*scenario,\s*\)/u,
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

function outerProcessGroupAlive(processGroupId) {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    return !(error instanceof Error && "code" in error && error.code === "ESRCH");
  }
}

async function waitForOuterProcessGroupDeath(processGroupId) {
  for (let attempt = 0; attempt < OUTER_GROUP_DEATH_ATTEMPTS_V2; attempt += 1) {
    if (!outerProcessGroupAlive(processGroupId)) return true;
    if (attempt + 1 < OUTER_GROUP_DEATH_ATTEMPTS_V2) {
      await new Promise((resolve) =>
        setTimeout(resolve, OUTER_GROUP_DEATH_INTERVAL_MILLISECONDS_V2));
    }
  }
  return !outerProcessGroupAlive(processGroupId);
}

function buildAsync(outFile, extraEnv = {}) {
  const child = spawn(process.execPath, [builder, "--out-file", outFile], {
    cwd: repositoryRoot,
    detached: true,
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
  let stdoutByteLength = 0;
  let stderrByteLength = 0;
  let firstHarnessError;
  let finalized = false;
  let readinessObserved = false;
  let terminationRequested = false;
  let executionTimer;
  let settlementTimer;
  let resolveCompleted;
  let resolveReadiness;
  let rejectReadiness;

  const ready = new Promise((resolve, reject) => {
    resolveReadiness = resolve;
    rejectReadiness = reject;
  });
  const completed = new Promise((resolve) => {
    resolveCompleted = resolve;
  });

  const latchHarnessError = (message) => {
    if (firstHarnessError === undefined) firstHarnessError = new Error(message);
  };
  const directChildFallback = () => {
    try {
      child.kill("SIGKILL");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
        latchHarnessError("outer builder direct-child fallback failed");
      }
    }
  };
  const finalize = async (status, signal, settlementKind) => {
    if (finalized) return;
    finalized = true;
    if (executionTimer !== undefined) clearTimeout(executionTimer);
    if (settlementTimer !== undefined) clearTimeout(settlementTimer);
    if (!readinessObserved) {
      rejectReadiness(
        firstHarnessError ?? new Error("builder exited before publication readiness"),
      );
    }
    const groupDeathProven = Number.isInteger(child.pid) && child.pid > 0
      ? await waitForOuterProcessGroupDeath(child.pid)
      : false;
    if (!groupDeathProven) {
      latchHarnessError("outer builder process-group death was not proven");
    }
    resolveCompleted(Object.freeze({
      disposalSafe:
        settlementKind === "close"
        && !terminationRequested
        && groupDeathProven
        && signal === null
        && readinessObserved
        && firstHarnessError === undefined,
      harnessError: firstHarnessError,
      signal,
      status,
      stderr: Buffer.concat(stderr, stderrByteLength).toString("utf8"),
      stdout: Buffer.concat(stdout, stdoutByteLength).toString("utf8"),
    }));
  };
  const requestTermination = (message) => {
    if (finalized || terminationRequested) return;
    terminationRequested = true;
    latchHarnessError(message);
    try {
      if (!Number.isInteger(child.pid) || child.pid < 1) {
        directChildFallback();
      } else {
        process.kill(-child.pid, "SIGKILL");
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
        latchHarnessError("outer builder process-group kill failed");
        directChildFallback();
      }
    }
    settlementTimer = setTimeout(() => {
      directChildFallback();
      void finalize(null, null, "watchdog");
    }, OUTER_SETTLEMENT_TIMEOUT_MILLISECONDS_V2);
  };
  const capture = (name, chunk) => {
    if (firstHarnessError !== undefined) return;
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const currentLength = name === "stdout"
      ? stdoutByteLength
      : stderrByteLength;
    if (currentLength + bytes.byteLength > MAX_OUTER_OUTPUT_BYTES_V2) {
      requestTermination(`outer builder exceeded bounded ${name} capture`);
      return;
    }
    if (name === "stdout") {
      stdout.push(bytes);
      stdoutByteLength += bytes.byteLength;
      return;
    }
    stderr.push(bytes);
    stderrByteLength += bytes.byteLength;
    if (
      !readinessObserved
      && Buffer.concat(stderr, stderrByteLength)
        .includes(Buffer.from(PUBLICATION_READINESS_TOKEN_V2, "utf8"))
    ) {
      readinessObserved = true;
      resolveReadiness();
    }
  };

  child.stdout.on("data", (chunk) => capture("stdout", chunk));
  child.stderr.on("data", (chunk) => capture("stderr", chunk));
  child.stdout.once("error", () =>
    requestTermination("outer builder stdout stream failed"));
  child.stderr.once("error", () =>
    requestTermination("outer builder stderr stream failed"));
  child.once("error", () =>
    requestTermination("outer builder spawn failed"));
  child.once("close", (status, signal) => {
    void finalize(status, signal, "close");
  });
  executionTimer = setTimeout(() => {
    requestTermination("outer builder execution timed out");
  }, OUTER_RUN_TIMEOUT_MILLISECONDS_V2);

  return {
    completed,
    contain: async () => {
      requestTermination("outer builder containment requested");
      return completed;
    },
    ready,
  };
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
  assert.deepEqual(readdirSync(stageRoot).sort(), [...STAGE_SOURCE_NAMES_V2].sort());
  for (const sourceName of STAGE_SOURCE_NAMES_V2) {
    assert.equal(statSync(join(stageRoot, sourceName)).mode & 0o7777, 0o400);
  }
}

async function captureFailure(action) {
  try {
    await action();
  } catch (error) {
    return error;
  }
  throw new Error("expected action to fail");
}

describe("Darwin content-store filesystem backend native fixture builder", () => {
  it("publishes deterministic bytes with retained evidence and false authority", {
    skip: process.platform !== "darwin",
  }, () => {
    const firstAlias = mkdtempSync(join(tmpdir(), "setfarm-content-store-fs-fixture-a-"));
    const secondAlias = mkdtempSync(join(tmpdir(), "setfarm-content-store-fs-fixture-b-"));
    const firstRoot = realpathSync(firstAlias);
    const secondRoot = realpathSync(secondAlias);
    try {
      chmodSync(firstRoot, 0o700);
      chmodSync(secondRoot, 0o700);
      const firstPath = join(firstRoot, "fixture");
      const secondPath = join(secondRoot, "fixture");
      const first = build(firstPath);
      const second = build(secondPath);
      assert.equal(first.status, 0, first.stderr);
      assert.equal(second.status, 0, second.stderr);
      assert.equal(first.signal, null);
      assert.equal(second.signal, null);
      assert.equal(first.stdout.endsWith("\n"), false);

      const firstBytes = readFileSync(firstPath);
      const secondBytes = readFileSync(secondPath);
      const receipt = JSON.parse(first.stdout);
      const secondReceipt = JSON.parse(second.stdout);
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
      assert.deepEqual(firstBytes, secondBytes);
      assert.equal(receipt.admissionScope, "test_fixture");
      assert.equal(receipt.productionAuthority, false);
      assert.equal(receipt.signingAuthority, "adhoc_or_unsigned_test_fixture");
      assert.equal(receipt.trustConclusion, "characterization_only");
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

      const architectures = spawnSync("/usr/bin/lipo", ["-archs", firstPath], {
        encoding: "utf8",
        env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" },
      });
      assert.equal(architectures.status, 0, architectures.stderr);
      assert.deepEqual(
        new Set(architectures.stdout.trim().split(/\s+/u)),
        new Set(["arm64", "x86_64"]),
      );

      for (const [root, bytes] of [
        [firstRoot, firstBytes],
        [secondRoot, secondBytes],
      ]) {
        const stage = retainedStageRoot(root);
        assert.deepEqual(readdirSync(stage).sort(), [
          ...STAGE_SOURCE_NAMES_V2,
          STAGE_BINARY_NAME_V2,
        ].sort());
        assert.deepEqual(readFileSync(join(stage, STAGE_BINARY_NAME_V2)), bytes);
        assert.equal(statSync(join(stage, STAGE_BINARY_NAME_V2)).mode & 0o7777, 0o500);
      }

      const repeated = build(firstPath);
      assert.equal(repeated.status, 1);
      assert.equal(sha256(readFileSync(firstPath)), receipt.binary.sha256);
      assert.equal(
        readdirSync(firstRoot).filter((name) => name.startsWith(STAGE_PREFIX_V2)).length,
        1,
      );
    } finally {
      rmSync(firstAlias, { recursive: true, force: true });
      rmSync(secondAlias, { recursive: true, force: true });
    }
  });

  it("rejects invalid parents and retains a timed-out partial workspace", {
    skip: process.platform !== "darwin",
  }, () => {
    const badArgv = spawnSync(process.execPath, [builder, "--unknown"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    assert.equal(badArgv.status, 1);
    assert.match(badArgv.stderr, /Usage:/u);

    const publicAlias = mkdtempSync(join(tmpdir(), "setfarm-content-store-fs-mode-"));
    const timeoutAlias = mkdtempSync(join(tmpdir(), "setfarm-content-store-fs-timeout-"));
    try {
      const publicRoot = realpathSync(publicAlias);
      chmodSync(publicRoot, 0o755);
      const publicResult = build(join(publicRoot, "fixture"));
      assert.equal(publicResult.status, 1);
      assert.match(publicResult.stderr, /mode-0700 directory/u);

      const timeoutRoot = realpathSync(timeoutAlias);
      chmodSync(timeoutRoot, 0o700);
      const timeoutOutput = join(timeoutRoot, "fixture");
      const timedOut = build(timeoutOutput, {
        SETFARM_CONTENT_STORE_FIXTURE_TEST_FORCE_TOOL_TIMEOUT_V2: "1",
      });
      assert.equal(timedOut.status, 1);
      assert.equal(timedOut.signal, null);
      assert.match(
        timedOut.stderr,
        /CONTENT_STORE_FIXTURE_TOOL_TIMEOUT:.*timed out/u,
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
        processes.stdout.includes(`/bin/sleep ${TEST_TIMEOUT_DURATION_SECONDS_V2}`),
        false,
      );
    } finally {
      rmSync(publicAlias, { recursive: true, force: true });
      rmSync(timeoutAlias, { recursive: true, force: true });
    }
  });

  it("retains tool, compiler, compiled, and publication failure evidence", {
    skip: process.platform !== "darwin",
  }, () => {
    const cases = [
      ["output-limit", "SETFARM_CONTENT_STORE_FIXTURE_TEST_FORCE_TOOL_OUTPUT_LIMIT_V2"],
      ["tool-error", "SETFARM_CONTENT_STORE_FIXTURE_TEST_FORCE_TOOL_ERROR_V2"],
      ["partial-compiler", "SETFARM_CONTENT_STORE_FIXTURE_TEST_FORCE_PARTIAL_COMPILER_OUTPUT_FAILURE_V2"],
      ["post-compile", "SETFARM_CONTENT_STORE_FIXTURE_TEST_FORCE_POST_COMPILE_FAILURE_V2"],
      ["partial-publication", "SETFARM_CONTENT_STORE_FIXTURE_TEST_FORCE_PARTIAL_PUBLICATION_FAILURE_V2"],
      ["post-publication", "SETFARM_CONTENT_STORE_FIXTURE_TEST_FORCE_POST_PUBLICATION_FAILURE_V2"],
    ].map(([name, variable]) => {
      const alias = mkdtempSync(join(tmpdir(), `setfarm-content-store-fs-${name}-`));
      const root = realpathSync(alias);
      chmodSync(root, 0o700);
      return { alias, name, root, variable };
    });
    try {
      const results = new Map();
      for (const entry of cases) {
        const output = join(entry.root, "fixture");
        const result = build(output, { [entry.variable]: "1" });
        assert.equal(result.status, 1, `${entry.name}: ${result.stderr}`);
        results.set(entry.name, { output, result });
      }

      assert.match(
        results.get("output-limit").result.stderr,
        /CONTENT_STORE_FIXTURE_TOOL_OUTPUT_LIMIT/u,
      );
      assertRetainedPartialStage(cases.find((entry) => entry.name === "output-limit").root);
      assertRetainedPartialStage(cases.find((entry) => entry.name === "tool-error").root);

      const partialCompiler = cases.find((entry) => entry.name === "partial-compiler");
      const partialCompilerStage = retainedStageRoot(partialCompiler.root);
      assert.deepEqual(readdirSync(partialCompilerStage).sort(), [
        ...STAGE_SOURCE_NAMES_V2,
        STAGE_BINARY_NAME_V2,
      ].sort());
      assert.equal(
        readFileSync(join(partialCompilerStage, STAGE_BINARY_NAME_V2), "utf8"),
        "partial-compiler-output",
      );
      assert.equal(existsSync(results.get("partial-compiler").output), false);

      const postCompile = cases.find((entry) => entry.name === "post-compile");
      const postCompileStage = retainedStageRoot(postCompile.root);
      const compiledBytes = readFileSync(join(postCompileStage, STAGE_BINARY_NAME_V2));
      assert.ok(compiledBytes.byteLength > 16);
      assert.equal(existsSync(results.get("post-compile").output), false);

      const partialPublication = cases.find(
        (entry) => entry.name === "partial-publication",
      );
      const partialBytes = readFileSync(results.get("partial-publication").output);
      assert.equal(partialBytes.byteLength, 16);
      const partialStageBytes = readFileSync(join(
        retainedStageRoot(partialPublication.root),
        STAGE_BINARY_NAME_V2,
      ));
      assert.deepEqual(partialBytes, partialStageBytes.subarray(0, 16));
      assert.equal(statSync(results.get("partial-publication").output).mode & 0o7777, 0o500);

      const postPublication = cases.find(
        (entry) => entry.name === "post-publication",
      );
      const retainedFinalBytes = readFileSync(join(
        retainedStageRoot(postPublication.root),
        STAGE_BINARY_NAME_V2,
      ));
      assert.deepEqual(
        readFileSync(results.get("post-publication").output),
        retainedFinalBytes,
      );
      assert.ok(retainedFinalBytes.byteLength > 16);
    } finally {
      for (const entry of cases) {
        rmSync(entry.alias, { recursive: true, force: true });
      }
    }
  });

  it("kills a readiness-proven timed-out tool's whole process group", {
    skip: process.platform !== "darwin",
  }, () => {
    const alias = mkdtempSync(join(tmpdir(), "setfarm-content-store-fs-grandchild-"));
    const root = realpathSync(alias);
    try {
      chmodSync(root, 0o700);
      const output = join(root, "fixture");
      const marker = `setfarm-content-store-filesystem-grandchild-${basename(root)}`;
      const result = build(output, {
        SETFARM_CONTENT_STORE_FIXTURE_TEST_FORCE_GRANDCHILD_TIMEOUT_V2: "1",
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /CONTENT_STORE_FIXTURE_TOOL_TIMEOUT/u);
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
    const alias = mkdtempSync(join(tmpdir(), "setfarm-content-store-fs-o-excl-"));
    const root = realpathSync(alias);
    let running;
    let disposalSafe = false;
    try {
      chmodSync(root, 0o700);
      const output = join(root, "fixture");
      const foreign = Buffer.from("foreign-output-must-survive", "utf8");
      running = buildAsync(output, {
        SETFARM_CONTENT_STORE_FIXTURE_TEST_PAUSE_BEFORE_PUBLICATION_V2: "1",
      });
      await running.ready;
      writeFileSync(output, foreign, { flag: "wx", mode: 0o600 });
      const result = await running.completed;
      running = undefined;
      disposalSafe = result.disposalSafe;
      assert.equal(result.harnessError, undefined);
      assert.equal(result.status, 1);
      assert.equal(result.signal, null);
      assert.match(result.stderr, /EEXIST/u);
      assert.deepEqual(readFileSync(output), foreign);
      assert.equal(statSync(output).mode & 0o7777, 0o600);
      const stage = retainedStageRoot(root);
      assert.deepEqual(readdirSync(stage).sort(), [
        ...STAGE_SOURCE_NAMES_V2,
        STAGE_BINARY_NAME_V2,
      ].sort());
    } finally {
      if (running !== undefined) {
        const containment = await running.contain();
        disposalSafe = disposalSafe || containment.disposalSafe;
      }
      if (disposalSafe) {
        rmSync(alias, { recursive: true, force: true });
      }
    }
  });

  it("runtime-proves stream and bounded containment failure ordering", {
    skip: process.platform !== "darwin",
  }, async () => {
    const streamStartedAt = Date.now();
    const streamError = await captureFailure(() =>
      runContentStoreFilesystemFixtureRunnerFaultForTestV2("stdout_stream_error"));
    assert.equal(
      streamError.code,
      "CONTENT_STORE_FIXTURE_TOOL_STDOUT_STREAM_FAILED",
    );
    assert.match(streamError.message, /stdout stream failed/u);
    assert.ok(streamError.cause instanceof Error);
    assert.ok(Date.now() - streamStartedAt < 3_000);

    const settlementStartedAt = Date.now();
    const settlementError = await captureFailure(() =>
      runContentStoreFilesystemFixtureRunnerFaultForTestV2(
        "group_kill_failure_settlement_watchdog",
      ));
    const settlementElapsed = Date.now() - settlementStartedAt;
    assert.ok(settlementError instanceof AggregateError);
    assert.equal(
      settlementError.code,
      "CONTENT_STORE_FIXTURE_TOOL_TIMEOUT",
    );
    assert.equal(settlementError.cause, settlementError.errors[0]);
    assert.deepEqual(
      settlementError.errors.map((error) => error.code),
      [
        "CONTENT_STORE_FIXTURE_TOOL_TIMEOUT",
        "CONTENT_STORE_FIXTURE_TOOL_GROUP_KILL_FAILED",
        "CONTENT_STORE_FIXTURE_TOOL_SETTLEMENT_TIMEOUT",
      ],
    );
    assert.ok(settlementElapsed >= 2_900);
    assert.ok(settlementElapsed < 6_000);

    const deathStartedAt = Date.now();
    const deathError = await captureFailure(() =>
      runContentStoreFilesystemFixtureRunnerFaultForTestV2(
        "group_death_unproven",
      ));
    const deathElapsed = Date.now() - deathStartedAt;
    assert.ok(deathError instanceof AggregateError);
    assert.equal(deathError.cause, deathError.errors[0]);
    assert.deepEqual(
      deathError.errors.map((error) => error.code),
      [
        "CONTENT_STORE_FIXTURE_TOOL_TIMEOUT",
        "CONTENT_STORE_FIXTURE_TOOL_GROUP_DEATH_UNPROVEN",
      ],
    );
    assert.ok(deathElapsed >= 2_900);
    assert.ok(deathElapsed < 6_000);

    const overflowStartedAt = Date.now();
    const overflowError = await captureFailure(() =>
      runContentStoreFilesystemFixtureRunnerFaultForTestV2(
        "multi_chunk_output_overflow",
      ));
    const overflowElapsed = Date.now() - overflowStartedAt;
    assert.ok(overflowError instanceof AggregateError);
    assert.equal(overflowError.cause, overflowError.errors[0]);
    assert.equal(overflowError.errors.length, 2);
    assert.deepEqual(
      overflowError.errors.map((error) => error.code),
      [
        "CONTENT_STORE_FIXTURE_TOOL_OUTPUT_LIMIT",
        "CONTENT_STORE_FIXTURE_TOOL_GROUP_DEATH_UNPROVEN",
      ],
    );
    assert.ok(overflowElapsed >= 2_900);
    assert.ok(overflowElapsed < 6_000);

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
      runContentStoreFilesystemFixtureDescriptorSettlementFaultForTestV2.length,
      1,
    );
    const invalid = await captureFailure(() =>
      runContentStoreFilesystemFixtureDescriptorSettlementFaultForTestV2(
        "invalid",
      ));
    assert.equal(invalid.code, "CONTENT_STORE_FIXTURE_BUILD_FAILED");
    assert.equal(
      invalid.message,
      "Darwin content-store filesystem fixture descriptor test scenario is invalid",
    );

    const operation = await captureFailure(() =>
      runContentStoreFilesystemFixtureDescriptorSettlementFaultForTestV2(
        "operation_failure",
      ));
    assert.equal(operation instanceof AggregateError, false);
    assert.equal(
      operation.code,
      "CONTENT_STORE_FIXTURE_DESCRIPTOR_OPERATION_FAILED",
    );
    assert.equal(
      operation.message,
      "Darwin content-store filesystem fixture forced descriptor operation failure",
    );

    const close = await captureFailure(() =>
      runContentStoreFilesystemFixtureDescriptorSettlementFaultForTestV2(
        "close_failure",
      ));
    assert.equal(close instanceof AggregateError, false);
    assert.equal(
      close.code,
      "CONTENT_STORE_FIXTURE_DESCRIPTOR_CLOSE_FAILED",
    );
    assert.equal(
      close.message,
      "Darwin content-store filesystem fixture forced descriptor close failure",
    );

    const combined = await captureFailure(() =>
      runContentStoreFilesystemFixtureDescriptorSettlementFaultForTestV2(
        "operation_and_close_failure",
      ));
    assert.ok(combined instanceof AggregateError);
    assert.equal(combined.errors.length, 2);
    assert.equal(combined.cause, combined.errors[0]);
    assert.deepEqual(
      combined.errors.map((error) => error.code),
      [
        "CONTENT_STORE_FIXTURE_DESCRIPTOR_OPERATION_FAILED",
        "CONTENT_STORE_FIXTURE_DESCRIPTOR_CLOSE_FAILED",
      ],
    );
    assert.equal(
      combined.code,
      "CONTENT_STORE_FIXTURE_DESCRIPTOR_OPERATION_FAILED",
    );
    assertDescriptorSettlementSourceContract();
  });

  it("uses bounded non-destructive retained-workspace contracts", () => {
    assertRetainedWorkspaceSourceContract();
  });
});
