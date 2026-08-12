import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import * as moduleExportProbeSupport from "../../src/product-compiler/platform-release-bootstrap-module-export-probe-test-support-v2.js";
import {
  buildPlatformReleaseBootstrapModuleExportProbeFixtureForTestV2,
  mutatePlatformReleaseBootstrapModuleExportProbeFixtureForTestV2,
  observePlatformReleaseBootstrapModuleExportProbeForTestV2,
  PlatformReleaseBootstrapModuleExportProbeErrorV2,
} from "../../src/product-compiler/platform-release-bootstrap-module-export-probe-test-support-v2.js";
import {
  PlatformReleaseBootstrapModuleExportProbeV2Schema,
  hashPlatformReleaseBootstrapModuleExportProbeV2,
  hashPlatformReleaseBootstrapModuleExportProbeOccurrenceV2,
  hashPlatformReleaseBootstrapModuleExportProbeProcessOccurrenceV2,
  parsePlatformReleaseBootstrapModuleExportProbeCandidateV2,
} from "../../src/execution/schemas/platform-release-bootstrap-module-export-probe-v2.js";

const SUPPORT_SOURCE_V2 = path.resolve(
  import.meta.dirname,
  "../../src/product-compiler/platform-release-bootstrap-module-export-probe-test-support-v2.ts",
);
const RUNNER_PROCESS_MARKER_V2 =
  "SETFARM_MODULE_EXPORT_PROBE_RUNNER_FAULT_V2";

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
    assert.ok(
      next > directoryCursor,
      `missing ordered directory contract: ${needle}`,
    );
    directoryCursor = next;
  }
  assert.match(directory, /new AggregateError\([\s\S]*cause: primary/u);

  const moduleCapture = source.slice(
    source.indexOf("function captureModuleV2"),
    source.indexOf("function assertFixtureLayoutV2"),
  );
  const orderedModuleNeedles = [
    "descriptor = openSync(",
    'faultForTest === "module_read_and_close_failure"',
    "throw new Error(\"Injected module descriptor read failure\")",
    "primary = directoryCaptureErrorV2(",
    "const descriptorToClose = descriptor",
    "descriptor = -1",
    "closeSync(descriptorToClose)",
    'faultForTest === "module_close_failure"',
    "primaryFirstDirectoryFailureV2(",
  ];
  let moduleCursor = -1;
  for (const needle of orderedModuleNeedles) {
    const next = moduleCapture.indexOf(needle, moduleCursor + 1);
    assert.ok(next > moduleCursor, `missing ordered module contract: ${needle}`);
    moduleCursor = next;
  }
  assert.doesNotMatch(moduleCapture, /finally\s*\{/u);
  assert.equal(moduleCapture.match(/closeSync\(/gu)?.length, 1);

  const runner = source.slice(
    source.indexOf("function runBoundedProbeV2"),
    source.indexOf("function parseChildExportsV2"),
  );
  for (const contract of [
    /detached: false/u,
    /child\.once\("error"/u,
    /child\.once\("close"/u,
    /child\.stdout\.once\("error"/u,
    /child\.stderr\.once\("error"/u,
    /inputStream\.once\("error"/u,
    /child\.kill\("SIGKILL"\)/u,
    /outputLimitLatched/u,
    /PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2/u,
    /TEST_PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2/u,
    /signalDirectChild\(true\)/u,
    /primaryFirstProbeFailureV2\(/u,
  ]) {
    assert.match(runner, contract);
  }
  assert.doesNotMatch(
    runner,
    /process\.kill|detached:\s*true|\bexec(?:File)?\b/u,
  );
  assert.doesNotMatch(
    runner,
    /faultForTest[^\n]*(?:executable|argv|env|cwd|pid|path)/u,
  );

  assert.equal(
    observePlatformReleaseBootstrapModuleExportProbeForTestV2.length,
    1,
  );
  assert.equal(
    buildPlatformReleaseBootstrapModuleExportProbeFixtureForTestV2.length,
    0,
  );
  assert.equal(
    mutatePlatformReleaseBootstrapModuleExportProbeFixtureForTestV2.length,
    2,
  );
  assert.deepEqual(Object.keys(moduleExportProbeSupport).sort(), [
    "PlatformReleaseBootstrapModuleExportProbeErrorV2",
    "buildPlatformReleaseBootstrapModuleExportProbeFixtureForTestV2",
    "mutatePlatformReleaseBootstrapModuleExportProbeFixtureForTestV2",
    "observePlatformReleaseBootstrapModuleExportProbeForTestV2",
  ]);
}

function probeFailureAggregateV2(
  error: PlatformReleaseBootstrapModuleExportProbeErrorV2,
): AggregateError {
  assert.ok(error.cause instanceof AggregateError);
  return error.cause;
}

describe("Darwin module/export operational probe v2", () => {
  it("uses bounded directory, descriptor, and direct-child probe contracts without changing exports", () => {
    assertSupportSourceContractV2();
  });

  it("loads both independent fixture occurrences and stays non-authoritative", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture =
      buildPlatformReleaseBootstrapModuleExportProbeFixtureForTestV2();
    try {
      const probe =
        await observePlatformReleaseBootstrapModuleExportProbeForTestV2(
          fixture,
          { challenge: Buffer.alloc(32, 0x51) },
        );

      assert.equal(probe.admissionScope, "test_fixture");
      assert.equal(probe.authorityState, "observed_test_fixture_unverified");
      assert.equal(probe.productionAuthority, false);
      assert.equal(probe.productionAdmission, "forbidden");
      assert.equal(probe.credentialUse, "none");
      assert.equal(probe.mutationAuthority, false);
      assert.equal(probe.trustConclusion, "characterization_only");
      assert.deepEqual(Object.keys(probe).sort(), [
        "admissionScope",
        "authorityState",
        "challengeHash",
        "credentialUse",
        "hostCompositionReceiptHash",
        "moduleRef",
        "mutationAuthority",
        "occurrences",
        "operationAbiHash",
        "operationAbiRef",
        "probeHash",
        "productionAdmission",
        "productionAuthority",
        "requiredExportSetHash",
        "requiredExports",
        "schema",
        "stableProjectionHash",
        "trustConclusion",
        "version",
      ]);
      assert.equal(probe.occurrences.length, 2);
      assert.equal(probe.occurrences[0]!.occurrenceRef, "first");
      assert.equal(probe.occurrences[1]!.occurrenceRef, "second");
      assert.equal(
        probe.occurrences[0]!.semanticProjectionHash,
        probe.occurrences[1]!.semanticProjectionHash,
      );
      assert.equal(
        probe.stableProjectionHash,
        probe.occurrences[0]!.semanticProjectionHash,
      );
      assert.notEqual(
        probe.occurrences[0]!.process.processOccurrenceHash,
        probe.occurrences[1]!.process.processOccurrenceHash,
      );
      assert.notDeepEqual(
        probe.occurrences[0]!.moduleObservation.stableIdentity,
        probe.occurrences[1]!.moduleObservation.stableIdentity,
      );
      assert.deepEqual(
        probe.occurrences[0]!.process.executableStableIdentity,
        probe.occurrences[1]!.process.executableStableIdentity,
      );
      assert.deepEqual(
        probe.occurrences[0]!.process.executableMutableFingerprint,
        probe.occurrences[1]!.process.executableMutableFingerprint,
      );
      assert.equal(
        probe.occurrences[0]!.process.executableContentHash,
        probe.occurrences[0]!.process.executableMutableFingerprint.contentHash,
      );
      assert.equal(
        probe.occurrences[0]!.process.argvHash,
        probe.occurrences[1]!.process.argvHash,
      );
      assert.deepEqual(
        probe.occurrences[0]!.observedExports,
        [
          {
            name: "acquireNetworkSandboxLaunchContextInternalV2",
            kind: "function",
          },
          { name: "runNetworkIsolatedV2", kind: "function" },
        ],
      );
      for (const occurrence of probe.occurrences) {
        assert.equal(occurrence.process.status, "exited");
        assert.equal(occurrence.process.exitCode, 0);
        assert.equal(occurrence.process.signal, null);
        assert.equal(occurrence.process.shell, "forbidden");
        assert.equal(
          occurrence.process.environmentPolicy,
          "exact_empty_environment_v2",
        );
        assert.equal(
          occurrence.moduleObservation.mutableFingerprint.contentHash,
          probe.moduleRef.contentHash,
        );
        assert.equal(
          occurrence.moduleObservation.mutableFingerprint.byteLength,
          probe.moduleRef.byteLength,
        );
        assert.equal(
          occurrence.moduleObservation.mutableFingerprint.mode,
          probe.moduleRef.mode,
        );
      }
      assert.equal(
        PlatformReleaseBootstrapModuleExportProbeV2Schema.safeParse(probe)
          .success,
        true,
      );
      assert.equal(
        parsePlatformReleaseBootstrapModuleExportProbeCandidateV2(
          structuredClone(probe),
        ).probeHash,
        probe.probeHash,
      );
      assert.equal(
        hashPlatformReleaseBootstrapModuleExportProbeV2(probe),
        probe.probeHash,
      );
    } finally {
      fixture.dispose();
    }
  });

  it("rejects malformed challenges, forged handles, authority, and export drift", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture =
      buildPlatformReleaseBootstrapModuleExportProbeFixtureForTestV2();
    try {
      await assert.rejects(
        observePlatformReleaseBootstrapModuleExportProbeForTestV2(fixture, {
          challenge: Buffer.alloc(31),
        }),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapModuleExportProbeErrorV2
          && error.code === "MODULE_EXPORT_PROBE_RECEIPT_INVALID",
      );
      await assert.rejects(
        observePlatformReleaseBootstrapModuleExportProbeForTestV2(fixture, {
          testFault: "arbitrary_command" as never,
        }),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapModuleExportProbeErrorV2
          && error.code === "MODULE_EXPORT_PROBE_RECEIPT_INVALID",
      );
      await assert.rejects(
        observePlatformReleaseBootstrapModuleExportProbeForTestV2({
          dispose() {},
        }),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapModuleExportProbeErrorV2
          && error.code === "MODULE_EXPORT_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
      );

      const probe =
        await observePlatformReleaseBootstrapModuleExportProbeForTestV2(
          fixture,
          { challenge: Buffer.alloc(32, 0x52) },
        );
      const forgedAuthority = structuredClone(probe) as Record<string, unknown>;
      forgedAuthority.productionAuthority = true;
      assert.equal(
        PlatformReleaseBootstrapModuleExportProbeV2Schema.safeParse(
          forgedAuthority,
        ).success,
        false,
      );

      const forgedExports = structuredClone(probe) as Record<string, any>;
      forgedExports.occurrences[0].observedExports[0].kind = "string";
      assert.equal(
        PlatformReleaseBootstrapModuleExportProbeV2Schema.safeParse(
          forgedExports,
        ).success,
        false,
      );

      const forgedProcess = structuredClone(probe) as Record<string, any>;
      forgedProcess.occurrences[0].process.executableContentHash = "0".repeat(64);
      const forgedOccurrence = forgedProcess.occurrences[0];
      delete forgedOccurrence.occurrenceHash;
      forgedOccurrence.occurrenceHash =
        hashPlatformReleaseBootstrapModuleExportProbeOccurrenceV2(
          forgedOccurrence,
        );
      delete forgedProcess.probeHash;
      forgedProcess.probeHash =
        hashPlatformReleaseBootstrapModuleExportProbeV2(forgedProcess as never);
      assert.equal(
        PlatformReleaseBootstrapModuleExportProbeV2Schema.safeParse(
          forgedProcess,
        ).success,
        false,
      );

      const forgedHost = structuredClone(probe) as Record<string, any>;
      for (const occurrence of forgedHost.occurrences) {
        occurrence.process.executableStableIdentity.hostIdentityHash =
          "e".repeat(64);
        const process = occurrence.process;
        delete process.processOccurrenceHash;
        process.processOccurrenceHash =
          hashPlatformReleaseBootstrapModuleExportProbeProcessOccurrenceV2(
            process,
          );
        delete occurrence.occurrenceHash;
        occurrence.occurrenceHash =
          hashPlatformReleaseBootstrapModuleExportProbeOccurrenceV2(occurrence);
      }
      delete forgedHost.probeHash;
      forgedHost.probeHash =
        hashPlatformReleaseBootstrapModuleExportProbeV2(forgedHost as never);
      assert.equal(
        PlatformReleaseBootstrapModuleExportProbeV2Schema.safeParse(forgedHost)
          .success,
        false,
      );

      mutatePlatformReleaseBootstrapModuleExportProbeFixtureForTestV2(
        fixture,
        "replace_first_same_bytes",
      );
      await assert.rejects(
        observePlatformReleaseBootstrapModuleExportProbeForTestV2(fixture, {
          challenge: Buffer.alloc(32, 0x53),
        }),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapModuleExportProbeErrorV2
          && error.code === "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT",
      );
    } finally {
      fixture.dispose();
    }
  });

  it("rejects a module that changes its required export closure", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture =
      buildPlatformReleaseBootstrapModuleExportProbeFixtureForTestV2();
    try {
      mutatePlatformReleaseBootstrapModuleExportProbeFixtureForTestV2(
        fixture,
        "append_extra_export",
      );
      await assert.rejects(
        observePlatformReleaseBootstrapModuleExportProbeForTestV2(fixture, {
          challenge: Buffer.alloc(32, 0x54),
        }),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapModuleExportProbeErrorV2
          && error.code === "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT",
      );
    } finally {
      fixture.dispose();
    }
  });

  it("bounds hostile root membership before retaining the cap-plus-one entry", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture =
      buildPlatformReleaseBootstrapModuleExportProbeFixtureForTestV2();
    try {
      mutatePlatformReleaseBootstrapModuleExportProbeFixtureForTestV2(
        fixture,
        "add_root_entry_over_limit",
      );
      await assert.rejects(
        observePlatformReleaseBootstrapModuleExportProbeForTestV2(
          fixture,
          { challenge: Buffer.alloc(32, 0x55) },
        ),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapModuleExportProbeErrorV2
          && error.code
            === "MODULE_EXPORT_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED"
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
        buildPlatformReleaseBootstrapModuleExportProbeFixtureForTestV2();
      try {
        let observed: unknown;
        try {
          await observePlatformReleaseBootstrapModuleExportProbeForTestV2(
            fixture,
            { testFault: fault },
          );
        } catch (error) {
          observed = error;
        }
        assert.ok(
          observed instanceof PlatformReleaseBootstrapModuleExportProbeErrorV2,
        );
        assert.equal(
          observed.code,
          "MODULE_EXPORT_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
        );
        if (fault === "directory_read_and_close_failure") {
          const aggregate = probeFailureAggregateV2(observed);
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

  it("preserves module read and close failures in primary-first order", {
    skip: process.platform !== "darwin",
  }, async () => {
    const dualFixture =
      buildPlatformReleaseBootstrapModuleExportProbeFixtureForTestV2();
    try {
      let observed: unknown;
      try {
        await observePlatformReleaseBootstrapModuleExportProbeForTestV2(
          dualFixture,
          { testFault: "module_read_and_close_failure" },
        );
      } catch (error) {
        observed = error;
      }
      assert.ok(
        observed instanceof PlatformReleaseBootstrapModuleExportProbeErrorV2,
      );
      assert.equal(observed.code, "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT");
      const aggregate = probeFailureAggregateV2(observed);
      assert.equal(aggregate.errors.length, 2);
      assert.equal(aggregate.cause, aggregate.errors[0]);
      const primary = aggregate.errors[0];
      const closeFailure = aggregate.errors[1];
      assert.ok(
        primary instanceof PlatformReleaseBootstrapModuleExportProbeErrorV2,
      );
      assert.match(
        primary.message,
        /Module could not be captured through one bounded descriptor/u,
      );
      assert.ok(primary.cause instanceof Error);
      assert.match(primary.cause.message, /descriptor read failure/u);
      assert.ok(
        closeFailure
          instanceof PlatformReleaseBootstrapModuleExportProbeErrorV2,
      );
      assert.match(closeFailure.message, /descriptor could not be closed/u);
      assert.ok(closeFailure.cause instanceof Error);
      assert.match(closeFailure.cause.message, /descriptor close failure/u);
    } finally {
      dualFixture.dispose();
    }

    const closeFixture =
      buildPlatformReleaseBootstrapModuleExportProbeFixtureForTestV2();
    try {
      let observed: unknown;
      try {
        await observePlatformReleaseBootstrapModuleExportProbeForTestV2(
          closeFixture,
          { testFault: "module_close_failure" },
        );
      } catch (error) {
        observed = error;
      }
      assert.ok(
        observed instanceof PlatformReleaseBootstrapModuleExportProbeErrorV2,
      );
      assert.equal(observed.code, "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT");
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
        buildPlatformReleaseBootstrapModuleExportProbeFixtureForTestV2();
      const startedAt = Date.now();
      try {
        await assert.rejects(
          observePlatformReleaseBootstrapModuleExportProbeForTestV2(
            fixture,
            { testFault: fault },
          ),
          (error: unknown) =>
            error instanceof PlatformReleaseBootstrapModuleExportProbeErrorV2
            && error.code === "MODULE_EXPORT_PROBE_PROCESS_FAILED"
            && error.message.includes(`${stream} stream failed`),
        );
        assert.ok(Date.now() - startedAt < 1_500);
      } finally {
        fixture.dispose();
      }
      assertNoRunnerFaultProcessV2();
    }

    const killFixture =
      buildPlatformReleaseBootstrapModuleExportProbeFixtureForTestV2();
    const killStartedAt = Date.now();
    try {
      let observed: unknown;
      try {
        await observePlatformReleaseBootstrapModuleExportProbeForTestV2(
          killFixture,
          { testFault: "direct_kill_failure" },
        );
      } catch (error) {
        observed = error;
      }
      assert.ok(
        observed instanceof PlatformReleaseBootstrapModuleExportProbeErrorV2,
      );
      assert.equal(observed.code, "MODULE_EXPORT_PROBE_TIMEOUT");
      const aggregate = probeFailureAggregateV2(observed);
      assert.equal(aggregate.cause, aggregate.errors[0]);
      assert.ok(aggregate.errors.length <= 3);
      assert.match((aggregate.errors[0] as Error).message, /timed out/u);
      assert.match(
        (aggregate.errors[1] as Error).message,
        /Injected module export probe direct-child termination failure/u,
      );
      assert.ok(Date.now() - killStartedAt < 1_500);
    } finally {
      killFixture.dispose();
    }
    assertNoRunnerFaultProcessV2();

    const closeFixture =
      buildPlatformReleaseBootstrapModuleExportProbeFixtureForTestV2();
    const closeStartedAt = Date.now();
    try {
      let observed: unknown;
      try {
        await observePlatformReleaseBootstrapModuleExportProbeForTestV2(
          closeFixture,
          { testFault: "close_suppressed" },
        );
      } catch (error) {
        observed = error;
      }
      assert.ok(
        observed instanceof PlatformReleaseBootstrapModuleExportProbeErrorV2,
      );
      assert.equal(observed.code, "MODULE_EXPORT_PROBE_TIMEOUT");
      const aggregate = probeFailureAggregateV2(observed);
      assert.equal(aggregate.cause, aggregate.errors[0]);
      assert.ok(aggregate.errors.length <= 4);
      assert.match((aggregate.errors[0] as Error).message, /timed out/u);
      assert.ok(aggregate.errors.some((entry: unknown) =>
        entry instanceof Error
        && entry.message.includes(
          "did not settle after direct-child termination",
        )));
      assert.ok(Date.now() - closeStartedAt < 1_500);
    } finally {
      closeFixture.dispose();
    }
    assertNoRunnerFaultProcessV2();
  });
});
