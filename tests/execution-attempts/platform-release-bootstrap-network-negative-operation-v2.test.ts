import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  writeFileSync,
  type BigIntStats,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";
import {
  runInstalledTargetOperationProcessInternalV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-installed-metadata-operation-test-support-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_DENIED_PROBE_SET_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_IDENTITY_V2,
} from
  "../../src/execution/platform-release-bootstrap-network-negative-operation-v2.js";
import {
  hashPlatformReleaseBootstrapWireMessageV2,
  parsePlatformReleaseBootstrapWireMessageV2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-wire-contracts-v2.js";
import {
  materializePlatformReleaseHostCompositionFixtureV2,
} from "./helpers/platform-release-host-composition-fixture-v2.js";

const INPUT_SCHEMA =
  "setfarm.platform-release-network-negative-probe-input.v2";
const OUTPUT_SCHEMA =
  "setfarm.platform-release-network-negative-probe-receipt.v2";
const FAILURE_SCHEMA =
  "setfarm.platform-release-bootstrap-operation-failure.v2";
const SCRATCH_PREFIX =
  "setfarm-installed-network-negative-operation-v2-";
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

type ProcessResult = Readonly<{
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: Buffer;
}>;

function runOperation(
  executable: string,
  cwd: string,
  input: string,
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    let child: ChildProcess;
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const finish = (
      exitCode: number | null,
      signal: NodeJS.Signals | null,
    ): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      resolve(Object.freeze({
        exitCode,
        signal,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      }));
      for (const chunk of stdout) chunk.fill(0);
      for (const chunk of stderr) chunk.fill(0);
    };
    child = spawn(process.execPath, [
      executable,
      "run-network-negative-probe-v2",
      "PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2",
    ], {
      cwd,
      env: {},
      shell: false,
      stdio: ["ignore", "pipe", "pipe", "pipe"],
    });
    timer = setTimeout(() => child.kill("SIGKILL"), 30_000);
    child.stdout?.on("data", (chunk: Buffer) => stdout.push(Buffer.from(chunk)));
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(Buffer.from(chunk)));
    child.once("error", () => child.kill("SIGKILL"));
    child.once("close", finish);
    const fd3 = child.stdio[3];
    assert.ok(fd3 && typeof fd3 !== "string");
    fd3.end(input);
  });
}

function targetV2(hostIdentityHash: string) {
  const root = mkdtempSync(path.join(
    tmpdir(),
    "setfarm-installed-network-target-v2-",
  ));
  roots.push(root);
  chmodSync(root, 0o700);
  const stat = lstatSync(root, { bigint: true }) as BigIntStats;
  const stableIdentity = {
    hostIdentityHash,
    objectKind: "directory" as const,
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
  };
  return Object.freeze({
    root,
    physicalIdentityHash: hashCanonicalJson({
      schema:
        "setfarm.platform-release-bootstrap-installed-network-negative-target-stable-identity.v2",
      stableIdentity,
    }),
  });
}

function scratchV2(occurrenceId: string): string {
  const root = path.join(
    "/private/tmp",
    `${SCRATCH_PREFIX}${occurrenceId}`,
  );
  mkdirSync(root, { mode: 0o700 });
  chmodSync(root, 0o700);
  for (const name of ["cache", "home", "tmp"] as const) {
    mkdirSync(path.join(root, name), { mode: 0o700 });
    chmodSync(path.join(root, name), 0o700);
  }
  return root;
}

function cleanupScratchV2(root: string): void {
  assert.deepEqual(readdirSync(root).sort(), ["cache", "home", "tmp"]);
  for (const name of ["cache", "home", "tmp"] as const) {
    assert.deepEqual(readdirSync(path.join(root, name)), []);
    rmdirSync(path.join(root, name));
  }
  rmdirSync(root);
}

function wireInputV2(input: Readonly<{
  occurrenceId: string;
  hostIdentityHash: string;
  targetRootPhysicalIdentityHash: string;
  sandboxPolicyHash: string;
  hostCompositionReceiptHash: string;
}>): string {
  const identity = {
    schema: INPUT_SCHEMA,
    version: "2.0.0",
    ...input,
  };
  return canonicalJsonStringify(
    parsePlatformReleaseBootstrapWireMessageV2(INPUT_SCHEMA, {
      ...identity,
      messageHash: hashPlatformReleaseBootstrapWireMessageV2(
        INPUT_SCHEMA,
        identity,
      ),
    }),
  );
}

function processIsAbsentV2(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    if (
      error instanceof Error
      && "code" in error
      && error.code === "ESRCH"
    ) return true;
    throw error;
  }
}

async function assertProcessesAbsentV2(
  pids: readonly number[],
): Promise<void> {
  const deadline = Date.now() + 1_500;
  while (Date.now() < deadline) {
    if (pids.every(processIsAbsentV2)) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 10);
    });
  }
  assert.deepEqual(
    pids.filter((pid) => !processIsAbsentV2(pid)),
    [],
    "Runner left a leader or same-group grandchild alive",
  );
}

