import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import * as metadataProbeSupport from "../../src/product-compiler/platform-release-bootstrap-darwin-metadata-probe-test-support-v2.js";
import {
  buildPlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2,
  mutatePlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2,
  observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2,
  PlatformReleaseBootstrapDarwinMetadataProbeErrorV2,
} from "../../src/product-compiler/platform-release-bootstrap-darwin-metadata-probe-test-support-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_CWD_TOKEN_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_TARGET_TOKEN_V2,
  PlatformReleaseBootstrapDarwinMetadataProbeV2Schema,
  hashPlatformReleaseBootstrapDarwinMetadataProbeV2,
  parsePlatformReleaseBootstrapDarwinMetadataProbeCandidateV2,
} from "../../src/execution/schemas/platform-release-bootstrap-darwin-metadata-probe-v2.js";

const SUPPORT_SOURCE_V2 = path.resolve(
  import.meta.dirname,
  "../../src/product-compiler/platform-release-bootstrap-darwin-metadata-probe-test-support-v2.ts",
);
const RUNNER_PROCESS_MARKER_V2 = "SETFARM_METADATA_PROBE_RUNNER_FAULT_V2";

function assertNoRunnerFaultProcessV2(): void {
  const observed = spawnSync("/bin/ps", ["-ax", "-o", "command="], {
    encoding: "utf8",
    env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" },
    maxBuffer: 2 * 1024 * 1024,
    timeout: 2_000,
    killSignal: "SIGKILL",
    shell: false,
  });
  assert.equal(observed.error, undefined);
  assert.equal(observed.status, 0, observed.stderr);
  assert.equal(
    observed.stdout.split("\n").some((line) =>
      line.includes(RUNNER_PROCESS_MARKER_V2)),
    false,
  );
}

