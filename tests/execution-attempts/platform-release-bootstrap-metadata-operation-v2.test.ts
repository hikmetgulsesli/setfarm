import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  realpathSync,
  rmSync,
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
  PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_MODULE_SOURCE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_IDENTITY_V2,
  PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
} from
  "../../src/execution/platform-release-bootstrap-metadata-operation-v2.js";
import {
  hashMetadataProbeDirectoryEntriesV2,
  hashMetadataProbeTargetStableIdentityV2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-darwin-metadata-probe-v2.js";
import {
  hashPlatformReleaseBootstrapWireMessageV2,
  parsePlatformReleaseBootstrapWireMessageV2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-wire-contracts-v2.js";
import {
  materializePlatformReleaseHostCompositionFixtureV2,
} from
  "./helpers/platform-release-host-composition-fixture-v2.js";

const roots: string[] = [];
const INPUT_SCHEMA =
  "setfarm.platform-release-metadata-probe-input.v2";
const OUTPUT_SCHEMA =
  "setfarm.platform-release-metadata-probe-receipt.v2";

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

type ProcessResult = Readonly<{
  status:
    | "exited"
    | "spawn_failed"
    | "timed_out"
    | "output_limit_exceeded";
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
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let status: ProcessResult["status"] = "exited";
    let child: ChildProcess;
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const kill = (): void => {
      try {
        child.kill("SIGKILL");
      } catch {
        // Close owns settlement after a concurrent exit.
      }
    };
    const settle = (
      exitCode: number | null,
      signal: NodeJS.Signals | null,
    ): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks);
      for (const chunk of stdoutChunks) chunk.fill(0);
      for (const chunk of stderrChunks) chunk.fill(0);
      resolve(Object.freeze({
        status,
        exitCode,
        signal,
        stdout,
        stderr,
      }));
    };
    try {
      child = spawn(
        process.execPath,
        [
          executable,
          "run-metadata-probe-v2",
          "PLATFORM_RELEASE_METADATA_PROBE_V2",
        ],
        {
          cwd,
          env: {},
          shell: false,
          stdio: ["ignore", "pipe", "pipe", "pipe"],
        },
      );
    } catch (error) {
      resolve(Object.freeze({
        status: "spawn_failed",
        exitCode: null,
        signal: null,
        stdout: Buffer.alloc(0),
        stderr: Buffer.from(String(error), "utf8"),
      }));
      return;
    }
    timer = setTimeout(() => {
      status = "timed_out";
      kill();
    }, 30_000);
    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > 1024 * 1024) {
        status = "output_limit_exceeded";
        kill();
        return;
      }
      stdoutChunks.push(Buffer.from(chunk));
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.byteLength;
      if (stderrBytes > 256 * 1024) {
        status = "output_limit_exceeded";
        kill();
        return;
      }
      stderrChunks.push(Buffer.from(chunk));
    });
    child.once("error", () => {
      status = "spawn_failed";
      kill();
    });
    child.once("close", settle);
    const fd3 = child.stdio[3];
    assert.ok(fd3 && typeof fd3 !== "string");
    fd3.end(input);
  });
}

function makeTarget(hostIdentityHash: string) {
  const root = realpathSync(mkdtempSync(path.join(
    tmpdir(),
    "setfarm-installed-metadata-operation-v2-",
  )));
  roots.push(root);
  chmodSync(root, 0o700);
  writeFileSync(
    path.join(root, "entry.txt"),
    "installed metadata operation fixture\n",
    { mode: 0o444 },
  );
  chmodSync(path.join(root, "entry.txt"), 0o444);
  const stat = lstatSync(root, { bigint: true }) as BigIntStats;
  const targetRootPhysicalIdentityHash =
    hashMetadataProbeTargetStableIdentityV2({
      hostIdentityHash,
      objectKind: "directory",
      device: stat.dev.toString(10),
      inode: stat.ino.toString(10),
    });
  return Object.freeze({
    root,
    targetRootPhysicalIdentityHash,
    targetEntryNamesHash:
      hashMetadataProbeDirectoryEntriesV2(["entry.txt"]),
  });
}

