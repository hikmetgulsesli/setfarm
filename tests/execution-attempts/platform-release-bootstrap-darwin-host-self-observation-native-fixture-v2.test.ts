import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
import {
  chmod,
  lstat,
  readFile,
  rename,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_PRODUCTION_ERROR_CODE_V2,
  PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorV2,
  openProductionAuthenticatedDarwinFilesystemBackendV2,
} from "../../src/execution/platform-release-bootstrap-darwin-filesystem-backend-authority-v2.js";
import {
  PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2Schema,
} from "../../src/execution/schemas/platform-release-bootstrap-darwin-filesystem-backend-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_TRUST_CONFIGURATION_V2,
} from "../../src/execution/schemas/platform-release-bootstrap-darwin-native-distribution-v2.js";
import {
  activatePlatformReleaseBootstrapRegistryProductionV2,
  PlatformReleaseBootstrapRegistryProductionActivationErrorV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-activation-v2.js";
import {
  buildPlatformReleaseBootstrapDarwinHostSelfObservationFixtureForTestV2,
  capturePlatformReleaseBootstrapDarwinHostSelfObservationExecutableForTestV2,
  observePlatformReleaseBootstrapDarwinHostSelfObservationForTestV2,
  observePlatformReleaseBootstrapDarwinHostSelfObservationPendingLeaseForTestV2,
  observePlatformReleaseBootstrapDarwinHostSelfObservationSuccessfulBuilderReceiptFailureRetentionForTestV2,
  parsePlatformReleaseBootstrapDarwinHostSelfObservationNativeFrameForTestV2,
  PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2,
  runPlatformReleaseBootstrapDarwinHostSelfObservationContainedProcessFaultForTestV2,
} from "../../src/product-compiler/platform-release-bootstrap-darwin-host-self-observation-test-support-v2.js";
import {
  PlatformReleaseBootstrapDarwinHostSelfObservationV2Schema,
  parsePlatformReleaseBootstrapDarwinHostSelfObservationCandidateV2,
} from "../../src/execution/schemas/platform-release-bootstrap-darwin-host-self-observation-v2.js";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";

let fixture: Awaited<ReturnType<
  typeof buildPlatformReleaseBootstrapDarwinHostSelfObservationFixtureForTestV2
>> | undefined;

const SUPPORT_SOURCE_V2 = path.resolve(
  import.meta.dirname,
  "../../src/product-compiler/platform-release-bootstrap-darwin-host-self-observation-test-support-v2.ts",
);

before(async () => {
  if (process.platform !== "darwin") return;
  fixture = await buildPlatformReleaseBootstrapDarwinHostSelfObservationFixtureForTestV2();
});

after(() => {
  if (fixture !== undefined) {
    const buildRoot = fixture.buildRoot;
    const binary = fixture.binary;
    assertRetentionDispositionV2(fixture.dispose());
    assert.equal(existsSync(buildRoot), true);
    assert.equal(existsSync(binary), true);
  }
  fixture = undefined;
});

function assertRetentionDispositionV2(value: unknown): void {
  assert.deepEqual(value, {
    schema:
      "setfarm.platform-release-bootstrap-darwin-host-self-observation-fixture-retention-disposition.v2",
    admissionScope: "test_fixture",
    productionAuthority: false,
    deletionAuthority: false,
    filesystemMutationPerformed: false,
    rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2",
  });
  assert.equal(Object.isFrozen(value), true);
}

function isHostSelfFixtureErrorCodeV2(
  error: unknown,
  code: string,
): boolean {
  return error
      instanceof PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2
    && error.code === code;
}

function assertDescriptorAndContainmentSourceContractsV2(): void {
  const source = readFileSync(SUPPORT_SOURCE_V2, "utf8");
  assert.doesNotMatch(
    source,
    /\breadFileSync\b|\bspawnSync\b|\brmSync\b|\bunlinkSync\b|\brmdirSync\b/u,
  );

  const pin = source.slice(
    source.indexOf("function exactExecutablePinFromStatV2"),
    source.indexOf("function sameExactExecutablePinV2"),
  );
  for (const contract of [
    /!observed\.isFile\(\)/u,
    /observed\.nlink !== 1n/u,
    /\(observed\.mode & 0o7777n\) !== 0o500n/u,
    /observed\.size > BigInt\(MAX_BINARY_BYTES_V2\)/u,
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
    (source.match(/captureExactExecutableV2\(/gu)?.length ?? 0) >= 4,
    "build pin and both observation fences must share exact capture",
  );

  const receipt = source.slice(
    source.indexOf("function assertFixtureBuildPinV2"),
    source.indexOf("export type PlatformReleaseBootstrapDarwinHostSelfObservationContainedProcessFaultV2"),
  );
  assert.match(receipt, /Object\.keys\(buildReceipt\)\.sort\(\)/u);
  assert.match(receipt, /buildReceipt\.publicationPolicy !== PUBLICATION_POLICY_V2/u);
  assert.match(receipt, /buildReceipt\.stageWorkspacePolicy !== STAGE_WORKSPACE_POLICY_V2/u);
  assert.match(receipt, /captured\.pin\.device\.toString\(\)/u);
  assert.match(receipt, /captured\.pin\.inode\.toString\(\)/u);

  const runner = source.slice(
    source.indexOf("async function runContainedProcessV2"),
    source.indexOf("export async function runPlatformReleaseBootstrapDarwinHostSelfObservationContainedProcessFault"),
  );
  for (const contract of [
    /detached: true/u,
    /stdio: \["pipe", "pipe", "pipe"\]/u,
    /options\.stdin\.byteLength > options\.stdinByteLimit/u,
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
    source.indexOf("async function buildFixtureV2"),
    source.indexOf("function parseNativeFrameV2"),
  );
  assert.match(build, /built = await runContainedProcessV2\(/u);
  assert.doesNotMatch(build, /spawnSync\(/u);
  assert.doesNotMatch(build, /rmSync|unlinkSync|rmdirSync/u);
  assert.match(
    build,
    /does\s*\/\/ not create atomic same-UID deletion authority/u,
  );
  const invocationFailure = build.slice(
    build.indexOf("} catch (error) {"),
    build.indexOf("  try {", build.indexOf("} catch (error) {") + 1),
  );
  assert.doesNotMatch(invocationFailure, /rmSync\(/u);
  assert.match(invocationFailure, /inner clang\/xcrun group is quiescent/u);

  const privateRoot = source.slice(
    source.indexOf("function exactPrivateRootV2"),
    source.indexOf("function assertExecutableEvidenceCurrentV2"),
  );
  assert.doesNotMatch(privateRoot, /rmSync|unlinkSync|rmdirSync/u);
  const disposal = source.slice(
    source.indexOf("function disposeFixtureV2"),
    source.indexOf("type RetainedRootObservationFieldsV2"),
  );
  assert.match(
    disposal,
    /this: PlatformReleaseBootstrapDarwinHostSelfObservationFixtureV2/u,
  );
  assert.match(disposal, /state\.activeLeases !== 0/u);
  assert.match(
    disposal,
    /DARWIN_HOST_SELF_OBSERVATION_FIXTURE_DISPOSE_INVALID/u,
  );
  assert.match(disposal, /fixtureStatesV2\.delete\(fixture\)/u);
  assert.doesNotMatch(disposal, /rmSync|unlinkSync|rmdirSync/u);
  const retainedObservationDisposal = source.slice(
    source.indexOf("function disposeRetainedRootObservationV2"),
    source.indexOf("function sha256BytesV2"),
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
    source.indexOf("async function invokeNativeV2"),
    source.indexOf("function occurrenceHashV2"),
  );
  assert.match(invoke, /await runContainedProcessV2\(/u);
  assert.doesNotMatch(invoke, /Buffer\.concat|spawn\(/u);
  const observe = source.slice(
    source.indexOf("async function observePlatformReleaseBootstrapDarwinHostSelfObservationInternalV2"),
    source.indexOf("export async function observePlatformReleaseBootstrapDarwinHostSelfObservationForTestV2"),
  );
  assert.match(observe, /acquireFixtureLeaseV2\(fixture\)/u);
  assert.match(observe, /releaseFixtureLeaseV2\(fixtureState\)/u);
  assert.match(source, /dispose: disposeFixtureV2/u);
}

describe("Darwin Security.framework host self-observation fixture v2", () => {
  it("uses exact descriptor capture and contained process contracts", () => {
    assertDescriptorAndContainmentSourceContractsV2();
  });

  it("captures real executable identity/signing observations without authority", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.ok(fixture);
    assert.equal(Object.isFrozen(fixture.buildReceipt), true);
    assert.equal(
      Object.isFrozen(fixture.buildReceipt.binary),
      true,
    );
    assert.deepEqual(Object.keys(fixture.buildReceipt).sort(), [
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
    assert.equal(
      fixture.buildReceipt.schema,
      "setfarm.platform-release-bootstrap-darwin-host-self-observation-fixture-build-receipt.v2",
    );
    assert.equal(
      fixture.buildReceipt.publicationPolicy,
      "descriptor_exclusive_copy_no_replace_fsync_post_fence_false_authority_v2",
    );
    assert.equal(
      fixture.buildReceipt.stageWorkspacePolicy,
      "retained_on_success_or_failure_until_caller_root_disposal_false_authority_v2",
    );
    assert.equal(fixture.buildReceipt.trustConclusion, "characterization_only");
    const buildBinary = fixture.buildReceipt.binary as Readonly<
      Record<string, unknown>
    >;
    assert.deepEqual(Object.keys(buildBinary).sort(), [
      "architectureSet",
      "byteLength",
      "mode",
      "sha256",
      "stableIdentity",
    ]);
    const buildStableIdentity = buildBinary.stableIdentity as Readonly<
      Record<string, unknown>
    >;
    const binaryStat = statSync(fixture.binary, { bigint: true });
    assert.deepEqual(buildStableIdentity, {
      objectKind: "ordinary_file",
      device: binaryStat.dev.toString(),
      inode: binaryStat.ino.toString(),
    });
    assert.equal(Object.isFrozen(buildStableIdentity), true);
    const first = await observePlatformReleaseBootstrapDarwinHostSelfObservationForTestV2(
      fixture,
      { sequence: 1 },
    );
    const second = await observePlatformReleaseBootstrapDarwinHostSelfObservationForTestV2(
      fixture,
      { sequence: 2 },
    );

    for (const occurrence of [first, second]) {
      assert.equal(occurrence.schema, "setfarm.platform-release-bootstrap-darwin-host-self-observation-occurrence.v2");
      assert.equal(occurrence.admissionScope, "test_fixture");
      assert.equal(occurrence.productionAuthority, false);
      assert.equal(occurrence.challengeHash, occurrence.observation.challengeHash);
      assert.equal(occurrence.observation.admissionScope, "test_fixture");
      assert.equal(occurrence.observation.productionAuthority, false);
      assert.equal(occurrence.observation.productionAdmission, "forbidden");
      assert.equal(occurrence.observation.amfiProductionAdmission, "unproven");
      assert.equal(occurrence.observation.notarizationAdmission, "unproven");
      assert.equal(occurrence.observation.installerReceiptAdmission, "absent");
      assert.equal(occurrence.observation.signingAuthority, "security_framework_observation_only");
      assert.ok((occurrence.observation.dynamicStatusFlags & 0x1) !== 0);
      assert.match(occurrence.observation.executable.stableIdentity.hostIdentityHash, /^[a-f0-9]{64}$/u);
      assert.equal(occurrence.observation.executable.stableIdentity.objectKind, "ordinary_file");
      assert.match(occurrence.observation.executable.mutableFingerprint.contentHash, /^[a-f0-9]{64}$/u);
      assert.match(occurrence.observation.executable.stableIdentity.device, /^(?:0|[1-9][0-9]*)$/u);
      assert.match(occurrence.observation.executable.stableIdentity.inode, /^(?:0|[1-9][0-9]*)$/u);
      assert.match(occurrence.executablePhysicalIdentityHash, /^[a-f0-9]{64}$/u);
      assert.match(occurrence.executableMutableFingerprintHash, /^[a-f0-9]{64}$/u);
      assert.equal(
        parsePlatformReleaseBootstrapDarwinHostSelfObservationCandidateV2(
          structuredClone(occurrence.observation),
        ).observationHash,
        occurrence.observation.observationHash,
      );
      assert.equal(
        occurrence.executablePhysicalIdentityHash,
        first.executablePhysicalIdentityHash,
      );
      assert.equal(
        occurrence.executableMutableFingerprintHash,
        first.executableMutableFingerprintHash,
      );
    }
    assert.notEqual(first.challengeHash, second.challengeHash);
    assert.notEqual(first.occurrenceHash, second.occurrenceHash);
    assert.equal(
      first.observation.executable.mutableFingerprint.contentHash,
      second.observation.executable.mutableFingerprint.contentHash,
    );
    assert.equal(
      first.observation.executable.stableIdentity.device,
      second.observation.executable.stableIdentity.device,
    );
    assert.equal(
      first.observation.executable.stableIdentity.inode,
      second.observation.executable.stableIdentity.inode,
    );
    assert.equal(
      first.observation.executable.stableIdentity.hostIdentityHash,
      second.observation.executable.stableIdentity.hostIdentityHash,
    );
    assert.equal(
      first.observation.codeDirectory?.commitmentHash ?? null,
      second.observation.codeDirectory?.commitmentHash ?? null,
    );

    const touchedTime = new Date(Date.now() - 7_000);
    await utimes(fixture.binary, touchedTime, touchedTime);
    const touched = await observePlatformReleaseBootstrapDarwinHostSelfObservationForTestV2(
      fixture,
      { sequence: 3 },
    );
    assert.equal(
      touched.executablePhysicalIdentityHash,
      first.executablePhysicalIdentityHash,
    );
    assert.notEqual(
      touched.executableMutableFingerprintHash,
      first.executableMutableFingerprintHash,
    );

    const originalBytes = await readFile(fixture.binary);
    const replacementPath = path.join(fixture.buildRoot, "replacement-v2");
    const backupPath = path.join(fixture.buildRoot, "original-v2");
    await writeFile(replacementPath, originalBytes, { mode: 0o500 });
    await chmod(replacementPath, 0o500);
    await rename(fixture.binary, backupPath);
    await rename(replacementPath, fixture.binary);
    try {
      const replacementStat = await lstat(fixture.binary, { bigint: true });
      assert.notEqual(
        replacementStat.ino.toString(),
        first.observation.executable.stableIdentity.inode,
      );
      const replacementStableHash = createHash("sha256")
        .update(canonicalJsonStringify({
          hostIdentityHash: first.observation.executable.stableIdentity.hostIdentityHash,
          objectKind: "ordinary_file",
          device: replacementStat.dev.toString(),
          inode: replacementStat.ino.toString(),
        }), "utf8")
        .digest("hex");
      assert.notEqual(replacementStableHash, first.executablePhysicalIdentityHash);
      await assert.rejects(
        observePlatformReleaseBootstrapDarwinHostSelfObservationForTestV2(
          fixture,
          { sequence: 4 },
        ),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2
          && error.code === "DARWIN_HOST_SELF_OBSERVATION_EXECUTABLE_DRIFT",
      );
    } finally {
      await rename(fixture.binary, replacementPath);
      await rename(backupPath, fixture.binary);
    }
  });

  it("retains a successful builder root when its receipt cannot be parsed", {
    skip: process.platform !== "darwin",
  }, async () => {
    const retained =
      await observePlatformReleaseBootstrapDarwinHostSelfObservationSuccessfulBuilderReceiptFailureRetentionForTestV2();
    assert.equal(
      retained.errorCode,
      "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED",
    );
    assert.equal(existsSync(retained.buildRootAlias), true);
    assert.equal(existsSync(retained.buildRoot), true);
    assert.equal(existsSync(retained.binary), true);
    const copied = Object.freeze({ ...retained });
    assert.throws(
      () => copied.dispose(),
      (error: unknown) => isHostSelfFixtureErrorCodeV2(
        error,
        "DARWIN_HOST_SELF_OBSERVATION_FIXTURE_HANDLE_UNAUTHENTICATED",
      ),
    );
    const extractedDispose = retained.dispose;
    assert.throws(
      () => Reflect.apply(extractedDispose, undefined, []),
      (error: unknown) => isHostSelfFixtureErrorCodeV2(
        error,
        "DARWIN_HOST_SELF_OBSERVATION_FIXTURE_HANDLE_UNAUTHENTICATED",
      ),
    );
    assertRetentionDispositionV2(retained.dispose());
    assert.equal(existsSync(retained.buildRoot), true);
    assert.equal(existsSync(retained.binary), true);
  });

  it("logically disposes without mutating a replaced retained root", {
    skip: process.platform !== "darwin",
  }, async () => {
    const disposable =
      await buildPlatformReleaseBootstrapDarwinHostSelfObservationFixtureForTestV2();
    const displaced = `${disposable.buildRoot}-displaced-logical-dispose-v2`;
    const retainedBinary = path.join(displaced, path.basename(disposable.binary));
    const forged = Object.freeze({ ...disposable });
    assert.throws(
      () => forged.dispose(),
      (error: unknown) => isHostSelfFixtureErrorCodeV2(
        error,
        "DARWIN_HOST_SELF_OBSERVATION_FIXTURE_HANDLE_UNAUTHENTICATED",
      ),
    );
    const extractedDispose = disposable.dispose;
    assert.throws(
      () => Reflect.apply(extractedDispose, undefined, []),
      (error: unknown) => isHostSelfFixtureErrorCodeV2(
        error,
        "DARWIN_HOST_SELF_OBSERVATION_FIXTURE_HANDLE_UNAUTHENTICATED",
      ),
    );
    await assert.rejects(
      observePlatformReleaseBootstrapDarwinHostSelfObservationForTestV2(
        forged,
      ),
      (error: unknown) =>
        error
          instanceof PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2
        && error.code ===
          "DARWIN_HOST_SELF_OBSERVATION_FIXTURE_HANDLE_UNAUTHENTICATED",
    );
    renameSync(disposable.buildRoot, displaced);
    mkdirSync(disposable.buildRoot, { mode: 0o700 });
    const sentinel = path.join(disposable.buildRoot, "foreign-sentinel");
    writeFileSync(sentinel, "foreign\n", { flag: "wx", mode: 0o600 });

    assertRetentionDispositionV2(disposable.dispose());
    assert.equal(readFileSync(sentinel, "utf8"), "foreign\n");
    assert.equal(existsSync(retainedBinary), true);
    await assert.rejects(
      observePlatformReleaseBootstrapDarwinHostSelfObservationForTestV2(
        disposable,
      ),
      (error: unknown) =>
        error
          instanceof PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2
        && error.code ===
          "DARWIN_HOST_SELF_OBSERVATION_FIXTURE_HANDLE_UNAUTHENTICATED",
    );
    assert.equal(readFileSync(sentinel, "utf8"), "foreign\n");
    assert.equal(existsSync(retainedBinary), true);
  });

  it("rejects disposal while one exact host observation lease is active", {
    skip: process.platform !== "darwin",
  }, async () => {
    const active =
      await buildPlatformReleaseBootstrapDarwinHostSelfObservationFixtureForTestV2();
    const pending =
      observePlatformReleaseBootstrapDarwinHostSelfObservationPendingLeaseForTestV2(
        active,
      );
    assert.equal(await pending.leaseHeld, true);
    try {
      assert.throws(
        () => active.dispose(),
        (error: unknown) => isHostSelfFixtureErrorCodeV2(
          error,
          "DARWIN_HOST_SELF_OBSERVATION_FIXTURE_DISPOSE_INVALID",
        ),
      );
      assert.equal(existsSync(active.buildRoot), true);
      assert.equal(existsSync(active.binary), true);
    } finally {
      pending.release();
    }

    const occurrence = await pending.result;
    assert.equal(occurrence.admissionScope, "test_fixture");
    assert.equal(occurrence.productionAuthority, false);
    assertRetentionDispositionV2(active.dispose());
    await assert.rejects(
      observePlatformReleaseBootstrapDarwinHostSelfObservationForTestV2(
        active,
      ),
      (error: unknown) => isHostSelfFixtureErrorCodeV2(
        error,
        "DARWIN_HOST_SELF_OBSERVATION_FIXTURE_HANDLE_UNAUTHENTICATED",
      ),
    );
    assert.equal(existsSync(active.buildRoot), true);
    assert.equal(existsSync(active.binary), true);
  });

  it("fails closed on FIFO, oversized, and same-byte ABA executable captures", {
    skip: process.platform !== "darwin",
  }, () => {
    assert.ok(fixture);
    const alias = mkdtempSync(path.join(
      os.tmpdir(),
      "setfarm-host-self-observation-capture-adversarial-",
    ));
    const root = path.resolve(alias);
    try {
      chmodSync(root, 0o700);
      const fifo = path.join(root, "host-self-observation-fifo");
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
        () =>
          capturePlatformReleaseBootstrapDarwinHostSelfObservationExecutableForTestV2(
            fifo,
          ),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2
          && error.code === "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED",
      );

      const oversized = path.join(root, "host-self-observation-oversized");
      writeFileSync(
        oversized,
        Buffer.alloc((4 * 1024 * 1024) + 1, 0x61),
        { flag: "wx", mode: 0o500 },
      );
      chmodSync(oversized, 0o500);
      assert.throws(
        () =>
          capturePlatformReleaseBootstrapDarwinHostSelfObservationExecutableForTestV2(
            oversized,
          ),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2
          && error.code === "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED",
      );

      const candidate = path.join(root, "host-self-observation-candidate");
      const replacement = path.join(root, "host-self-observation-replacement");
      copyFileSync(fixture.binary, candidate);
      copyFileSync(fixture.binary, replacement);
      chmodSync(candidate, 0o500);
      chmodSync(replacement, 0o500);
      assert.throws(
        () =>
          capturePlatformReleaseBootstrapDarwinHostSelfObservationExecutableForTestV2(
            candidate,
            {
              beforePathIdentityFence: () => renameSync(replacement, candidate),
            },
          ),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2
          && error.code === "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED",
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
        runPlatformReleaseBootstrapDarwinHostSelfObservationContainedProcessFaultForTestV2(
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
      runPlatformReleaseBootstrapDarwinHostSelfObservationContainedProcessFaultForTestV2(
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
      runPlatformReleaseBootstrapDarwinHostSelfObservationContainedProcessFaultForTestV2(
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
      runPlatformReleaseBootstrapDarwinHostSelfObservationContainedProcessFaultForTestV2(
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

  it("rejects malformed challenge input and forged authority projections", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.ok(fixture);
    await assert.rejects(
      observePlatformReleaseBootstrapDarwinHostSelfObservationForTestV2(
        fixture,
        { challenge: Buffer.alloc(31) },
      ),
      (error: unknown) =>
        error instanceof PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2
        && error.code === "DARWIN_HOST_SELF_OBSERVATION_FRAME_INVALID",
    );

    const challenge = Buffer.alloc(32, 0x11);
    const occurrence = await observePlatformReleaseBootstrapDarwinHostSelfObservationForTestV2(
      fixture,
      { challenge },
    );
    const forged = structuredClone(occurrence.observation) as Record<string, unknown>;
    forged.productionAuthority = true;
    assert.equal(
      PlatformReleaseBootstrapDarwinHostSelfObservationV2Schema.safeParse(
        occurrence.observation,
      ).success,
      true,
    );
    assert.equal(
      PlatformReleaseBootstrapDarwinHostSelfObservationV2Schema.safeParse(forged).success,
      false,
    );

    const identity = structuredClone(occurrence.observation) as Record<string, unknown>;
    delete identity.observationHash;
    const stale = structuredClone(identity);
    stale.challengeHash = createHash("sha256")
      .update(Buffer.alloc(32, 0x22))
      .digest("hex");
    assert.throws(
      () => parsePlatformReleaseBootstrapDarwinHostSelfObservationNativeFrameForTestV2(
        Buffer.from(`${canonicalJsonStringify(stale)}\n`, "utf8"),
        challenge,
      ),
      (error: unknown) =>
        error instanceof PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2
        && error.code === "DARWIN_HOST_SELF_OBSERVATION_FRAME_INVALID",
    );
    assert.throws(
      () => parsePlatformReleaseBootstrapDarwinHostSelfObservationNativeFrameForTestV2(
        Buffer.from(`${JSON.stringify(Object.fromEntries(Object.entries(identity).reverse()))}\n`, "utf8"),
        challenge,
      ),
      (error: unknown) =>
        error instanceof PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2
        && error.code === "DARWIN_HOST_SELF_OBSERVATION_FRAME_INVALID",
    );
    for (const field of ["modifiedSeconds", "changedSeconds"] as const) {
      const timestampForged = structuredClone(identity) as Record<string, unknown>;
      const executable = timestampForged.executable as Record<string, unknown>;
      const mutableFingerprint = executable.mutableFingerprint as Record<string, unknown>;
      mutableFingerprint[field] = "0";
      assert.throws(
        () => parsePlatformReleaseBootstrapDarwinHostSelfObservationNativeFrameForTestV2(
          Buffer.from(`${canonicalJsonStringify(timestampForged)}\n`, "utf8"),
          challenge,
        ),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2
          && error.code === "DARWIN_HOST_SELF_OBSERVATION_FRAME_INVALID",
      );
    }
    assert.throws(
      () => parsePlatformReleaseBootstrapDarwinHostSelfObservationNativeFrameForTestV2(
        Buffer.from([0xff, 0x0a]),
        challenge,
      ),
      (error: unknown) =>
        error instanceof PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2
        && error.code === "DARWIN_HOST_SELF_OBSERVATION_FRAME_INVALID",
    );

    const receiptProjection =
      PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2Schema.safeParse(
        occurrence.observation,
      );
    assert.equal(receiptProjection.success, false);
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_TRUST_CONFIGURATION_V2.state,
      "unavailable",
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_TRUST_CONFIGURATION_V2.productionAdmission,
      "forbidden",
    );
  });

  it("keeps the zero-input production boundaries inert and preserves fixture evidence", {
    skip: process.platform !== "darwin",
  }, async () => {
    assert.ok(fixture);
    const occurrence = await observePlatformReleaseBootstrapDarwinHostSelfObservationForTestV2(
      fixture,
    );
    const beforeBytes = await readFile(fixture.binary);
    const beforeStat = await lstat(fixture.binary, { bigint: true });
    let fixtureReads = 0;
    const hostileFixtureEvidence = new Proxy(occurrence, {
      get() {
        fixtureReads += 1;
        throw new Error("production boundary must not inspect fixture evidence");
      },
    });

    await assert.rejects(
      Reflect.apply(openProductionAuthenticatedDarwinFilesystemBackendV2, undefined, [
        hostileFixtureEvidence,
      ]),
      (error: unknown) =>
        error instanceof PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorV2
        && error.code === PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_PRODUCTION_ERROR_CODE_V2,
    );
    assert.throws(
      () => Reflect.apply(activatePlatformReleaseBootstrapRegistryProductionV2, undefined, [
        hostileFixtureEvidence,
      ]),
      (error: unknown) =>
        error instanceof PlatformReleaseBootstrapRegistryProductionActivationErrorV2,
    );

    const afterBytes = await readFile(fixture.binary);
    const afterStat = await lstat(fixture.binary, { bigint: true });
    assert.deepEqual(afterBytes, beforeBytes);
    assert.equal(afterStat.dev, beforeStat.dev);
    assert.equal(afterStat.ino, beforeStat.ino);
    assert.equal(afterStat.size, beforeStat.size);
    assert.equal(occurrence.observation.productionAuthority, false);
    assert.equal(fixtureReads, 0);
  });
});
