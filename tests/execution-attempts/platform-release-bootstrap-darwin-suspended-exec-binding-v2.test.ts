import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_KSEC_CODE_SIGNATURE_ADHOC_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_KSEC_CODE_STATUS_VALID_V2,
  PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema,
  parsePlatformReleaseBootstrapDarwinSuspendedExecBindingCandidateV2,
} from "../../src/execution/schemas/platform-release-bootstrap-darwin-suspended-exec-binding-v2.js";
import {
  buildPlatformReleaseBootstrapDarwinSuspendedExecFixtureForTestV2,
  capturePlatformReleaseBootstrapDarwinSuspendedExecExecutableForTestV2,
  parsePlatformReleaseBootstrapDarwinSuspendedExecNativeFrameForTestV2,
  observePlatformReleaseBootstrapDarwinSuspendedExecOuterBuilderFailureRetentionForTestV2,
  observePlatformReleaseBootstrapDarwinSuspendedExecSuccessfulBuilderReceiptFailureRetentionForTestV2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_OUTER_TIMEOUT_MILLISECONDS_V2,
  runPlatformReleaseBootstrapDarwinSuspendedExecContainedProcessFaultForTestV2,
  runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2,
  runPlatformReleaseBootstrapDarwinSuspendedExecPendingLeaseForTestV2,
  PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2,
  type PlatformReleaseBootstrapDarwinSuspendedExecFixtureV2,
  type PlatformReleaseBootstrapDarwinSuspendedExecModeV2,
} from "../../src/product-compiler/platform-release-bootstrap-darwin-suspended-exec-binding-test-support-v2.js";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";

let fixture: PlatformReleaseBootstrapDarwinSuspendedExecFixtureV2 | undefined;
const SUPPORT_SOURCE_V2 = path.resolve(
  import.meta.dirname,
  "../../src/product-compiler/platform-release-bootstrap-darwin-suspended-exec-binding-test-support-v2.ts",
);

before(async () => {
  if (process.platform !== "darwin") return;
  fixture = await buildPlatformReleaseBootstrapDarwinSuspendedExecFixtureForTestV2();
});

after(() => {
  if (fixture !== undefined) {
    const buildRoot = fixture.buildRoot;
    const controller = fixture.controller;
    assertRetentionDispositionV2(fixture.dispose());
    assert.equal(existsSync(buildRoot), true);
    assert.equal(existsSync(controller), true);
  }
  fixture = undefined;
});

function assertRetentionDispositionV2(value: unknown): void {
  assert.deepEqual(value, {
    schema:
      "setfarm.platform-release-bootstrap-suspended-exec-controller-fixture-retention-disposition.v2",
    admissionScope: "test_fixture",
    productionAuthority: false,
    deletionAuthority: false,
    filesystemMutationPerformed: false,
    rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2",
  });
  assert.equal(Object.isFrozen(value), true);
}

function assertRunResidueDispositionV2(value: unknown): void {
  assert.deepEqual(value, {
    schema:
      "setfarm.platform-release-bootstrap-darwin-suspended-exec-run-residue-disposition.v2",
    admissionScope: "test_fixture",
    productionAuthority: false,
    deletionAuthority: false,
    filesystemMutationPerformed: false,
    rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2",
  });
  assert.equal(Object.isFrozen(value), true);
}

function isSuspendedFixtureErrorCodeV2(
  error: unknown,
  code: string,
): boolean {
  return error instanceof PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2
    && error.code === code;
}