describe("installed metadata operation v2", () => {
  it("binds only read-only observer roles and no clear locator", () => {
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_IDENTITY_V2
        .mutationAuthority,
      false,
    );
    assert.deepEqual(
      PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_IDENTITY_V2
        .tools.map((tool) => tool.toolRef),
      ["XATTR_OBSERVER_V2", "ACL_OBSERVER_V2"],
    );
    assert.deepEqual(
      PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_IDENTITY_V2
        .tools[0]?.argv,
      ["."],
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_MODULE_SOURCE_V2
        .includes("xattr-clear"),
      false,
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_MODULE_SOURCE_V2
        .includes("acl-clear"),
      false,
    );
  });

  it("emits one canonical host-bound read-only metadata receipt", {
    skip: process.platform !== "darwin",
  }, async () => {
    const composition =
      materializePlatformReleaseHostCompositionFixtureV2(
        "setfarm-installed-metadata-composition-v2-",
        { operationalMetadataObserverWrappers: true },
      );
    roots.push(composition.root);
    const hostIdentityHash = hashCanonicalJson({
      schema:
        "setfarm.platform-release-bootstrap-installed-metadata-operation-test-host.v2",
      platform: "darwin",
    });
    const target = makeTarget(hostIdentityHash);
    const occurrenceId =
      "A0000000-0000-4000-8000-000000000001";
    const hostCompositionReceiptHash = "b".repeat(64);
    const inputIdentity = {
      schema: INPUT_SCHEMA,
      version: "2.0.0",
      occurrenceId,
      hostIdentityHash,
      targetRootPhysicalIdentityHash:
        target.targetRootPhysicalIdentityHash,
      metadataPolicyHash:
        PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
      hostCompositionReceiptHash,
    };
    const input = parsePlatformReleaseBootstrapWireMessageV2(
      INPUT_SCHEMA,
      {
        ...inputIdentity,
        messageHash:
          hashPlatformReleaseBootstrapWireMessageV2(
            INPUT_SCHEMA,
            inputIdentity,
          ),
      },
    );
    const result = await runOperation(
      composition.files["bin/release-bootstrap"]!,
      target.root,
      canonicalJsonStringify(input),
    );
    try {
      assert.equal(result.status, "exited");
      assert.equal(result.exitCode, 0);
      assert.equal(result.signal, null);
      assert.equal(result.stderr.byteLength, 0);
      const parsed = JSON.parse(result.stdout.toString("utf8"));
      const receipt = parsePlatformReleaseBootstrapWireMessageV2(
        OUTPUT_SCHEMA,
        parsed,
      );
      assert.equal(
        result.stdout.toString("utf8"),
        `${canonicalJsonStringify(receipt)}\n`,
      );
      assert.equal(receipt.occurrenceId, occurrenceId);
      assert.equal(receipt.hostIdentityHash, hostIdentityHash);
      assert.equal(
        receipt.targetRootPhysicalIdentityHash,
        target.targetRootPhysicalIdentityHash,
      );
      assert.equal(
        receipt.metadataPolicyHash,
        PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
      );
      assert.equal(
        receipt.hostCompositionReceiptHash,
        hostCompositionReceiptHash,
      );
      assert.equal(
        receipt.observationOutcome,
        "metadata_policy_satisfied",
      );
      assert.equal(receipt.observedEntryCount, 1);
      assert.equal(
        receipt.targetEntryNamesHash,
        target.targetEntryNamesHash,
      );
      assert.equal(
        typeof receipt.stableMetadataProjectionHash,
        "string",
      );
      assert.equal(typeof receipt.metadataCatalogHash, "string");
      assert.equal(typeof receipt.metadataObservationHash, "string");
    } finally {
      result.stdout.fill(0);
      result.stderr.fill(0);
    }
  });

  it("returns authenticated failures for wrong target and policy hashes", {
    skip: process.platform !== "darwin",
  }, async () => {
    const composition =
      materializePlatformReleaseHostCompositionFixtureV2(
        "setfarm-installed-metadata-failure-v2-",
        { operationalMetadataObserverWrappers: true },
      );
    roots.push(composition.root);
    const hostIdentityHash = "c".repeat(64);
    const target = makeTarget(hostIdentityHash);
    for (const [label, targetHash, policyHash, expected] of [
      [
        "target",
        "d".repeat(64),
        PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
        ["AUTHORITY_DRIFT", "METADATA_PROBE_FILESYSTEM_FENCE_V2"],
      ],
      [
        "policy",
        target.targetRootPhysicalIdentityHash,
        "e".repeat(64),
        ["POLICY_MISMATCH", "METADATA_PROBE_POLICY_V2"],
      ],
    ] as const) {
      const occurrenceId = label === "target"
        ? "A0000000-0000-4000-8000-000000000002"
        : "A0000000-0000-4000-8000-000000000003";
      const identity = {
        schema: INPUT_SCHEMA,
        version: "2.0.0",
        occurrenceId,
        hostIdentityHash,
        targetRootPhysicalIdentityHash: targetHash,
        metadataPolicyHash: policyHash,
        hostCompositionReceiptHash: "f".repeat(64),
      };
      const result = await runOperation(
        composition.files["bin/release-bootstrap"]!,
        target.root,
        canonicalJsonStringify({
          ...identity,
          messageHash:
            hashPlatformReleaseBootstrapWireMessageV2(
              INPUT_SCHEMA,
              identity,
            ),
        }),
      );
      try {
        assert.equal(result.status, "exited");
        assert.equal(result.exitCode, 1);
        assert.equal(result.signal, null);
        assert.equal(result.stderr.byteLength, 0);
        const failure =
          parsePlatformReleaseBootstrapWireMessageV2(
            "setfarm.platform-release-bootstrap-operation-failure.v2",
            JSON.parse(result.stdout.toString("utf8")),
          );
        assert.equal(failure.occurrenceId, occurrenceId);
        assert.equal(
          failure.operationAbiRef,
          "ABI_PLATFORM_RELEASE_METADATA_PROBE_V2",
        );
        assert.equal(failure.authorityStateHash, "f".repeat(64));
        assert.deepEqual(
          [failure.errorCode, failure.phaseRef],
          expected,
        );
        const diagnosticRef = label === "target"
          ? "METADATA_PROBE_TARGET_IDENTITY_MISMATCH"
          : "METADATA_PROBE_POLICY_MISMATCH";
        assert.equal(
          failure.diagnosticHash,
          hashCanonicalJson({
            schema:
              "setfarm.platform-release-metadata-probe-diagnostic-hash.v2",
            diagnosticRef,
          }),
        );
      } finally {
        result.stdout.fill(0);
        result.stderr.fill(0);
      }
    }
  });

  it("rejects noncanonical fd3 input without leaking stderr prose", {
    skip: process.platform !== "darwin",
  }, async () => {
    const composition =
      materializePlatformReleaseHostCompositionFixtureV2(
        "setfarm-installed-metadata-input-v2-",
        { operationalMetadataObserverWrappers: true },
      );
    roots.push(composition.root);
    const hostIdentityHash = "1".repeat(64);
    const target = makeTarget(hostIdentityHash);
    const identity = {
      schema: INPUT_SCHEMA,
      version: "2.0.0",
      occurrenceId:
        "A0000000-0000-4000-8000-000000000004",
      hostIdentityHash,
      targetRootPhysicalIdentityHash:
        target.targetRootPhysicalIdentityHash,
      metadataPolicyHash:
        PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
      hostCompositionReceiptHash: "2".repeat(64),
    };
    const result = await runOperation(
      composition.files["bin/release-bootstrap"]!,
      target.root,
      `${canonicalJsonStringify({
        ...identity,
        messageHash:
          hashPlatformReleaseBootstrapWireMessageV2(
            INPUT_SCHEMA,
            identity,
          ),
      })}\n`,
    );
    try {
      assert.equal(result.exitCode, 1);
      assert.equal(result.stderr.byteLength, 0);
      const failure = parsePlatformReleaseBootstrapWireMessageV2(
        "setfarm.platform-release-bootstrap-operation-failure.v2",
        JSON.parse(result.stdout.toString("utf8")),
      );
      assert.equal(failure.errorCode, "INPUT_INVALID");
      assert.equal(failure.phaseRef, "METADATA_PROBE_INPUT_V2");
      assert.equal(
        failure.occurrenceId,
        "00000000-0000-4000-8000-000000000000",
      );
      assert.equal(failure.authorityStateHash, null);
    } finally {
      result.stdout.fill(0);
      result.stderr.fill(0);
    }
  });
});
