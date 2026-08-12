import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import * as closureProbeSupport from "../../src/product-compiler/platform-release-bootstrap-required-module-closure-probe-test-support-v2.js";
import {
  buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2,
  mutatePlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2,
  observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2,
  PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2,
} from "../../src/product-compiler/platform-release-bootstrap-required-module-closure-probe-test-support-v2.js";
import {
  PlatformReleaseRequiredModuleClosureProbeV2Schema,
  hashPlatformReleaseRequiredModuleClosureProbeEntryV2,
  hashPlatformReleaseRequiredModuleClosureProbeModuleObservationV2,
  hashPlatformReleaseRequiredModuleClosureProbeObservationV2,
  hashPlatformReleaseRequiredModuleClosureProbeOccurrenceV2,
  hashPlatformReleaseRequiredModuleClosureProbeV2,
  parsePlatformReleaseRequiredModuleClosureProbeCandidateV2,
} from "../../src/execution/schemas/platform-release-bootstrap-required-module-closure-probe-v2.js";
import {
  getPlatformReleaseRequiredModuleRequirementV2,
} from "../../src/execution/schemas/platform-release-required-module-closure-v2.js";

const SUPPORT_SOURCE_V2 = path.resolve(
  import.meta.dirname,
  "../../src/product-compiler/platform-release-bootstrap-required-module-closure-probe-test-support-v2.ts",
);
const RUNNER_PROCESS_MARKER_V2 =
  "SETFARM_REQUIRED_MODULE_CLOSURE_PROBE_RUNNER_FAULT_V2";

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
    source.indexOf("function primaryFirstCaptureFailureV2"),
    source.indexOf("type CapturePolicyV2"),
  );
  const orderedDirectoryNeedles = [
    "lstatSync(absolutePath, { bigint: true })",
    "opendirSync(absolutePath, { bufferSize: 1 })",
    "const entry = directory.readSync()",
    "if (entry.name.length < 1 || entry.name.length > 255)",
    "if (names.length >= options.maximumNames)",
    "names.push(entry.name)",
    "directory.closeSync()",
    "primaryFirstCaptureFailureV2(",
    "after = lstatSync(absolutePath, { bigint: true })",
    "!sameDirectoryFingerprintV2(before, after)",
  ];
  let directoryCursor = -1;
  for (const needle of orderedDirectoryNeedles) {
    const next = directory.indexOf(needle, directoryCursor + 1);
    assert.ok(next > directoryCursor, `missing directory contract: ${needle}`);
    directoryCursor = next;
  }
  assert.match(directory, /new AggregateError\([\s\S]*cause: primary/u);

  const fileCapture = source.slice(
    source.indexOf("function captureFileV2"),
    source.indexOf("function captureNodeExecutableV2"),
  );
  const orderedFileNeedles = [
    "descriptor = openSync(",
    'faultForTest === "file_read_and_close_failure"',
    "throw new Error(\"Injected closure file descriptor read failure\")",
    "primary = captureErrorV2(",
    "const descriptorToClose = descriptor",
    "descriptor = -1",
    "closeSync(descriptorToClose)",
    'faultForTest === "file_close_failure"',
    "primaryFirstCaptureFailureV2(",
  ];
  let fileCursor = -1;
  for (const needle of orderedFileNeedles) {
    const next = fileCapture.indexOf(needle, fileCursor + 1);
    assert.ok(next > fileCursor, `missing file contract: ${needle}`);
    fileCursor = next;
  }
  assert.doesNotMatch(fileCapture, /finally\s*\{/u);
  assert.equal(fileCapture.match(/closeSync\(/gu)?.length, 1);

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
    observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2.length,
    1,
  );
  assert.equal(
    buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2.length,
    0,
  );
  assert.equal(
    mutatePlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2.length,
    2,
  );
  assert.deepEqual(Object.keys(closureProbeSupport).sort(), [
    "PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2",
    "buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2",
    "mutatePlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2",
    "observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2",
  ]);
}

function probeFailureAggregateV2(
  error: PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2,
): AggregateError {
  assert.ok(error.cause instanceof AggregateError);
  return error.cause;
}

describe("Darwin full required-module closure probe v2", () => {
  it("uses bounded directory, descriptor, and direct-child contracts without changing exports", () => {
    assertSupportSourceContractV2();
  });

  it("binds all 17 physical modules and independent runtime occurrences without authority", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture = buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2();
    try {
      const probe = await observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2(
        fixture,
        { challenge: Buffer.alloc(32, 0x61) },
      );
      const requirement = getPlatformReleaseRequiredModuleRequirementV2();
      assert.equal(probe.authorityState, "observed_test_fixture_unverified");
      assert.equal(probe.admissionScope, "test_fixture");
      assert.equal(probe.productionAuthority, false);
      assert.equal(probe.productionAdmission, "forbidden");
      assert.equal(probe.credentialUse, "none");
      assert.equal(probe.mutationAuthority, false);
      assert.equal(probe.trustConclusion, "characterization_only");
      assert.deepEqual(Object.keys(probe).sort(), [
        "admissionScope",
        "authorityState",
        "catalogHash",
        "challengeHash",
        "credentialUse",
        "entries",
        "hostIdentityHash",
        "implementationScope",
        "mutationAuthority",
        "observationHash",
        "observationOutcome",
        "payloadBinding",
        "probeHash",
        "productionAdmission",
        "productionAuthority",
        "requiredModuleClosure",
        "schema",
        "trustConclusion",
        "version",
      ]);
      assert.equal(probe.payloadBinding, "typescript_source_fixture_only_v2");
      assert.equal(probe.entries.length, 17);
      assert.deepEqual(
        probe.entries.map((entry) => entry.role),
        requirement.entries.map((entry) => entry.role),
      );
      const seenPhysicalObjects = new Set<string>();
      for (const [index, entry] of probe.entries.entries()) {
        const definition = requirement.entries[index]!;
        assert.equal(entry.sourceModuleLocator, definition.sourceModuleLocator);
        assert.equal(entry.moduleRef.moduleLocator, definition.moduleLocator);
        assert.equal(entry.moduleRef.payloadLocator, `payload/${definition.moduleLocator}`);
        assert.equal(entry.occurrences.length, 2);
        assert.equal(entry.occurrences[0]!.occurrenceRef, "first");
        assert.equal(entry.occurrences[1]!.occurrenceRef, "second");
        assert.deepEqual(entry.occurrences[0]!.requiredExports, definition.requiredExports);
        assert.deepEqual(entry.occurrences[1]!.requiredExports, definition.requiredExports);
        assert.deepEqual(entry.occurrences[0]!.observedExports, definition.requiredExports);
        assert.deepEqual(entry.occurrences[1]!.observedExports, definition.requiredExports);
        assert.equal(
          entry.occurrences[0]!.semanticProjectionHash,
          entry.occurrences[1]!.semanticProjectionHash,
        );
        assert.notEqual(
          entry.occurrences[0]!.process.processOccurrenceHash,
          entry.occurrences[1]!.process.processOccurrenceHash,
        );
        for (const occurrence of entry.occurrences) {
          assert.equal(occurrence.process.status, "exited");
          assert.equal(occurrence.process.exitCode, 0);
          assert.equal(occurrence.process.signal, null);
          assert.equal(occurrence.process.shell, "forbidden");
          assert.equal(occurrence.process.environmentPolicy, "deny_all_empty_v2");
          assert.equal(occurrence.moduleObservation.stableIdentity.hostIdentityHash, probe.hostIdentityHash);
          assert.equal(occurrence.moduleObservation.mutableFingerprint.contentHash, entry.moduleRef.contentHash);
          assert.equal(occurrence.moduleObservation.mutableFingerprint.byteLength, entry.moduleRef.byteLength);
          assert.equal(occurrence.moduleObservation.mutableFingerprint.mode, entry.moduleRef.mode);
          const stable = occurrence.moduleObservation.stableIdentity;
          const physicalKey = `${stable.hostIdentityHash}:${stable.objectKind}:${stable.device}:${stable.inode}`;
          assert.equal(seenPhysicalObjects.has(physicalKey), false);
          seenPhysicalObjects.add(physicalKey);
        }
      }
      assert.equal(seenPhysicalObjects.size, 34);
      assert.equal(
        PlatformReleaseRequiredModuleClosureProbeV2Schema.safeParse(probe).success,
        true,
      );
      const parsed = parsePlatformReleaseRequiredModuleClosureProbeCandidateV2(structuredClone(probe));
      assert.equal(parsed.probeHash, probe.probeHash);
      assert.equal(hashPlatformReleaseRequiredModuleClosureProbeV2(probe), probe.probeHash);
      assert.equal(hashPlatformReleaseRequiredModuleClosureProbeObservationV2(probe), probe.observationHash);
      assert.equal(Object.isFrozen(parsed), true);
      assert.equal(Object.isFrozen(parsed.entries), true);
    } finally {
      fixture.dispose();
    }
  });

  it("rejects authority forgery, nested hash splicing, and physical replacement drift", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture = buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2();
    try {
      await assert.rejects(
        observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2(fixture, { challenge: Buffer.alloc(31) }),
        (error: unknown) => error instanceof PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2 && error.code === "REQUIRED_MODULE_CLOSURE_PROBE_RECEIPT_INVALID",
      );
      await assert.rejects(
        observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2(
          fixture,
          { testFault: "arbitrary_command" as never },
        ),
        (error: unknown) =>
          error instanceof PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2
          && error.code === "REQUIRED_MODULE_CLOSURE_PROBE_RECEIPT_INVALID",
      );
      const probe = await observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2(fixture, { challenge: Buffer.alloc(32, 0x62) });
      const forgedAuthority = structuredClone(probe) as Record<string, unknown>;
      forgedAuthority.productionAuthority = true;
      assert.equal(PlatformReleaseRequiredModuleClosureProbeV2Schema.safeParse(forgedAuthority).success, false);

      const forgedHost = structuredClone(probe) as any;
      const firstOccurrence = forgedHost.entries[0].occurrences[0];
      firstOccurrence.moduleObservation.stableIdentity.hostIdentityHash = "e".repeat(64);
      delete firstOccurrence.moduleObservation.moduleObservationHash;
      firstOccurrence.moduleObservation.moduleObservationHash = hashPlatformReleaseRequiredModuleClosureProbeModuleObservationV2(firstOccurrence.moduleObservation);
      delete firstOccurrence.occurrenceHash;
      firstOccurrence.occurrenceHash = hashPlatformReleaseRequiredModuleClosureProbeOccurrenceV2(firstOccurrence);
      delete forgedHost.entries[0].entryHash;
      forgedHost.entries[0].entryHash = hashPlatformReleaseRequiredModuleClosureProbeEntryV2(forgedHost.entries[0]);
      delete forgedHost.observationHash;
      forgedHost.observationHash = hashPlatformReleaseRequiredModuleClosureProbeObservationV2(forgedHost);
      delete forgedHost.probeHash;
      forgedHost.probeHash = hashPlatformReleaseRequiredModuleClosureProbeV2(forgedHost);
      assert.equal(PlatformReleaseRequiredModuleClosureProbeV2Schema.safeParse(forgedHost).success, false);

      const forgedAlias = structuredClone(probe) as any;
      const aliased = forgedAlias.entries[1].occurrences[0];
      aliased.moduleObservation.stableIdentity = structuredClone(
        forgedAlias.entries[0].occurrences[0].moduleObservation.stableIdentity,
      );
      delete aliased.moduleObservation.moduleObservationHash;
      aliased.moduleObservation.moduleObservationHash = hashPlatformReleaseRequiredModuleClosureProbeModuleObservationV2(aliased.moduleObservation);
      delete aliased.occurrenceHash;
      aliased.occurrenceHash = hashPlatformReleaseRequiredModuleClosureProbeOccurrenceV2(aliased);
      delete forgedAlias.entries[1].entryHash;
      forgedAlias.entries[1].entryHash = hashPlatformReleaseRequiredModuleClosureProbeEntryV2(forgedAlias.entries[1]);
      delete forgedAlias.observationHash;
      forgedAlias.observationHash = hashPlatformReleaseRequiredModuleClosureProbeObservationV2(forgedAlias);
      delete forgedAlias.probeHash;
      forgedAlias.probeHash = hashPlatformReleaseRequiredModuleClosureProbeV2(forgedAlias);
      assert.equal(PlatformReleaseRequiredModuleClosureProbeV2Schema.safeParse(forgedAlias).success, false);

      mutatePlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2(fixture, "replace_first_same_bytes");
      await assert.rejects(
        observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2(fixture, { challenge: Buffer.alloc(32, 0x63) }),
        (error: unknown) => error instanceof PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2 && error.code === "REQUIRED_MODULE_CLOSURE_PROBE_FILESYSTEM_DRIFT",
      );
    } finally {
      fixture.dispose();
    }
  });

  it("bounds hostile root membership before retaining the cap-plus-one entry", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture =
      buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2();
    try {
      mutatePlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2(
        fixture,
        "add_root_entry_over_limit",
      );
      await assert.rejects(
        observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2(
          fixture,
          { challenge: Buffer.alloc(32, 0x64) },
        ),
        (error: unknown) =>
          error
            instanceof PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2
          && error.code
            === "REQUIRED_MODULE_CLOSURE_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED"
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
        buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2();
      try {
        let observed: unknown;
        try {
          await observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2(
            fixture,
            { testFault: fault },
          );
        } catch (error) {
          observed = error;
        }
        assert.ok(
          observed
            instanceof PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2,
        );
        assert.equal(
          observed.code,
          "REQUIRED_MODULE_CLOSURE_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
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

  it("preserves file read and close failures in primary-first order", {
    skip: process.platform !== "darwin",
  }, async () => {
    const dualFixture =
      buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2();
    try {
      let observed: unknown;
      try {
        await observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2(
          dualFixture,
          { testFault: "file_read_and_close_failure" },
        );
      } catch (error) {
        observed = error;
      }
      assert.ok(
        observed
          instanceof PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2,
      );
      assert.equal(
        observed.code,
        "REQUIRED_MODULE_CLOSURE_PROBE_FILESYSTEM_DRIFT",
      );
      const aggregate = probeFailureAggregateV2(observed);
      assert.equal(aggregate.errors.length, 2);
      assert.equal(aggregate.cause, aggregate.errors[0]);
      const primary = aggregate.errors[0];
      const closeFailure = aggregate.errors[1];
      assert.ok(
        primary
          instanceof PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2,
      );
      assert.match(primary.message, /could not be captured/u);
      assert.ok(primary.cause instanceof Error);
      assert.match(primary.cause.message, /descriptor read failure/u);
      assert.ok(
        closeFailure
          instanceof PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2,
      );
      assert.match(closeFailure.message, /descriptor could not be closed/u);
      assert.ok(closeFailure.cause instanceof Error);
      assert.match(closeFailure.cause.message, /descriptor close failure/u);
    } finally {
      dualFixture.dispose();
    }

    const closeFixture =
      buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2();
    try {
      let observed: unknown;
      try {
        await observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2(
          closeFixture,
          { testFault: "file_close_failure" },
        );
      } catch (error) {
        observed = error;
      }
      assert.ok(
        observed
          instanceof PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2,
      );
      assert.equal(
        observed.code,
        "REQUIRED_MODULE_CLOSURE_PROBE_FILESYSTEM_DRIFT",
      );
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
        buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2();
      const startedAt = Date.now();
      try {
        await assert.rejects(
          observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2(
            fixture,
            { testFault: fault },
          ),
          (error: unknown) =>
            error
              instanceof PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2
            && error.code === "REQUIRED_MODULE_CLOSURE_PROBE_PROCESS_FAILED"
            && error.message.includes(`${stream} stream failed`),
        );
        assert.ok(Date.now() - startedAt < 1_500);
      } finally {
        fixture.dispose();
      }
      assertNoRunnerFaultProcessV2();
    }

    const killFixture =
      buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2();
    const killStartedAt = Date.now();
    try {
      let observed: unknown;
      try {
        await observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2(
          killFixture,
          { testFault: "direct_kill_failure" },
        );
      } catch (error) {
        observed = error;
      }
      assert.ok(
        observed
          instanceof PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2,
      );
      assert.equal(observed.code, "REQUIRED_MODULE_CLOSURE_PROBE_TIMEOUT");
      const aggregate = probeFailureAggregateV2(observed);
      assert.equal(aggregate.cause, aggregate.errors[0]);
      assert.ok(aggregate.errors.length <= 3);
      assert.match((aggregate.errors[0] as Error).message, /timed out/u);
      assert.match(
        (aggregate.errors[1] as Error).message,
        /Injected closure probe direct-child termination failure/u,
      );
      assert.ok(Date.now() - killStartedAt < 1_500);
    } finally {
      killFixture.dispose();
    }
    assertNoRunnerFaultProcessV2();

    const closeFixture =
      buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2();
    const closeStartedAt = Date.now();
    try {
      let observed: unknown;
      try {
        await observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2(
          closeFixture,
          { testFault: "close_suppressed" },
        );
      } catch (error) {
        observed = error;
      }
      assert.ok(
        observed
          instanceof PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2,
      );
      assert.equal(observed.code, "REQUIRED_MODULE_CLOSURE_PROBE_TIMEOUT");
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