function assertDescriptorCaptureSourceContractV2(): void {
  const source = readFileSync(SUPPORT_SOURCE_V2, "utf8");
  assert.doesNotMatch(
    source,
    /\breadFileSync\b|\brmSync\b|\bunlinkSync\b|\brmdirSync\b/u,
  );
  const pin = source.slice(
    source.indexOf("function exactExecutablePinFromStatV2"),
    source.indexOf("function sameExactExecutablePinV2"),
  );
  for (const contract of [
    /!observed\.isFile\(\)/u,
    /observed\.nlink !== 1n/u,
    /\(observed\.mode & 0o7777n\) !== 0o500n/u,
    /observed\.size > BigInt\(MAX_CONTROLLER_BYTES_V2\)/u,
  ]) {
    assert.match(pin, contract);
  }

  const capture = source.slice(
    source.indexOf("function captureExactExecutableV2"),
    source.indexOf("export function capturePlatformReleaseBootstrap"),
  );
  const orderedNeedles = [
    "constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK",
    "const before = fstatSync(descriptor, { bigint: true })",
    "exactExecutablePinFromStatV2(before, errorCode)",
    "const byteLength = Number(before.size)",
    "const bytes = Buffer.alloc(byteLength)",
    "const count = readSync(",
    "byteLength - offset",
    "offset,",
    "const growthProbe = Buffer.alloc(1)",
    "growthCount = readSync(",
    "byteLength,",
    "const after = fstatSync(descriptor, { bigint: true })",
    "hooks?.beforePathIdentityFence?.()",
    "const pathStat = lstatSync(filePath, { bigint: true })",
    "closeSync(descriptor)",
    "primaryFirstCaptureFailureV2(",
  ];
  let cursor = -1;
  for (const needle of orderedNeedles) {
    const next = capture.indexOf(needle, cursor + 1);
    assert.ok(next > cursor, `missing ordered executable capture contract: ${needle}`);
    cursor = next;
  }
  assert.match(capture, /sameExactExecutablePinV2\(after, beforePin\)/u);
  assert.match(capture, /sameExactExecutablePinV2\(pathStat, beforePin\)/u);
  assert.ok(
    (source.match(/captureExactExecutableV2\(/gu)?.length ?? 0) >= 5,
    "build, target, replacement, and test evidence must share exact capture",
  );
  assert.match(source, /receipt\.publicationPolicy !== PUBLICATION_POLICY_V2/u);
  assert.match(source, /receipt\.stageWorkspacePolicy !== STAGE_WORKSPACE_POLICY_V2/u);
  assert.match(
    source,
    /captured\.pin\.device\.toString\(\)/u,
  );
  assert.match(
    source,
    /captured\.pin\.inode\.toString\(\)/u,
  );

  const runner = source.slice(
    source.indexOf("async function runContainedProcessV2"),
    source.indexOf("export async function runPlatformReleaseBootstrapDarwinSuspendedExecContainedProcessFault"),
  );
  for (const contract of [
    /detached: true/u,
    /stdio: \["pipe", "pipe", "pipe"\]/u,
    /child\.stdin\.once\("error"/u,
    /child\.stdout\.once\("error"/u,
    /child\.stderr\.once\("error"/u,
    /options\.stdoutByteLimit/u,
    /options\.stderrByteLimit/u,
    /process\.kill\(-child\.pid, "SIGKILL"\)/u,
    /child\.kill\("SIGKILL"\)/u,
    /PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2/u,
    /resolveSettlement\?\.\(\{ kind: "watchdog"/u,
    /waitForProcessGroupDeathV2\(child\.pid\)/u,
    /throwContainedProcessFailureV2\(/u,
  ]) {
    assert.match(runner, contract);
  }
  const build = source.slice(
    source.indexOf("async function buildPlatformReleaseBootstrapDarwinSuspendedExecFixtureInternalV2"),
    source.indexOf("export async function buildPlatformReleaseBootstrapDarwinSuspendedExecFixtureForTestV2"),
  );
  assert.match(build, /await runContainedProcessV2\(/u);
  assert.doesNotMatch(build, /spawnSync\(/u);
  assert.doesNotMatch(build, /rmSync|unlinkSync|rmdirSync/u);
  assert.match(build, /does not\s*\/\/ create atomic same-UID deletion authority/u);
  assert.doesNotMatch(build, /processContainmentProvenV2\(error\)/u);
  const privateRoot = source.slice(
    source.indexOf("function exactPrivateRootV2"),
    source.indexOf("function assertBuildReceiptV2"),
  );
  assert.doesNotMatch(privateRoot, /rmSync|unlinkSync|rmdirSync/u);
  const disposal = source.slice(
    source.indexOf("function disposeFixtureV2"),
    source.indexOf("type RetainedRootObservationFieldsV2"),
  );
  assert.match(
    disposal,
    /this: PlatformReleaseBootstrapDarwinSuspendedExecFixtureV2/u,
  );
  assert.match(disposal, /state\.activeLeases !== 0/u);
  assert.match(disposal, /DARWIN_SUSPENDED_EXEC_FIXTURE_DISPOSE_INVALID/u);
  assert.match(disposal, /fixtureStatesV2\.delete\(fixture\)/u);
  assert.doesNotMatch(disposal, /rmSync|unlinkSync|rmdirSync/u);
  const retainedObservationDisposal = source.slice(
    source.indexOf("function disposeRetainedRootObservationV2"),
    source.indexOf("function sha256V2"),
  );
  assert.match(retainedObservationDisposal, /this: Readonly/u);
  assert.match(
    retainedObservationDisposal,
    /retainedRootObservationHandlesV2\.has\(receiver\)/u,
  );
  const disposition = source.slice(
    source.indexOf("function retainedWorkspaceDispositionV2"),
    source.indexOf("function authenticFixtureStateV2"),
  );
  assert.match(disposition, /deletionAuthority: false/u);
  assert.match(disposition, /filesystemMutationPerformed: false/u);
  assert.doesNotMatch(disposition, /rmSync|unlinkSync|rmdirSync/u);
  const invoke = source.slice(
    source.indexOf("async function invokeControllerV2"),
    source.indexOf("function assertNoOrphanV2"),
  );
  assert.match(invoke, /await runContainedProcessV2\(/u);
  assert.doesNotMatch(invoke, /Buffer\.concat|spawn\(/u);
  const run = source.slice(
    source.indexOf("async function runPlatformReleaseBootstrapDarwinSuspendedExecBindingInternalV2"),
    source.indexOf("export async function runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2"),
  );
  assert.match(run, /acquireFixtureLeaseV2\(fixture\)/u);
  assert.match(run, /releaseFixtureLeaseV2\(fixtureState\)/u);
  assert.match(run, /every run root remains retained on success\/failure/u);
  assert.doesNotMatch(
    run,
    /cleanupAuthorized|processContainmentProvenV2|rmSync|unlinkSync|rmdirSync/u,
  );
  assert.match(source, /dispose: disposeFixtureV2/u);
  assert.match(source, /Object\.keys\(compileRecord\)\.sort\(\)/u);
  assert.match(source, /JSON\.stringify\(COMPILE_FLAGS_V2\)/u);
  assert.match(source, /compileRecord\.deploymentTarget !== "13\.0"/u);
  assert.match(source, /JSON\.stringify\(FRAMEWORKS_V2\)/u);
  assert.match(source, /JSON\.stringify\(SPAWN_FLAGS_V2\)/u);
}

function assertFalseAuthorityV2(value: Readonly<Record<string, unknown>>): void {
  assert.equal(value.admissionScope, "test_fixture");
  assert.equal(value.productionAuthority, false);
  assert.equal(value.credentialUse, "none");
  assert.equal(value.descriptorExecution, false);
  assert.equal(value.libprocApiStability, "private_unproven");
  assert.equal(value.trustConclusion, "characterization_only");
  assert.equal(value.observationReadiness, "private_api_not_guaranteed");
}

function assertExitedV2(
  receipt: Awaited<ReturnType<
    typeof runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2
  >>,
  exitCode: number,
): void {
  assert.equal(receipt.process.terminationKind, "exited");
  assert.equal(receipt.process.exitCode, exitCode);
  assert.equal(receipt.process.terminationSignal, null);
}

function assertSignaledV2(
  receipt: Awaited<ReturnType<
    typeof runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2
  >>,
  terminationSignal: number,
): void {
  assert.equal(receipt.process.terminationKind, "signaled");
  assert.equal(receipt.process.exitCode, null);
  assert.equal(receipt.process.terminationSignal, terminationSignal);
}

function securityReadyV2(
  receipt: Awaited<ReturnType<
    typeof runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2
  >>,
): boolean {
  return receipt.security.guestLookupStatus === 0
    && receipt.security.validityStatus === 0
    && receipt.security.signingInformationStatus === 0
    && receipt.security.cdhash !== null
    && receipt.security.cdhashByteLength > 0
    && receipt.security.digestAlgorithm > 0
    && (
      receipt.security.dynamicStatusFlags
        & PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_KSEC_CODE_STATUS_VALID_V2
    ) !== 0;
}

function assertSafeObservationUnavailableV2(
  receipt: Awaited<ReturnType<
    typeof runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2
  >>,
): void {
  assert.equal(
    receipt.outcome,
    "rejected_pre_user_entry_observation_unavailable",
  );
  assert.equal(receipt.process.sigcontSent, false);
  assert.equal(receipt.process.sigkillSent, true);
  assert.equal(receipt.process.targetCanaryObserved, false);
  assert.equal(receipt.process.targetOutputState, "none");
  assert.equal(receipt.process.heldPostExecutionUnchanged, true);
  assert.equal(receipt.process.reaped, true);
  assertSignaledV2(receipt, 9);
  assert.equal(
    receipt.mappedExecutable.regionCountObserved === 0
      || !securityReadyV2(receipt),
    true,
  );
  assertFalseAuthorityV2(receipt);
}

describe("Darwin suspended exact-vnode exec characterization v2", () => {
  it("uses one bounded descriptor capture contract for build and executable evidence", () => {
    assertDescriptorCaptureSourceContractV2();
  });

  it("accepts only the retained-workspace publication receipt pinned to the final output inode", {
    skip: process.platform !== "darwin",
  }, () => {
    assert.ok(fixture);
    const receipt = fixture.buildReceipt;
    const binary = receipt.binary as Readonly<Record<string, unknown>>;
    const compileContract = receipt.compileContract as Readonly<Record<
      string,
      unknown
    >>;
    const stableIdentity = binary.stableIdentity as Readonly<Record<
      string,
      unknown
    >>;
    const controllerStat = statSync(fixture.controller, { bigint: true });
    assert.equal(
      receipt.publicationPolicy,
      "descriptor_exclusive_copy_no_replace_fsync_post_fence_false_authority_v2",
    );
    assert.equal(
      receipt.stageWorkspacePolicy,
      "retained_on_success_or_failure_until_caller_root_disposal_false_authority_v2",
    );
    assert.deepEqual(stableIdentity, {
      objectKind: "ordinary_file",
      device: controllerStat.dev.toString(),
      inode: controllerStat.ino.toString(),
    });
    assert.equal(Object.isFrozen(stableIdentity), true);
    assert.deepEqual(Object.keys(compileContract).sort(), [
      "compileFlags",
      "deploymentTarget",
      "frameworks",
      "spawnFlags",
    ]);
    assert.deepEqual(compileContract.compileFlags, [
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
    assert.equal(compileContract.deploymentTarget, "13.0");
    assert.deepEqual(compileContract.frameworks, ["CoreFoundation", "Security"]);
    assert.deepEqual(compileContract.spawnFlags, [
      "POSIX_SPAWN_START_SUSPENDED",
      "POSIX_SPAWN_CLOEXEC_DEFAULT",
    ]);
  });

  it("fails closed on FIFO, oversized, and same-byte replacement controller captures", {
    skip: process.platform !== "darwin",
  }, () => {
    assert.ok(fixture);
    const alias = mkdtempSync(path.join(
      os.tmpdir(),
      "setfarm-suspended-exec-capture-adversarial-",
    ));
    const root = path.resolve(alias);
    try {
      chmodSync(root, 0o700);
      const fifo = path.join(root, "controller-fifo");
      const madeFifo = spawnSync("/usr/bin/mkfifo", [fifo], {
        encoding: "utf8",
        env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" },
        timeout: 2_000,
        killSignal: "SIGKILL",
        shell: false,
      });
      assert.equal(madeFifo.status, 0, madeFifo.stderr);
      chmodSync(fifo, 0o500);
      assert.throws(
        () => capturePlatformReleaseBootstrapDarwinSuspendedExecExecutableForTestV2(
          fifo,
        ),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2
          && error.code === "DARWIN_SUSPENDED_EXEC_BUILD_FAILED",
      );

      const oversized = path.join(root, "controller-oversized");
      writeFileSync(
        oversized,
        Buffer.alloc((4 * 1024 * 1024) + 1, 0x61),
        { flag: "wx", mode: 0o500 },
      );
      chmodSync(oversized, 0o500);
      assert.throws(
        () => capturePlatformReleaseBootstrapDarwinSuspendedExecExecutableForTestV2(
          oversized,
        ),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2
          && error.code === "DARWIN_SUSPENDED_EXEC_BUILD_FAILED",
      );

      const candidate = path.join(root, "controller-candidate");
      const replacement = path.join(root, "controller-replacement");
      copyFileSync(fixture.controller, candidate);
      copyFileSync(fixture.controller, replacement);
      chmodSync(candidate, 0o500);
      chmodSync(replacement, 0o500);
      assert.throws(
        () => capturePlatformReleaseBootstrapDarwinSuspendedExecExecutableForTestV2(
          candidate,
          {
            beforePathIdentityFence: () => renameSync(replacement, candidate),
          },
        ),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2
          && error.code === "DARWIN_SUSPENDED_EXEC_BUILD_FAILED",
      );
    } finally {
      rmSync(alias, { recursive: true, force: true });
    }
  });

  it("contains deterministic stream, group-kill, settlement, and death-proof faults", async () => {
    for (const [fault, stream] of [
      ["stdin_stream_error", "stdin"],
      ["stdout_stream_error", "stdout"],
      ["stderr_stream_error", "stderr"],
    ] as const) {
      await assert.rejects(
        runPlatformReleaseBootstrapDarwinSuspendedExecContainedProcessFaultForTestV2(
          fault,
        ),
        (error: unknown) => {
          const primary = error instanceof AggregateError
            ? error.cause
            : error;
          return primary instanceof Error
            && primary.message.includes(`${stream} stream failed`)
            && typeof error === "object"
            && error !== null
            && "containmentProven" in error
            && error.containmentProven === true;
        },
      );
    }

    await assert.rejects(
      runPlatformReleaseBootstrapDarwinSuspendedExecContainedProcessFaultForTestV2(
        "group_kill_failure",
      ),
      (error: unknown) =>
        error instanceof AggregateError
        && error.cause instanceof Error
        && error.cause.message.includes("timed out")
        && error.errors.some((entry: unknown) =>
          entry instanceof Error
          && entry.message.includes("process-group kill failed"))
        && "containmentProven" in error
        && error.containmentProven === true,
    );

    await assert.rejects(
      runPlatformReleaseBootstrapDarwinSuspendedExecContainedProcessFaultForTestV2(
        "settlement_timeout",
      ),
      (error: unknown) =>
        error instanceof AggregateError
        && error.cause instanceof Error
        && error.cause.message.includes("timed out")
        && error.errors.some((entry: unknown) =>
          entry instanceof Error
          && entry.message.includes("did not settle after termination"))
        && "containmentProven" in error
        && error.containmentProven === true,
    );

    await assert.rejects(
      runPlatformReleaseBootstrapDarwinSuspendedExecContainedProcessFaultForTestV2(
        "death_unproven",
      ),
      (error: unknown) =>
        error instanceof AggregateError
        && error.cause instanceof Error
        && error.cause.message.includes("timed out")
        && error.errors.some((entry: unknown) =>
          entry instanceof Error
          && entry.message.includes("death was not proven by ESRCH"))
        && "containmentProven" in error
        && error.containmentProven === false,
    );
  });

  it("retains the build root after an outer builder fault despite outer group containment", {
    skip: process.platform !== "darwin",
  }, async () => {
    const retained = await observePlatformReleaseBootstrapDarwinSuspendedExecOuterBuilderFailureRetentionForTestV2();
    let disposition: unknown;
    try {
      assert.equal(retained.outerContainmentProven, true);
      assert.equal(existsSync(retained.buildRootAlias), true);
      assert.equal(existsSync(retained.buildRoot), true);
      assert.equal(
        statSync(retained.buildRoot, { bigint: true }).isDirectory(),
        true,
      );
    } finally {
      disposition = retained.dispose();
    }
    assertRetentionDispositionV2(disposition);
    assert.equal(existsSync(retained.buildRootAlias), true);
    assert.equal(existsSync(retained.buildRoot), true);
  });

  it("retains a successful builder root when its receipt cannot be parsed", {
    skip: process.platform !== "darwin",
  }, async () => {
    const retained =
      await observePlatformReleaseBootstrapDarwinSuspendedExecSuccessfulBuilderReceiptFailureRetentionForTestV2();
    assert.equal(retained.errorCode, "DARWIN_SUSPENDED_EXEC_BUILD_FAILED");
    assert.equal(existsSync(retained.buildRootAlias), true);
    assert.equal(existsSync(retained.buildRoot), true);
    assert.equal(existsSync(retained.controller), true);
    const copied = Object.freeze({ ...retained });
    assert.throws(
      () => copied.dispose(),
      (error: unknown) => isSuspendedFixtureErrorCodeV2(
        error,
        "DARWIN_SUSPENDED_EXEC_FIXTURE_HANDLE_UNAUTHENTICATED",
      ),
    );
    const extractedDispose = retained.dispose;
    assert.throws(
      () => Reflect.apply(extractedDispose, undefined, []),
      (error: unknown) => isSuspendedFixtureErrorCodeV2(
        error,
        "DARWIN_SUSPENDED_EXEC_FIXTURE_HANDLE_UNAUTHENTICATED",
      ),
    );
    assertRetentionDispositionV2(retained.dispose());
    assert.equal(existsSync(retained.buildRoot), true);
    assert.equal(existsSync(retained.controller), true);
  });

  it("logically disposes without mutating a replaced retained root", {
    skip: process.platform !== "darwin",
  }, async () => {
    const disposable =
      await buildPlatformReleaseBootstrapDarwinSuspendedExecFixtureForTestV2();
    const displaced = `${disposable.buildRoot}-displaced-logical-dispose-v2`;
    const retainedController = path.join(
      displaced,
      path.basename(disposable.controller),
    );
    const forged = Object.freeze({ ...disposable });
    assert.throws(
      () => forged.dispose(),
      (error: unknown) => isSuspendedFixtureErrorCodeV2(
        error,
        "DARWIN_SUSPENDED_EXEC_FIXTURE_HANDLE_UNAUTHENTICATED",
      ),
    );
    const extractedDispose = disposable.dispose;
    assert.throws(
      () => Reflect.apply(extractedDispose, undefined, []),
      (error: unknown) => isSuspendedFixtureErrorCodeV2(
        error,
        "DARWIN_SUSPENDED_EXEC_FIXTURE_HANDLE_UNAUTHENTICATED",
      ),
    );
    await assert.rejects(
      runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
        forged,
        { mode: "baseline", challenge: Buffer.alloc(32, 0x79) },
      ),
      (error: unknown) =>
        error instanceof PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2
        && error.code ===
          "DARWIN_SUSPENDED_EXEC_FIXTURE_HANDLE_UNAUTHENTICATED",
    );
    renameSync(disposable.buildRoot, displaced);
    mkdirSync(disposable.buildRoot, { mode: 0o700 });
    const sentinel = path.join(disposable.buildRoot, "foreign-sentinel");
    writeFileSync(sentinel, "foreign\n", { flag: "wx", mode: 0o600 });

    assertRetentionDispositionV2(disposable.dispose());
    assert.equal(readFileSync(sentinel, "utf8"), "foreign\n");
    assert.equal(existsSync(retainedController), true);
    await assert.rejects(
      runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
        disposable,
        { mode: "baseline", challenge: Buffer.alloc(32, 0x7a) },
      ),
      (error: unknown) =>
        error instanceof PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2
        && error.code ===
          "DARWIN_SUSPENDED_EXEC_FIXTURE_HANDLE_UNAUTHENTICATED",
    );
    assert.equal(readFileSync(sentinel, "utf8"), "foreign\n");
    assert.equal(existsSync(retainedController), true);
  });

  it("retains every run root and rejects disposal while its exact lease is active", {
    skip: process.platform !== "darwin",
  }, async () => {
    const active =
      await buildPlatformReleaseBootstrapDarwinSuspendedExecFixtureForTestV2();
    const pending =
      runPlatformReleaseBootstrapDarwinSuspendedExecPendingLeaseForTestV2(
        active,
      );
    const held = await pending.leaseHeld;
    assertRunResidueDispositionV2(held.residueDisposition);
    assert.equal(existsSync(held.runRoot), true);
    const displaced = `${held.runRoot}-displaced-logical-dispose-v2`;
    const retainedTarget = path.join(displaced, "target-v2");
    renameSync(held.runRoot, displaced);
    mkdirSync(held.runRoot, { mode: 0o700 });
    const sentinel = path.join(held.runRoot, "foreign-sentinel");
    writeFileSync(sentinel, "foreign\n", { flag: "wx", mode: 0o600 });

    try {
      assert.throws(
        () => active.dispose(),
        (error: unknown) => isSuspendedFixtureErrorCodeV2(
          error,
          "DARWIN_SUSPENDED_EXEC_FIXTURE_DISPOSE_INVALID",
        ),
      );
      assert.equal(readFileSync(sentinel, "utf8"), "foreign\n");
      assert.equal(existsSync(retainedTarget), true);
    } finally {
      pending.release();
    }

    const receipt = await pending.result;
    assertFalseAuthorityV2(receipt);
    assert.equal(readFileSync(sentinel, "utf8"), "foreign\n");
    assert.equal(existsSync(retainedTarget), true);
    assertRetentionDispositionV2(active.dispose());
    await assert.rejects(
      runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
        active,
        { mode: "baseline", challenge: Buffer.alloc(32, 0x7b) },
      ),
      (error: unknown) => isSuspendedFixtureErrorCodeV2(
        error,
        "DARWIN_SUSPENDED_EXEC_FIXTURE_HANDLE_UNAUTHENTICATED",
      ),
    );
    assert.equal(readFileSync(sentinel, "utf8"), "foreign\n");
    assert.equal(existsSync(retainedTarget), true);
  });

  it("continues only after exact held-vnode and dynamic Security observations", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_OUTER_TIMEOUT_MILLISECONDS_V2,
      12_000,
    );
    assert.ok(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_OUTER_TIMEOUT_MILLISECONDS_V2
        > 1_000 + 5_000 + 2_000 + 1_000,
    );
    assert.ok(fixture);
    const receipt = await runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
      fixture,
      { mode: "baseline", challenge: Buffer.alloc(32, 0x11) },
    );

    assertFalseAuthorityV2(receipt);
    assert.equal(Object.isFrozen(receipt), true);
    assert.equal(Object.isFrozen(receipt.heldExecutable), true);
    assert.equal(receipt.mode, "baseline");
    assert.deepEqual(receipt.spawnFlags, [
      "POSIX_SPAWN_START_SUSPENDED",
      "POSIX_SPAWN_CLOEXEC_DEFAULT",
    ]);
    if (receipt.outcome === "rejected_pre_user_entry_observation_unavailable") {
      assertSafeObservationUnavailableV2(receipt);
      return;
    }
    assert.equal(receipt.outcome, "continued_and_completed");
    assert.equal(receipt.mappedExecutable.matched, true);
    assert.ok(receipt.mappedExecutable.regionCountObserved > 0);
    assert.ok(receipt.mappedExecutable.matchingRegionCount > 0);
    assert.deepEqual(
      receipt.mappedExecutable.stableIdentity,
      receipt.heldExecutable.stableIdentity,
    );
    assert.equal(receipt.security.observedBeforeResume, true);
    assert.equal(receipt.security.guestLookupStatus, 0);
    assert.equal(receipt.security.validityStatus, 0);
    assert.equal(receipt.security.signingInformationStatus, 0);
    assert.ok((
      receipt.security.dynamicStatusFlags
        & PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_KSEC_CODE_STATUS_VALID_V2
    ) !== 0);
    assert.ok(receipt.security.digestAlgorithm > 0);
    assert.ok(receipt.security.cdhashByteLength > 0);
    assert.match(receipt.security.cdhash ?? "", /^[a-f0-9]+$/u);
    assert.equal(receipt.security.hasCms, false);
    assert.equal(receipt.security.hasIdentifier, true);
    assert.equal(receipt.security.signatureClass, "adhoc");
    assert.equal(
      receipt.security.signingInformationFlags
        & PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_KSEC_CODE_SIGNATURE_ADHOC_V2,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_KSEC_CODE_SIGNATURE_ADHOC_V2,
    );
    assert.equal(receipt.process.sigcontSent, true);
    assert.equal(receipt.process.sigkillSent, false);
    assert.equal(receipt.process.targetCanaryObserved, true);
    assert.equal(receipt.process.targetOutputState, "valid");
    assert.equal(receipt.process.heldPostExecutionUnchanged, true);
    assert.equal(receipt.process.reaped, true);
    assertExitedV2(receipt, 0);
    assert.deepEqual(
      parsePlatformReleaseBootstrapDarwinSuspendedExecBindingCandidateV2(
        structuredClone(receipt),
      ),
      receipt,
    );
  });

  it("kills a same-byte pre-spawn ABA replacement before its canary can run", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.ok(fixture);
    const receipt = await runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
      fixture,
      { mode: "pre_spawn_replacement", challenge: Buffer.alloc(32, 0x22) },
    );

    assertFalseAuthorityV2(receipt);
    assert.equal(receipt.mode, "pre_spawn_replacement");
    if (receipt.outcome === "rejected_pre_user_entry_observation_unavailable") {
      assertSafeObservationUnavailableV2(receipt);
      return;
    }
    assert.equal(receipt.outcome, "rejected_pre_user_entry_vnode_mismatch");
    assert.equal(receipt.mappedExecutable.matched, false);
    assert.equal(receipt.mappedExecutable.matchingRegionCount, 0);
    assert.equal(receipt.mappedExecutable.stableIdentity, null);
    assert.equal(receipt.process.sigcontSent, false);
    assert.equal(receipt.process.sigkillSent, true);
    assert.equal(receipt.process.targetCanaryObserved, false);
    assert.equal(receipt.process.targetOutputState, "none");
    assert.equal(receipt.process.reaped, true);
    assert.equal(receipt.process.heldPostExecutionUnchanged, true);
    assertSignaledV2(receipt, 9);
  });

  it("keeps the already-mapped original vnode across a post-spawn pathname rename", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.ok(fixture);
    const receipt = await runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
      fixture,
      { mode: "post_spawn_rename", challenge: Buffer.alloc(32, 0x33) },
    );

    assertFalseAuthorityV2(receipt);
    assert.equal(receipt.mode, "post_spawn_rename");
    if (receipt.outcome === "rejected_pre_user_entry_observation_unavailable") {
      assertSafeObservationUnavailableV2(receipt);
      return;
    }
    assert.equal(receipt.outcome, "continued_and_completed");
    assert.equal(receipt.mappedExecutable.matched, true);
    assert.deepEqual(
      receipt.mappedExecutable.stableIdentity,
      receipt.heldExecutable.stableIdentity,
    );
    assert.equal(receipt.process.sigcontSent, true);
    assert.equal(receipt.process.targetCanaryObserved, true);
    assert.equal(receipt.process.heldPostExecutionUnchanged, true);
    assert.equal(receipt.process.reaped, true);
    assertExitedV2(receipt, 0);
  });

  it("fails closed before SIGCONT when the PID Security observation is unavailable", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.ok(fixture);
    const receipt = await runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
      fixture,
      {
        mode: "security_observation_failure",
        challenge: Buffer.alloc(32, 0x44),
      },
    );

    assertFalseAuthorityV2(receipt);
    if (receipt.outcome === "rejected_pre_user_entry_observation_unavailable") {
      assertSafeObservationUnavailableV2(receipt);
      return;
    }
    assert.equal(receipt.outcome, "rejected_pre_user_entry_security_observation");
    assert.equal(receipt.mappedExecutable.matched, true);
    assert.notEqual(receipt.security.guestLookupStatus, 0);
    assert.equal(receipt.security.cdhash, null);
    assert.equal(receipt.security.cdhashByteLength, 0);
    assert.equal(receipt.security.hasCms, false);
    assert.equal(receipt.security.hasIdentifier, false);
    assert.equal(receipt.security.signatureClass, "unknown");
    assert.equal(receipt.security.signingInformationFlags, 0);
    assert.equal(receipt.process.sigcontSent, false);
    assert.equal(receipt.process.sigkillSent, true);
    assert.equal(receipt.process.targetCanaryObserved, false);
    assert.equal(receipt.process.targetOutputState, "none");
    assert.equal(receipt.process.reaped, true);
    assertSignaledV2(receipt, 9);
  });

  it("bounds malformed and timed-out targets and leaves no target process", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.ok(fixture);
    const malformed = await runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
      fixture,
      { mode: "malformed", challenge: Buffer.alloc(32, 0x55) },
    );
    if (malformed.outcome === "rejected_pre_user_entry_observation_unavailable") {
      assertSafeObservationUnavailableV2(malformed);
    } else {
      assert.equal(malformed.outcome, "continued_then_malformed");
      assert.equal(malformed.mappedExecutable.matched, true);
      assert.equal(malformed.process.sigcontSent, true);
      assert.equal(malformed.process.targetCanaryObserved, true);
      assert.equal(malformed.process.targetOutputState, "malformed");
      assert.equal(malformed.process.heldPostExecutionUnchanged, true);
      assert.equal(malformed.process.reaped, true);
      assertExitedV2(malformed, 0);
      assertFalseAuthorityV2(malformed);
    }

    const timedOut = await runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
      fixture,
      { mode: "timeout", challenge: Buffer.alloc(32, 0x66) },
    );
    if (timedOut.outcome === "rejected_pre_user_entry_observation_unavailable") {
      assertSafeObservationUnavailableV2(timedOut);
    } else {
      assert.equal(timedOut.outcome, "continued_then_timeout");
      assert.equal(timedOut.mappedExecutable.matched, true);
      assert.equal(timedOut.process.sigcontSent, true);
      assert.equal(timedOut.process.sigkillSent, true);
      assert.equal(timedOut.process.targetCanaryObserved, true);
      assert.equal(timedOut.process.targetOutputState, "timeout");
      assert.equal(timedOut.process.heldPostExecutionUnchanged, true);
      assert.equal(timedOut.process.reaped, true);
      assertSignaledV2(timedOut, 9);
      assertFalseAuthorityV2(timedOut);
    }

    const drifted = await runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
      fixture,
      { mode: "post_resume_drift", challenge: Buffer.alloc(32, 0x5d) },
    );
    if (drifted.outcome === "rejected_pre_user_entry_observation_unavailable") {
      assertSafeObservationUnavailableV2(drifted);
    } else {
      assert.equal(drifted.outcome, "failed_closed_post_resume_drift");
      assert.equal(drifted.mode, "post_resume_drift");
      assert.equal(drifted.mappedExecutable.matched, true);
      assert.equal(drifted.process.sigcontSent, true);
      assert.equal(drifted.process.targetCanaryObserved, true);
      assert.equal(drifted.process.targetOutputState, "valid");
      assert.equal(drifted.process.heldPostExecutionUnchanged, false);
      assert.equal(drifted.process.reaped, true);
      assertExitedV2(drifted, 0);
      assertFalseAuthorityV2(drifted);
    }
  });

  it("fails closed after an exact canary when the target exits nonzero or by signal", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.ok(fixture);
    const nonzero = await runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
      fixture,
      { mode: "canary_then_nonzero_exit", challenge: Buffer.alloc(32, 0x6e) },
    );
    if (nonzero.outcome === "rejected_pre_user_entry_observation_unavailable") {
      assertSafeObservationUnavailableV2(nonzero);
    } else {
      assert.equal(nonzero.mode, "canary_then_nonzero_exit");
      assert.equal(nonzero.outcome, "failed_closed_process_termination");
      assert.equal(nonzero.process.sigcontSent, true);
      assert.equal(nonzero.process.sigkillSent, false);
      assert.equal(nonzero.process.targetCanaryObserved, true);
      assert.equal(nonzero.process.targetOutputState, "valid");
      assert.equal(nonzero.process.heldPostExecutionUnchanged, true);
      assert.equal(nonzero.process.reaped, true);
      assertExitedV2(nonzero, 23);
      assertFalseAuthorityV2(nonzero);
    }

    const signaled = await runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
      fixture,
      { mode: "canary_then_signal", challenge: Buffer.alloc(32, 0x73) },
    );
    if (signaled.outcome === "rejected_pre_user_entry_observation_unavailable") {
      assertSafeObservationUnavailableV2(signaled);
    } else {
      assert.equal(signaled.mode, "canary_then_signal");
      assert.equal(signaled.outcome, "failed_closed_process_termination");
      assert.equal(signaled.process.sigcontSent, true);
      assert.equal(signaled.process.sigkillSent, false);
      assert.equal(signaled.process.targetCanaryObserved, true);
      assert.equal(signaled.process.targetOutputState, "valid");
      assert.equal(signaled.process.heldPostExecutionUnchanged, true);
      assert.equal(signaled.process.reaped, true);
      assertSignaledV2(signaled, 15);
      assertFalseAuthorityV2(signaled);
    }
  });

  it("rejects forged authority, incomplete continued Security joins, and malformed frames", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.ok(fixture);
    const receipt = await runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
      fixture,
      { mode: "baseline", challenge: Buffer.alloc(32, 0x77) },
    );
    for (const [field, forgedValue] of [
      ["productionAuthority", true],
      ["credentialUse", "developer_id"],
      ["descriptorExecution", true],
      ["libprocApiStability", "public_stable"],
      ["trustConclusion", "production_authority"],
    ] as const) {
      const forged = structuredClone(receipt) as Record<string, unknown>;
      forged[field] = forgedValue;
      assert.equal(
        PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema.safeParse(
          forged,
        ).success,
        false,
      );
    }
    const continuedTemplate = structuredClone(receipt) as Record<string, unknown>;
    continuedTemplate.mode = "baseline";
    continuedTemplate.outcome = "continued_and_completed";
    continuedTemplate.mappedExecutable = {
      matched: true,
      matchingRegionCount: 1,
      regionCountObserved: 1,
      stableIdentity: structuredClone(receipt.heldExecutable.stableIdentity),
    };
    continuedTemplate.process = {
      exitCode: 0,
      heldPostExecutionUnchanged: true,
      reaped: true,
      sigcontSent: true,
      sigkillSent: false,
      targetCanaryObserved: true,
      targetOutputState: "valid",
      terminationKind: "exited",
      terminationSignal: null,
    };
    continuedTemplate.security = {
      cdhash: "11".repeat(20),
      cdhashByteLength: 20,
      digestAlgorithm: 2,
      dynamicStatusFlags: 1,
      guestLookupStatus: 0,
      hasCms: false,
      hasIdentifier: true,
      observedBeforeResume: true,
      signatureClass: "adhoc",
      signingInformationFlags:
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_KSEC_CODE_SIGNATURE_ADHOC_V2,
      signingInformationStatus: 0,
      validityStatus: 0,
    };
    assert.equal(
      PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema.safeParse(
        continuedTemplate,
      ).success,
      true,
    );
    for (const processPatch of [
      { exitCode: 7 },
      { terminationSignal: 9 },
      { exitCode: null, terminationKind: "exited" },
      { exitCode: 0, terminationKind: "signaled", terminationSignal: 15 },
      { exitCode: null, terminationKind: "unknown", terminationSignal: null },
      { exitCode: null, terminationKind: "unknown", terminationSignal: 15 },
    ]) {
      const forged = structuredClone(continuedTemplate) as Record<string, unknown>;
      forged.process = {
        ...(forged.process as Record<string, unknown>),
        ...processPatch,
      };
      assert.equal(
        PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema.safeParse(
          forged,
        ).success,
        false,
      );
    }
    const nonzeroTermination = structuredClone(continuedTemplate) as Record<
      string,
      unknown
    >;
    nonzeroTermination.mode = "canary_then_nonzero_exit";
    nonzeroTermination.outcome = "failed_closed_process_termination";
    (nonzeroTermination.process as Record<string, unknown>).exitCode = 23;
    assert.equal(
      PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema.safeParse(
        nonzeroTermination,
      ).success,
      true,
    );
    const signalTermination = structuredClone(continuedTemplate) as Record<
      string,
      unknown
    >;
    signalTermination.mode = "canary_then_signal";
    signalTermination.outcome = "failed_closed_process_termination";
    signalTermination.process = {
      ...(signalTermination.process as Record<string, unknown>),
      exitCode: null,
      terminationKind: "signaled",
      terminationSignal: 15,
    };
    assert.equal(
      PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema.safeParse(
        signalTermination,
      ).success,
      true,
    );
    const unknownTermination = structuredClone(continuedTemplate) as Record<
      string,
      unknown
    >;
    unknownTermination.outcome = "failed_closed_process_termination";
    unknownTermination.process = {
      ...(unknownTermination.process as Record<string, unknown>),
      exitCode: null,
      terminationKind: "unknown",
      terminationSignal: null,
    };
    assert.equal(
      PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema.safeParse(
        unknownTermination,
      ).success,
      true,
    );
    for (const [template, processPatch] of [
      [nonzeroTermination, { exitCode: 22 }],
      [signalTermination, { terminationSignal: 9 }],
    ] as const) {
      const forged = structuredClone(template) as Record<string, unknown>;
      forged.process = {
        ...(forged.process as Record<string, unknown>),
        ...processPatch,
      };
      assert.equal(
        PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema.safeParse(
          forged,
        ).success,
        false,
      );
    }
    const driftedTemplate = structuredClone(continuedTemplate) as Record<
      string,
      unknown
    >;
    driftedTemplate.mode = "post_resume_drift";
    driftedTemplate.outcome = "failed_closed_post_resume_drift";
    (driftedTemplate.process as Record<string, unknown>)
      .heldPostExecutionUnchanged = false;
    assert.equal(
      PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema.safeParse(
        driftedTemplate,
      ).success,
      true,
    );
    const hiddenCompletedDrift = structuredClone(continuedTemplate) as Record<
      string,
      unknown
    >;
    (hiddenCompletedDrift.process as Record<string, unknown>)
      .heldPostExecutionUnchanged = false;
    assert.equal(
      PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema.safeParse(
        hiddenCompletedDrift,
      ).success,
      false,
    );
    const hiddenMalformedDrift = structuredClone(continuedTemplate) as Record<
      string,
      unknown
    >;
    hiddenMalformedDrift.mode = "malformed";
    hiddenMalformedDrift.outcome = "continued_then_malformed";
    hiddenMalformedDrift.process = {
      ...(hiddenMalformedDrift.process as Record<string, unknown>),
      heldPostExecutionUnchanged: false,
      targetOutputState: "malformed",
    };
    assert.equal(
      PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema.safeParse(
        hiddenMalformedDrift,
      ).success,
      false,
    );
    const hiddenTimeoutDrift = structuredClone(continuedTemplate) as Record<
      string,
      unknown
    >;
    hiddenTimeoutDrift.mode = "timeout";
    hiddenTimeoutDrift.outcome = "continued_then_timeout";
    hiddenTimeoutDrift.process = {
      ...(hiddenTimeoutDrift.process as Record<string, unknown>),
      heldPostExecutionUnchanged: false,
      sigkillSent: true,
      targetOutputState: "timeout",
    };
    assert.equal(
      PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema.safeParse(
        hiddenTimeoutDrift,
      ).success,
      false,
    );
    for (const mutate of [
      (security: Record<string, unknown>) => { security.validityStatus = -1; },
      (security: Record<string, unknown>) => { security.guestLookupStatus = -1; },
      (security: Record<string, unknown>) => {
        security.cdhash = null;
        security.cdhashByteLength = 0;
      },
      (security: Record<string, unknown>) => { security.dynamicStatusFlags = 0; },
      (security: Record<string, unknown>) => { security.digestAlgorithm = 0; },
      (security: Record<string, unknown>) => {
        security.signingInformationFlags = 0;
      },
      (security: Record<string, unknown>) => { security.signatureClass = "signed"; },
      (security: Record<string, unknown>) => { security.hasCms = true; },
      (security: Record<string, unknown>) => {
        security.signingInformationStatus = -1;
      },
    ]) {
      const forged = structuredClone(continuedTemplate) as Record<string, unknown>;
      mutate(forged.security as Record<string, unknown>);
      assert.equal(
        PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema.safeParse(
          forged,
        ).success,
        false,
      );
    }
    const signed = structuredClone(continuedTemplate) as Record<string, unknown>;
    signed.security = {
      ...(signed.security as Record<string, unknown>),
      hasCms: true,
      hasIdentifier: true,
      signatureClass: "signed",
      signingInformationFlags: 0,
    };
    assert.equal(
      PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema.safeParse(
        signed,
      ).success,
      true,
    );
    const unsigned = structuredClone(continuedTemplate) as Record<string, unknown>;
    unsigned.security = {
      ...(unsigned.security as Record<string, unknown>),
      hasCms: false,
      hasIdentifier: false,
      signatureClass: "unsigned",
      signingInformationFlags: 0,
    };
    assert.equal(
      PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema.safeParse(
        unsigned,
      ).success,
      true,
    );

    const identity = structuredClone(receipt) as Record<string, unknown>;
    const reversed = Object.fromEntries(Object.entries(identity).reverse());
    assert.throws(
      () => parsePlatformReleaseBootstrapDarwinSuspendedExecNativeFrameForTestV2(
        Buffer.from(`${JSON.stringify(reversed)}\n`, "utf8"),
      ),
      (error: unknown) =>
        error instanceof PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2
        && error.code === "DARWIN_SUSPENDED_EXEC_FRAME_INVALID",
    );
    assert.throws(
      () => parsePlatformReleaseBootstrapDarwinSuspendedExecNativeFrameForTestV2(
        Buffer.from(`${canonicalJsonStringify(receipt)}\n{}\n`, "utf8"),
      ),
      (error: unknown) =>
        error instanceof PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2
        && error.code === "DARWIN_SUSPENDED_EXEC_FRAME_INVALID",
    );
    assert.throws(
      () => parsePlatformReleaseBootstrapDarwinSuspendedExecNativeFrameForTestV2(
        Buffer.from([0xff, 0x0a]),
      ),
      (error: unknown) =>
        error instanceof PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2
        && error.code === "DARWIN_SUSPENDED_EXEC_FRAME_INVALID",
    );
  });

  it("serializes no path, pid, fd, descriptor value, or capability", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.ok(fixture);
    const receipt = await runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
      fixture,
      { mode: "baseline", challenge: Buffer.alloc(32, 0x88) },
    );
    const serialized = canonicalJsonStringify(receipt);
    assert.equal(serialized.includes(fixture.buildRoot), false);
    assert.equal(serialized.includes(fixture.controller), false);
    assert.doesNotMatch(serialized, /"(?:path|pid|fd|fileDescriptor|capability)"/u);
    assert.deepEqual(Object.keys(receipt.process).sort(), [
      "exitCode",
      "heldPostExecutionUnchanged",
      "reaped",
      "sigcontSent",
      "sigkillSent",
      "targetCanaryObserved",
      "targetOutputState",
      "terminationKind",
      "terminationSignal",
    ]);
    assert.deepEqual(Object.keys(receipt).sort(), [
      "admissionScope",
      "credentialUse",
      "descriptorExecution",
      "heldExecutable",
      "libprocApiStability",
      "mappedExecutable",
      "mode",
      "observationReadiness",
      "outcome",
      "process",
      "productionAuthority",
      "schema",
      "security",
      "spawnFlags",
      "trustConclusion",
    ]);
  });

  it("rejects invalid challenges and modes before invoking native code", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.ok(fixture);
    await assert.rejects(
      runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
        fixture,
        { mode: "baseline", challenge: Buffer.alloc(31) },
      ),
      (error: unknown) =>
        error instanceof PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2
        && error.code === "DARWIN_SUSPENDED_EXEC_INPUT_INVALID",
    );
    await assert.rejects(
      runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
        fixture,
        {
          mode: "unbounded" as PlatformReleaseBootstrapDarwinSuspendedExecModeV2,
        },
      ),
      (error: unknown) =>
        error instanceof PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2
        && error.code === "DARWIN_SUSPENDED_EXEC_INPUT_INVALID",
    );
  });
});