function assertSupportSourceContractV2(): void {
  const source = readFileSync(SUPPORT_SOURCE_V2, "utf8");
  assert.doesNotMatch(source, /\breaddirSync\b/u);
  const directory = source.slice(
    source.indexOf("function primaryFirstDirectoryFailureV2"),
    source.indexOf("function exactPrivateRootV2"),
  );
  const orderedDirectoryNeedles = [
    "lstatSync(absolutePath, { bigint: true })",
    "opendirSync(absolutePath, { bufferSize: 1 })",
    "const entry = directory.readSync()",
    "if (entry.name.length < 1 || entry.name.length > 255)",
    "if (names.length >= options.maximumNames)",
    "names.push(entry.name)",
    "directory.closeSync()",
    "primaryFirstDirectoryFailureV2(",
    "after = lstatSync(absolutePath, { bigint: true })",
    "!sameDirectoryFingerprintV2(before, after)",
  ];
  let directoryCursor = -1;
  for (const needle of orderedDirectoryNeedles) {
    const next = directory.indexOf(needle, directoryCursor + 1);
    assert.ok(next > directoryCursor, `missing ordered directory contract: ${needle}`);
    directoryCursor = next;
  }
  assert.match(directory, /new AggregateError\([\s\S]*cause: primary/u);

  const fileCapture = source.slice(
    source.indexOf("function captureFileV2"),
    source.indexOf("function captureTargetV2"),
  );
  const orderedFileNeedles = [
    "descriptor = openSync(",
    'faultForTest === "file_read_and_close_failure"',
    "throw new Error(\"Injected metadata file descriptor read failure\")",
    "primary = directoryCaptureErrorV2(",
    "const descriptorToClose = descriptor",
    "descriptor = -1",
    "closeSync(descriptorToClose)",
    'faultForTest === "file_close_failure"',
    "primaryFirstDirectoryFailureV2(",
  ];
  let fileCursor = -1;
  for (const needle of orderedFileNeedles) {
    const next = fileCapture.indexOf(needle, fileCursor + 1);
    assert.ok(next > fileCursor, `missing ordered file contract: ${needle}`);
    fileCursor = next;
  }
  assert.doesNotMatch(fileCapture, /finally\s*\{/u);
  assert.equal(fileCapture.match(/closeSync\(/gu)?.length, 1);

  const runner = source.slice(
    source.indexOf("function runBoundedCommandV2"),
    source.indexOf("function commandObservationV2"),
  );
  for (const contract of [
    /detached: false/u,
    /child\.once\("error"/u,
    /child\.once\("close"/u,
    /child\.stdout\.once\("error"/u,
    /child\.stderr\.once\("error"/u,
    /child\.kill\("SIGKILL"\)/u,
    /outputLimitLatched/u,
    /PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2/u,
    /TEST_PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2/u,
    /signalDirectChild\(true\)/u,
    /primaryFirstCommandFailureV2\(/u,
  ]) {
    assert.match(runner, contract);
  }
  assert.doesNotMatch(runner, /process\.kill|detached:\s*true|\bexec(?:File)?\b/u);
  assert.doesNotMatch(runner, /faultForTest[^\n]*(?:executable|argv|env|cwd|pid|path)/u);

  assert.equal(
    observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2.length,
    1,
  );
  assert.equal(
    buildPlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2.length,
    0,
  );
  assert.equal(
    mutatePlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2.length,
    2,
  );
  assert.deepEqual(Object.keys(metadataProbeSupport).sort(), [
    "PlatformReleaseBootstrapDarwinMetadataProbeErrorV2",
    "buildPlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2",
    "mutatePlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2",
    "observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2",
  ]);
}

function commandFailureAggregateV2(
  error: PlatformReleaseBootstrapDarwinMetadataProbeErrorV2,
): AggregateError {
  assert.ok(error.cause instanceof AggregateError);
  return error.cause;
}

describe("Darwin metadata operational probe v2", () => {
  it("uses bounded directory, descriptor, and direct-child contracts without changing exports", () => {
    assertSupportSourceContractV2();
  });

  it("observes fixed xattr/ACL tools with a stable pre/post fence and no authority", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture =
      buildPlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2();
    try {
      const probe =
        await observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2(
          fixture,
          { challenge: Buffer.alloc(32, 0x41) },
        );

      assert.equal(probe.schema, "setfarm.platform-release-bootstrap-darwin-metadata-probe.v2");
      assert.equal(probe.admissionScope, "test_fixture");
      assert.equal(probe.authorityState, "observed_test_fixture_unverified");
      assert.equal(probe.productionAuthority, false);
      assert.equal(probe.productionAdmission, "forbidden");
      assert.equal(probe.credentialUse, "none");
      assert.equal(probe.mutationAuthority, false);
      assert.equal(probe.trustConclusion, "characterization_only");
      assert.equal(probe.targetBinding, "private_fixture_path_revalidated_v2");
      assert.equal(probe.implementationScope, "test_fixture_direct_tools_v2");
      assert.equal(probe.observationOutcome, "metadata_policy_satisfied");
      assert.equal(probe.before.observedEntryCount, 1);
      assert.equal(probe.before.target.directEntryNames[0], "entry.txt");
      assert.equal(probe.before.metadataState.xattr.status, "clear");
      assert.equal(probe.before.metadataState.xattr.observedNameCount, 0);
      assert.equal(probe.before.metadataState.acl.status, "clear");
      assert.deepEqual(probe.before, probe.after);
      assert.equal(probe.before.tools.length, 2);
      assert.deepEqual(
        probe.before.tools.map((tool) => tool.toolRef),
        ["XATTR_OBSERVER_V2", "ACL_OBSERVER_V2"],
      );
      assert.deepEqual(
        probe.before.tools.map((tool) => tool.command.executable),
        ["/usr/bin/xattr", "/bin/ls"],
      );
      assert.deepEqual(
        probe.before.tools.map((tool) => tool.command.argv[0]),
        ["-l", "-lde@"],
      );
      for (const tool of probe.before.tools) {
        assert.equal(
          tool.command.argv[1],
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_TARGET_TOKEN_V2,
        );
        assert.equal(
          tool.command.cwdLocator,
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_CWD_TOKEN_V2,
        );
      }
      assert.equal(JSON.stringify(probe).includes("/var/folders/"), false);
      for (const tool of probe.before.tools) {
        assert.equal(tool.command.shell, "forbidden");
        assert.equal(tool.command.environmentPolicy, "deny_all_empty_v2");
        assert.equal(tool.command.status, "exited");
        assert.equal(tool.command.exitCode, 0);
        assert.equal(tool.command.signal, null);
        assert.ok(tool.command.stdoutByteLength <= 64 * 1024);
        assert.ok(tool.command.stderrByteLength <= 64 * 1024);
        assert.equal(tool.stableIdentity.objectKind, "ordinary_file");
        assert.equal(tool.mutableFingerprint.contentHash.length, 64);
      }
      assert.equal(probe.before.target.stableIdentity.objectKind, "directory");
      assert.notDeepEqual(
        probe.before.target.stableIdentity,
        probe.before.tools[0]!.stableIdentity,
      );
      assert.notEqual(
        probe.before.tools[0]!.stableIdentity.inode,
        probe.before.tools[1]!.stableIdentity.inode,
      );
      assert.equal(
        PlatformReleaseBootstrapDarwinMetadataProbeV2Schema.safeParse(probe)
          .success,
        true,
      );
      assert.equal(
        parsePlatformReleaseBootstrapDarwinMetadataProbeCandidateV2(
          structuredClone(probe),
        ).probeHash,
        probe.probeHash,
      );
      assert.equal(
        hashPlatformReleaseBootstrapDarwinMetadataProbeV2(probe),
        probe.probeHash,
      );
      assert.deepEqual(Object.keys(probe).sort(), [
        "admissionScope",
        "after",
        "authorityState",
        "before",
        "challengeHash",
        "credentialUse",
        "hostCompositionReceiptHash",
        "implementationScope",
        "metadataCatalogHash",
        "metadataObservationHash",
        "metadataPolicyHash",
        "mutationAuthority",
        "observationOutcome",
        "observedEntryCount",
        "operationAbiHash",
        "operationAbiRef",
        "probeHash",
        "productionAdmission",
        "productionAuthority",
        "schema",
        "targetBinding",
        "targetRootPhysicalIdentityHash",
        "trustConclusion",
        "version",
      ]);
      assert.equal("stdout" in probe, false);
      assert.equal("stderr" in probe, false);
    } finally {
      fixture.dispose();
    }
  });

  it("rejects malformed challenges, forged handles, authority, and target joins", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture =
      buildPlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2();
    try {
      await assert.rejects(
        observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2(fixture, {
          challenge: Buffer.alloc(31),
        }),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2
          && error.code === "METADATA_PROBE_RECEIPT_INVALID",
      );
      await assert.rejects(
        observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2({ dispose() {} }),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2
          && error.code === "METADATA_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
      );
      await assert.rejects(
        observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2(
          fixture,
          { testFault: "arbitrary_command" as never },
        ),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2
          && error.code === "METADATA_PROBE_RECEIPT_INVALID",
      );

      const probe =
        await observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2(
          fixture,
          { challenge: Buffer.alloc(32, 0x42) },
        );
      const forgedAuthority = structuredClone(probe) as Record<string, unknown>;
      forgedAuthority.productionAuthority = true;
      assert.equal(
        PlatformReleaseBootstrapDarwinMetadataProbeV2Schema.safeParse(
          forgedAuthority,
        ).success,
        false,
      );
      const forgedTarget = structuredClone(probe) as Record<string, any>;
      forgedTarget.before.target.stableIdentity.inode = "999999999";
      assert.equal(
        PlatformReleaseBootstrapDarwinMetadataProbeV2Schema.safeParse(
          forgedTarget,
        ).success,
        false,
      );
      const forgedCommand = structuredClone(probe) as Record<string, any>;
      forgedCommand.before.tools[0].command.executable = "/bin/sh";
      assert.equal(
        PlatformReleaseBootstrapDarwinMetadataProbeV2Schema.safeParse(
          forgedCommand,
        ).success,
        false,
      );
      const forgedPolicy = structuredClone(probe) as Record<string, any>;
      forgedPolicy.metadataPolicyHash = "0".repeat(64);
      assert.equal(
        PlatformReleaseBootstrapDarwinMetadataProbeV2Schema.safeParse(
          forgedPolicy,
        ).success,
        false,
      );
      const forgedSystemState = structuredClone(probe) as Record<string, any>;
      forgedSystemState.before.metadataState.xattr.systemManagedNamesHash =
        "0".repeat(64);
      assert.equal(
        PlatformReleaseBootstrapDarwinMetadataProbeV2Schema.safeParse(
          forgedSystemState,
        ).success,
        false,
      );
    } finally {
      fixture.dispose();
    }
  });

  it("fails closed on same-byte inode replacement, namespace drift, and symlink targets", {
    skip: process.platform !== "darwin",
  }, async () => {
    for (const mutation of [
      "replace_target_same_bytes",
      "add_target_entry",
      "add_target_xattr",
      "replace_target_with_symlink",
    ] as const) {
      const fixture =
        buildPlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2();
      try {
        mutatePlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2(
          fixture,
          mutation,
        );
        await assert.rejects(
          observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2(
            fixture,
            { challenge: Buffer.alloc(32, 0x43) },
          ),
          (error: unknown) =>
            error instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2
            && (
              error.code === "METADATA_PROBE_FILESYSTEM_DRIFT"
              || error.code === "METADATA_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED"
              || error.code === "METADATA_PROBE_METADATA_NOT_CLEAR"
            ),
        );
      } finally {
        fixture.dispose();
      }
    }
  });

  it("bounds hostile target membership before retaining the cap-plus-one entry", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture =
      buildPlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2();
    try {
      mutatePlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2(
        fixture,
        "add_target_entries_over_limit",
      );
      await assert.rejects(
        observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2(
          fixture,
          {
            challenge: Buffer.alloc(32, 0x44),
            testFault: "target_membership_cap",
          },
        ),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2
          && error.code === "METADATA_PROBE_FILESYSTEM_DRIFT"
          && error.message.includes("exceeds its bounded member set"),
      );
    } finally {
      fixture.dispose();
    }
  });

  it("preserves directory read and close failures in primary-first order", {
    skip: process.platform !== "darwin",
  }, async () => {
    for (const fault of [
      "directory_read_failure",
      "directory_close_failure",
      "directory_read_and_close_failure",
    ] as const) {
      const fixture =
        buildPlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2();
      try {
        let observed: unknown;
        try {
          await observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2(
            fixture,
            { testFault: fault },
          );
        } catch (error) {
          observed = error;
        }
        assert.ok(
          observed instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2,
        );
        assert.equal(
          observed.code,
          "METADATA_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
        );
        if (fault === "directory_read_and_close_failure") {
          const aggregate = commandFailureAggregateV2(observed);
          assert.equal(aggregate.errors.length, 2);
          assert.equal(aggregate.cause, aggregate.errors[0]);
          assert.match(
            (aggregate.errors[0] as Error).message,
            /membership could not be captured/u,
          );
          assert.match(
            (aggregate.errors[1] as Error).message,
            /descriptor could not be closed/u,
          );
        } else {
          assert.equal(observed.cause instanceof AggregateError, false);
          assert.match(
            observed.message,
            fault === "directory_read_failure"
              ? /membership could not be captured/u
              : /descriptor could not be closed/u,
          );
        }
      } finally {
        fixture.dispose();
      }
    }
  });

  it("preserves file read and close failures in primary-first order", {
    skip: process.platform !== "darwin",
  }, async () => {
    const dualFixture =
      buildPlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2();
    try {
      let observed: unknown;
      try {
        await observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2(
          dualFixture,
          { testFault: "file_read_and_close_failure" },
        );
      } catch (error) {
        observed = error;
      }
      assert.ok(
        observed instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2,
      );
      assert.equal(observed.code, "METADATA_PROBE_FILESYSTEM_DRIFT");
      const aggregate = commandFailureAggregateV2(observed);
      assert.equal(aggregate.errors.length, 2);
      assert.equal(aggregate.cause, aggregate.errors[0]);
      const primary = aggregate.errors[0];
      const closeFailure = aggregate.errors[1];
      assert.ok(
        primary instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2,
      );
      assert.match(primary.message, /Metadata tool could not be captured/u);
      assert.ok(primary.cause instanceof Error);
      assert.match(primary.cause.message, /descriptor read failure/u);
      assert.ok(
        closeFailure
          instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2,
      );
      assert.match(closeFailure.message, /descriptor could not be closed/u);
      assert.ok(closeFailure.cause instanceof Error);
      assert.match(closeFailure.cause.message, /descriptor close failure/u);
    } finally {
      dualFixture.dispose();
    }

    const closeFixture =
      buildPlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2();
    try {
      let observed: unknown;
      try {
        await observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2(
          closeFixture,
          { testFault: "file_close_failure" },
        );
      } catch (error) {
        observed = error;
      }
      assert.ok(
        observed instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2,
      );
      assert.equal(observed.code, "METADATA_PROBE_FILESYSTEM_DRIFT");
      assert.equal(observed.cause instanceof AggregateError, false);
      assert.match(observed.message, /descriptor could not be closed/u);
      assert.ok(observed.cause instanceof Error);
      assert.match(observed.cause.message, /descriptor close failure/u);
    } finally {
      closeFixture.dispose();
    }
  });

  it("contains fixed stream, kill-fallback, and close-suppressed runner faults", {
    skip: process.platform !== "darwin",
  }, async () => {
    for (const [fault, stream] of [
      ["stdout_stream_error", "stdout"],
      ["stderr_stream_error", "stderr"],
    ] as const) {
      const fixture =
        buildPlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2();
      const startedAt = Date.now();
      try {
        await assert.rejects(
          observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2(
            fixture,
            { testFault: fault },
          ),
          (error: unknown) =>
            error instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2
            && error.code === "METADATA_PROBE_PROCESS_FAILED"
            && error.message.includes(`${stream} stream failed`),
        );
        assert.ok(Date.now() - startedAt < 1_500);
      } finally {
        fixture.dispose();
      }
      assertNoRunnerFaultProcessV2();
    }

    const killFixture =
      buildPlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2();
    const killStartedAt = Date.now();
    try {
      let observed: unknown;
      try {
        await observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2(
          killFixture,
          { testFault: "direct_kill_failure" },
        );
      } catch (error) {
        observed = error;
      }
      assert.ok(
        observed instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2,
      );
      assert.equal(observed.code, "METADATA_PROBE_TIMEOUT");
      const aggregate = commandFailureAggregateV2(observed);
      assert.equal(aggregate.cause, aggregate.errors[0]);
      assert.ok(aggregate.errors.length <= 3);
      assert.match((aggregate.errors[0] as Error).message, /timed out/u);
      assert.match(
        (aggregate.errors[1] as Error).message,
        /Injected metadata command direct-child termination failure/u,
      );
      assert.ok(Date.now() - killStartedAt < 1_500);
    } finally {
      killFixture.dispose();
    }
    assertNoRunnerFaultProcessV2();

    const closeFixture =
      buildPlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2();
    const closeStartedAt = Date.now();
    try {
      let observed: unknown;
      try {
        await observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2(
          closeFixture,
          { testFault: "close_suppressed" },
        );
      } catch (error) {
        observed = error;
      }
      assert.ok(
        observed instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2,
      );
      assert.equal(observed.code, "METADATA_PROBE_TIMEOUT");
      const aggregate = commandFailureAggregateV2(observed);
      assert.equal(aggregate.cause, aggregate.errors[0]);
      assert.ok(aggregate.errors.length <= 4);
      assert.match((aggregate.errors[0] as Error).message, /timed out/u);
      assert.ok(aggregate.errors.some((entry: unknown) =>
        entry instanceof Error
        && entry.message.includes("did not settle after direct-child termination")));
      assert.ok(Date.now() - closeStartedAt < 1_500);
    } finally {
      closeFixture.dispose();
    }
    assertNoRunnerFaultProcessV2();
  });
});