function killProcessesBestEffortV2(pids: readonly number[]): void {
  for (const pid of pids) {
    if (!Number.isInteger(pid) || pid <= 0) continue;
    try {
      process.kill(pid, "SIGKILL");
    } catch (error) {
      if (
        !(error instanceof Error)
        || !("code" in error)
        || error.code !== "ESRCH"
      ) throw error;
    }
  }
}

describe("installed network-negative operation v2", () => {
  it("preserves the first timeout or output-limit terminal cause", async () => {
    const root = mkdtempSync(path.join(
      tmpdir(),
      "setfarm-installed-operation-process-v2-",
    ));
    roots.push(root);
    const script = path.join(root, "child.mjs");
    const context = {
      nodeExecutablePath: process.execPath,
      releaseBootstrapExecutablePath: script,
      directArgv: [] as const,
      timeoutMs: 50,
      maxStdoutBytes: 32,
      maxStderrBytes: 32,
    };

    writeFileSync(script, "setInterval(() => {}, 1_000);\n", {
      mode: 0o700,
    });
    const timedOut =
      await runInstalledTargetOperationProcessInternalV2({
        context,
        targetRoot: root,
        wireInputCanonical: "",
      });
    assert.equal(timedOut.status, "timed_out");
    assert.equal(timedOut.exitCode, null);
    assert.equal(timedOut.signal, "SIGKILL");

    writeFileSync(
      script,
      "process.stdout.write('x'.repeat(4_096)); setInterval(() => {}, 1_000);\n",
      { mode: 0o700 },
    );
    const outputLimited =
      await runInstalledTargetOperationProcessInternalV2({
        context: { ...context, timeoutMs: 5_000 },
        targetRoot: root,
        wireInputCanonical: "",
      });
    assert.equal(outputLimited.status, "output_limit_exceeded");
    assert.equal(outputLimited.exitCode, null);
    assert.equal(outputLimited.signal, "SIGKILL");
    assert.equal(outputLimited.stdout.byteLength, 0);
  });

  it("terminates the detached leader and its same-group grandchild on every bounded runner kill", async () => {
    const root = mkdtempSync(path.join(
      tmpdir(),
      "setfarm-installed-operation-process-group-v2-",
    ));
    roots.push(root);
    const script = path.join(root, "process-group-child.mjs");
    writeFileSync(script, [
      'import { spawn } from "node:child_process";',
      'import { writeFileSync } from "node:fs";',
      'const [pidPath, mode] = process.argv.slice(2);',
      'const grandchild = spawn(process.execPath, ["-e", "setTimeout(() => process.exit(0), 6000)"], {',
      '  detached: false, env: {}, shell: false, stdio: "ignore",',
      '});',
      'if (!Number.isInteger(grandchild.pid) || grandchild.pid <= 0) process.exit(91);',
      'writeFileSync(pidPath, `${process.pid}\\n${grandchild.pid}\\n`, {',
      '  encoding: "utf8", flag: "wx", mode: 0o600,',
      '});',
      'if (mode === "output_limit") process.stdout.write("x".repeat(4096));',
      'setTimeout(() => process.exit(0), 6000);',
      '',
    ].join("\n"), { mode: 0o700 });

    for (const scenario of [
      {
        ref: "timeout",
        expectedStatus: "timed_out",
        timeoutMs: 750,
        maxStdoutBytes: 8_192,
      },
      {
        ref: "output_limit",
        expectedStatus: "output_limit_exceeded",
        timeoutMs: 5_000,
        maxStdoutBytes: 32,
      },
    ] as const) {
      const pidPath = path.join(root, `${scenario.ref}.pids`);
      let observedPids: number[] = [];
      try {
        const result =
          await runInstalledTargetOperationProcessInternalV2({
            context: {
              nodeExecutablePath: process.execPath,
              releaseBootstrapExecutablePath: script,
              directArgv: [pidPath, scenario.ref],
              timeoutMs: scenario.timeoutMs,
              maxStdoutBytes: scenario.maxStdoutBytes,
              maxStderrBytes: 32,
            },
            targetRoot: root,
            wireInputCanonical: "",
          });
        assert.equal(result.status, scenario.expectedStatus);
        assert.equal(result.exitCode, null);
        assert.equal(result.signal, "SIGKILL");
        assert.ok(result.pid > 0);

        const pidFile = readFileSync(pidPath, "utf8");
        assert.match(pidFile, /^[1-9][0-9]*\n[1-9][0-9]*\n$/u);
        observedPids = pidFile.trimEnd().split("\n").map(Number);
        assert.equal(observedPids.length, 2);
        assert.equal(observedPids[0], result.pid);
        assert.notEqual(observedPids[1], result.pid);
        await assertProcessesAbsentV2(observedPids);
      } finally {
        killProcessesBestEffortV2(observedPids);
      }
    }
  });

  it("pins a test-only one-probe policy with supplementary DNS", () => {
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_IDENTITY_V2
        .productionAdmission,
      "forbidden",
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_IDENTITY_V2
        .mutationAuthority,
      false,
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_IDENTITY_V2
        .dnsDisposition,
      "supplementary_not_counted_as_enforcement_denial_v2",
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_IDENTITY_V2
        .attemptedProbeCount,
      1,
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_IDENTITY_V2
        .deniedProbeCount,
      1,
    );
  });

  it("emits one canonical host-bound installed denial receipt", {
    skip: process.platform !== "darwin",
  }, async () => {
    const composition = materializePlatformReleaseHostCompositionFixtureV2(
      "setfarm-installed-network-composition-v2-",
      { operationalNetworkSandboxWrapper: true },
    );
    roots.push(composition.root);
    const hostIdentityHash = hashCanonicalJson({
      schema: "setfarm.installed-network-negative-test-host.v2",
      platform: "darwin",
    });
    const target = targetV2(hostIdentityHash);
    const occurrenceId = "A0000000-0000-4000-8000-000000000101";
    const scratch = scratchV2(occurrenceId);
    const hostCompositionReceiptHash = "b".repeat(64);
    const result = await runOperation(
      composition.files["bin/release-bootstrap"]!,
      target.root,
      wireInputV2({
        occurrenceId,
        hostIdentityHash,
        targetRootPhysicalIdentityHash: target.physicalIdentityHash,
        sandboxPolicyHash:
          PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
        hostCompositionReceiptHash,
      }),
    );
    try {
      assert.equal(result.exitCode, 0);
      assert.equal(result.signal, null);
      assert.equal(result.stderr.byteLength, 0);
      const receipt = parsePlatformReleaseBootstrapWireMessageV2(
        OUTPUT_SCHEMA,
        JSON.parse(result.stdout.toString("utf8")),
      );
      assert.equal(
        result.stdout.toString("utf8"),
        `${canonicalJsonStringify(receipt)}\n`,
      );
      assert.equal(receipt.occurrenceId, occurrenceId);
      assert.equal(receipt.hostIdentityHash, hostIdentityHash);
      assert.equal(
        receipt.targetRootPhysicalIdentityHash,
        target.physicalIdentityHash,
      );
      assert.equal(receipt.probeOutcome, "all_denied");
      assert.equal(receipt.attemptedProbeCount, 1);
      assert.equal(receipt.deniedProbeCount, 1);
      assert.equal(
        receipt.deniedProbeSetHash,
        PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_DENIED_PROBE_SET_HASH_V2,
      );
      assert.equal(
        receipt.controlOutcome,
        "loopback_and_redirect_observed",
      );
      assert.equal(
        receipt.hostCompositionReceiptHash,
        hostCompositionReceiptHash,
      );
    } finally {
      result.stdout.fill(0);
      result.stderr.fill(0);
      cleanupScratchV2(scratch);
    }
  });

  it("returns authenticated failures for wrong target and policy hashes", {
    skip: process.platform !== "darwin",
  }, async () => {
    const composition = materializePlatformReleaseHostCompositionFixtureV2(
      "setfarm-installed-network-failure-v2-",
      { operationalNetworkSandboxWrapper: true },
    );
    roots.push(composition.root);
    const hostIdentityHash = "c".repeat(64);
    const target = targetV2(hostIdentityHash);
    for (const [occurrenceId, targetHash, policyHash, expectedCode] of [
      [
        "A0000000-0000-4000-8000-000000000102",
        "d".repeat(64),
        PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
        "AUTHORITY_DRIFT",
      ],
      [
        "A0000000-0000-4000-8000-000000000103",
        target.physicalIdentityHash,
        "e".repeat(64),
        "POLICY_MISMATCH",
      ],
    ] as const) {
      const result = await runOperation(
        composition.files["bin/release-bootstrap"]!,
        target.root,
        wireInputV2({
          occurrenceId,
          hostIdentityHash,
          targetRootPhysicalIdentityHash: targetHash,
          sandboxPolicyHash: policyHash,
          hostCompositionReceiptHash: "f".repeat(64),
        }),
      );
      try {
        assert.equal(result.exitCode, 1);
        assert.equal(result.signal, null);
        assert.equal(result.stderr.byteLength, 0);
        const failure = parsePlatformReleaseBootstrapWireMessageV2(
          FAILURE_SCHEMA,
          JSON.parse(result.stdout.toString("utf8")),
        );
        assert.equal(
          result.stdout.toString("utf8"),
          `${canonicalJsonStringify(failure)}\n`,
        );
        assert.equal(failure.occurrenceId, occurrenceId);
        assert.equal(failure.errorCode, expectedCode);
        assert.equal(
          failure.operationAbiRef,
          "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2",
        );
      } finally {
        result.stdout.fill(0);
        result.stderr.fill(0);
      }
    }
  });
});
