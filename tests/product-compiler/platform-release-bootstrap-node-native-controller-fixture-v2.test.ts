import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import {
  PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2,
  mapPlatformReleaseBootstrapDarwinAggregateCensusEvidenceStreamV2,
  mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-darwin-aggregate-census-fixture-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_NODE_EXTERNAL_RELEASE_PROBE_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_ACK_ABORT_FRAME_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_ACK_ABORT_TYPE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_AGGREGATE_MAX_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OBSERVATION_TYPE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OPEN_TYPE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_RECEIPT_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_TERMINAL_ABORT_TYPE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_TERMINAL_AUTHORITY_SELF_ASSERTED_V2,
  PlatformReleaseBootstrapNodeNativeControllerFixtureErrorV2,
  PlatformReleaseBootstrapNodeNativeControllerPendingV2,
  beginPlatformReleaseBootstrapNodeNativeControllerFixtureV2,
  disposePlatformReleaseBootstrapNodeNativeControllerPendingV2,
  finalizePlatformReleaseBootstrapNodeNativeControllerFixtureV2,
  hashPlatformReleaseBootstrapNodeExternalReleaseProbeV2,
  hashPlatformReleaseBootstrapNodeNativeControllerReceiptV2,
  parsePlatformReleaseBootstrapNodeNativeControllerReceiptCandidateV2,
  type PlatformReleaseBootstrapNodeExternalReleaseProbeV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-node-native-controller-fixture-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";

const HEADER_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v2";
const PARENT_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-parent.v2";
const LOCKS_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-locks.v2";
const ENTRY_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-entry.v2";
const FOOTER_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-footer.v2";

type AggregateFrame = Record<string, unknown>;

function b64(value: string | Buffer): string {
  return Buffer.from(value).toString("base64");
}

function mutable(byteLength: number, mode = "0444") {
  return {
    ownerUid: 0,
    ownerGid: 0,
    mode,
    linkCount: 1,
    byteLength,
    modifiedSeconds: "100",
    modifiedNanoseconds: "17",
    changedSeconds: "101",
    changedNanoseconds: "19",
  };
}

function fileEntry(
  basename: string,
  inode: string,
  bytes: Buffer,
  mode = "0444",
): AggregateFrame {
  return {
    schema: ENTRY_SCHEMA,
    basenameBase64: b64(basename),
    stable: { objectKind: "ordinary_file", device: "7", inode },
    mutable: mutable(bytes.byteLength, mode),
    content: {
      kind: "bounded_regular_file_bytes",
      byteLength: bytes.byteLength,
      contentBase64: b64(bytes),
    },
  };
}

function directoryEntry(
  basename: string,
  inode: string,
): AggregateFrame {
  return {
    schema: ENTRY_SCHEMA,
    basenameBase64: b64(basename),
    stable: { objectKind: "directory", device: "7", inode },
    mutable: mutable(128, "0555"),
    content: {
      kind: "directory_membership",
      members: [{
        basenameBase64: b64("member"),
        objectKind: "ordinary_file",
      }],
    },
  };
}

function aggregateBytes(): Buffer {
  const scope = buildBootstrapFilesystemScopeIdentityV2({
    scopeNonce: "a".repeat(64),
  });
  const nodePackage = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
    (entry) =>
      entry.packageRef
        === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
  )!;
  const entries = [
    fileEntry(
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.filesystemScopeBasename,
      "101",
      Buffer.from(canonicalJsonStringify(scope), "utf8"),
    ),
    directoryEntry(nodePackage.rootBasename, "102"),
    fileEntry(
      nodePackage.lifecycle.packageLockBasename,
      "103",
      Buffer.from(
        "setfarm.node-toolchain-provisioner-bootstrap-installation-lock.v2\n",
      ),
      "0600",
    ),
    fileEntry(
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename,
      "104",
      Buffer.from("setfarm.bootstrap-package-registry-parent-lock.v2\n"),
      "0600",
    ),
  ].sort((left, right) => Buffer.compare(
    Buffer.from(String(left.basenameBase64), "base64"),
    Buffer.from(String(right.basenameBase64), "base64"),
  ));
  const shared = entries.find((entry) =>
    Buffer.from(String(entry.basenameBase64), "base64").toString("utf8")
      === PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename)!;
  const node = entries.find((entry) =>
    Buffer.from(String(entry.basenameBase64), "base64").toString("utf8")
      === nodePackage.lifecycle.packageLockBasename)!;
  const frames: AggregateFrame[] = [
    {
      schema: HEADER_SCHEMA,
      admissionScope: "test_fixture",
      capability: "darwin_read_only_aggregate_census_fixture_v2",
      productionAuthority: false,
      signingAuthority: "adhoc_or_unsigned_test_fixture",
      observationAuthority:
        "fixture_evidence_only_never_backend_capability_v2",
      capturePasses: 2,
      lockOrder: [
        "shared_parent_lock",
        "registered_node_package_lock",
      ],
    },
    {
      schema: PARENT_SCHEMA,
      stable: { objectKind: "directory", device: "7", inode: "100" },
      mutable: mutable(192, "0555"),
    },
    {
      schema: LOCKS_SCHEMA,
      lockOrder: [
        "shared_parent_lock",
        "registered_node_package_lock",
      ],
      sharedParentLock: {
        stable: structuredClone(shared.stable),
        mutable: structuredClone(shared.mutable),
      },
      registeredNodePackageLock: {
        stable: structuredClone(node.stable),
        mutable: structuredClone(node.mutable),
      },
    },
    ...entries,
    {
      schema: FOOTER_SCHEMA,
      entryCount: entries.length,
      frameCount: entries.length + 4,
      completed: true,
    },
  ];
  return Buffer.from(`${frames.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
}

function wireFrame(type: number, payload: Uint8Array): Buffer {
  const frame = Buffer.alloc(5 + payload.byteLength);
  frame.writeUInt32BE(1 + payload.byteLength, 0);
  frame[4] = type;
  Buffer.from(payload).copy(frame, 5);
  return frame;
}

function cleanSettlement(overrides: Partial<Record<
  "exitCode" | "signal" | "protocolEof" | "stdout" | "stderr",
  unknown
>> = {}) {
  return {
    exitCode: overrides.exitCode ?? 0,
    signal: overrides.signal ?? null,
    protocolEof: overrides.protocolEof ?? true,
    stdout: overrides.stdout ?? Buffer.alloc(0),
    stderr: overrides.stderr ?? Buffer.alloc(0),
  } as never;
}

function releaseProbe(
  evidence: ReturnType<
    typeof beginPlatformReleaseBootstrapNodeNativeControllerFixtureV2
  >["evidence"],
  mutate?: (candidate: Record<string, unknown>) => void,
): PlatformReleaseBootstrapNodeExternalReleaseProbeV2 {
  const aggregate = evidence.aggregateObservation;
  const identity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_NODE_EXTERNAL_RELEASE_PROBE_V2_SCHEMA,
    version: "2.0.0",
    productionAuthority: false,
    probeAuthority:
      "self_asserted_requires_code_owned_paired_probe_v2",
    acquisitionOrder: [
      "shared_parent_lock",
      "registered_node_package_lock",
    ],
    releaseOrder: [
      "registered_node_package_lock",
      "shared_parent_lock",
    ],
    sharedParentLock: {
      ...structuredClone(aggregate.heldLocks.sharedParentLock),
      outcome: "exclusive_nonblocking_lock_acquired_then_released",
    },
    registeredNodePackageLock: {
      ...structuredClone(aggregate.heldLocks.registeredNodePackageLock),
      outcome: "exclusive_nonblocking_lock_acquired_then_released",
    },
  } as Record<string, unknown>;
  mutate?.(identity);
  return {
    ...(identity as never),
    probeHash: hashPlatformReleaseBootstrapNodeExternalReleaseProbeV2(
      identity as never,
    ),
  };
}

function beginFixture() {
  const challenge = Buffer.from(Array.from({ length: 32 }, (_, index) => index));
  const aggregate = aggregateBytes();
  const open = wireFrame(
    PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OPEN_TYPE_V2,
    challenge,
  );
  const observation = wireFrame(
    PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OBSERVATION_TYPE_V2,
    aggregate,
  );
  const begun = beginPlatformReleaseBootstrapNodeNativeControllerFixtureV2({
    openFrameBytes: open,
    observationFrameBytes: observation,
  });
  const terminal = wireFrame(
    PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_TERMINAL_ABORT_TYPE_V2,
    Buffer.concat([
      challenge,
      createHash("sha256").update(aggregate).digest(),
      Buffer.from(begun.evidence.semanticAcknowledgement.frameHash, "hex"),
      Buffer.from([
        PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_TERMINAL_AUTHORITY_SELF_ASSERTED_V2,
      ]),
    ]),
  );
  return { challenge, aggregate, open, observation, begun, terminal };
}

function finalizeFixture(fixture = beginFixture()) {
  return finalizePlatformReleaseBootstrapNodeNativeControllerFixtureV2(
    fixture.begun.pending,
    {
      terminalFrameBytes: fixture.terminal,
      processSettlement: cleanSettlement(),
      externalReleaseProbe: releaseProbe(fixture.begun.evidence),
    },
  );
}

function assertControllerError(
  callback: () => unknown,
  code?: PlatformReleaseBootstrapNodeNativeControllerFixtureErrorV2["code"],
): void {
  assert.throws(callback, (error) => {
    assert.equal(
      error instanceof
        PlatformReleaseBootstrapNodeNativeControllerFixtureErrorV2,
      true,
    );
    if (code !== undefined) {
      assert.equal(
        (error as PlatformReleaseBootstrapNodeNativeControllerFixtureErrorV2)
          .code,
        code,
      );
    }
    return true;
  });
}

describe("platform release bootstrap Node native controller fixture v2", () => {
  it("builds the exact abort ACK and finalizes only a clean externally released occurrence", () => {
    const fixture = beginFixture();
    const acknowledgement = Buffer.from(fixture.begun.acknowledgementBytes);
    assert.equal(
      acknowledgement.byteLength,
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_ACK_ABORT_FRAME_BYTES_V2,
    );
    assert.equal(
      acknowledgement.readUInt32BE(0),
      acknowledgement.byteLength - 4,
    );
    assert.equal(
      acknowledgement[4],
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_ACK_ABORT_TYPE_V2,
    );
    assert.deepEqual(acknowledgement.subarray(5, 37), fixture.challenge);
    assert.deepEqual(
      acknowledgement.subarray(37, 69),
      createHash("sha256").update(fixture.aggregate).digest(),
    );
    assert.equal(
      acknowledgement.subarray(69).toString("hex"),
      fixture.begun.evidence.semanticAcknowledgement.frameHash,
    );
    assert.equal(
      fixture.begun.evidence.semanticAcknowledgement.disposition,
      "abort",
    );
    assert.equal(
      fixture.begun.evidence.semanticAcknowledgement.abortReason,
      "observation_not_acceptable",
    );
    assert.equal(Object.isFrozen(fixture.begun.evidence), true);
    assert.equal(
      fixture.begun.evidence.nativeRecursiveEvidenceStatus,
      "absent_not_captured_v2",
    );
    assert.equal(
      fixture.begun.evidence.transportAuthority,
      "caller_supplied_fixture_frames_requires_live_adapter_v2",
    );
    assert.equal(
      fixture.begun.evidence.processSettlementAuthority,
      "caller_supplied_claim_requires_live_adapter_v2",
    );
    assert.equal(
      fixture.begun.evidence.aggregateStreamStatus,
      "mid_session_evidence_stream_child_not_settled_v2",
    );
    assert.equal(
      fixture.begun.evidence.ackDeadlineStatus,
      "unverified_until_live_adapter_v2",
    );
    assert.equal(
      fixture.begun.evidence.standaloneAckAuthority,
      "structural_abort_ack_not_live_session_join_v2",
    );

    const receipt = finalizeFixture(fixture);
    assert.equal(receipt.schema, PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_RECEIPT_V2_SCHEMA);
    assert.equal(receipt.productionAuthority, false);
    assert.equal(
      receipt.controllerAuthority,
      "self_asserted_contract_only_requires_live_adapter_v2",
    );
    assert.equal(
      receipt.transportAuthority,
      fixture.begun.evidence.transportAuthority,
    );
    assert.equal(
      receipt.processSettlementAuthority,
      fixture.begun.evidence.processSettlementAuthority,
    );
    assert.equal(
      receipt.aggregateStreamStatus,
      fixture.begun.evidence.aggregateStreamStatus,
    );
    assert.equal(
      receipt.ackDeadlineStatus,
      fixture.begun.evidence.ackDeadlineStatus,
    );
    assert.equal(
      receipt.standaloneAckAuthority,
      fixture.begun.evidence.standaloneAckAuthority,
    );
    assert.equal(receipt.semanticDisposition, "abort_observation_not_acceptable");
    assert.equal(receipt.recapture, "not_performed");
    assert.equal(receipt.acceptMechanics, "fixture_tested_but_disabled");
    assert.equal(Object.isFrozen(receipt), true);
    assert.equal(
      receipt.receiptHash,
      hashPlatformReleaseBootstrapNodeNativeControllerReceiptV2(receipt),
    );
    assert.deepEqual(
      Object.keys(receipt).filter((key) =>
        /path|descriptor|callback|buffer|bytes/i.test(key)),
      [],
    );
  });

  it("maps raw aggregate evidence with process-wrapper parity and hostile byte rejection", () => {
    const aggregate = aggregateBytes();
    const evidenceMapping =
      mapPlatformReleaseBootstrapDarwinAggregateCensusEvidenceStreamV2(
        aggregate,
      );
    const processMapping =
      mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2({
        exitCode: 0,
        signal: null,
        stdout: aggregate,
        stderr: Buffer.alloc(0),
      });
    assert.deepEqual(evidenceMapping, processMapping);
    assert.equal(evidenceMapping.productionAuthority, false);

    assert.throws(
      () => mapPlatformReleaseBootstrapDarwinAggregateCensusEvidenceStreamV2(
        new Proxy(aggregate, {}),
      ),
      PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2,
    );
    const shadowed = Buffer.from(aggregate);
    Object.defineProperty(shadowed, "byteLength", {
      enumerable: false,
      value: shadowed.byteLength,
    });
    assert.throws(
      () => mapPlatformReleaseBootstrapDarwinAggregateCensusEvidenceStreamV2(
        shadowed,
      ),
      PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2,
    );
    assert.throws(
      () => mapPlatformReleaseBootstrapDarwinAggregateCensusEvidenceStreamV2(
        new Uint8Array(
          PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_AGGREGATE_MAX_BYTES_V2
            + 1,
        ),
      ),
      PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2,
    );
  });

  it("rejects hostile, mistyped, mis-sized, empty, malformed, and oversized binary frames", () => {
    const fixture = beginFixture();
    const wrongOpenType = Buffer.from(fixture.open);
    wrongOpenType[4] = 9;
    assertControllerError(
      () => beginPlatformReleaseBootstrapNodeNativeControllerFixtureV2({
        openFrameBytes: wrongOpenType,
        observationFrameBytes: fixture.observation,
      }),
      "NODE_NATIVE_CONTROLLER_FRAME_INVALID",
    );
    const wrongLength = Buffer.from(fixture.open);
    wrongLength.writeUInt32BE(32, 0);
    assertControllerError(
      () => beginPlatformReleaseBootstrapNodeNativeControllerFixtureV2({
        openFrameBytes: wrongLength,
        observationFrameBytes: fixture.observation,
      }),
      "NODE_NATIVE_CONTROLLER_FRAME_INVALID",
    );
    assertControllerError(
      () => beginPlatformReleaseBootstrapNodeNativeControllerFixtureV2({
        openFrameBytes: fixture.open,
        observationFrameBytes: wireFrame(
          PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OBSERVATION_TYPE_V2,
          Buffer.alloc(0),
        ),
      }),
      "NODE_NATIVE_CONTROLLER_FRAME_INVALID",
    );
    assertControllerError(
      () => beginPlatformReleaseBootstrapNodeNativeControllerFixtureV2({
        openFrameBytes: fixture.open,
        observationFrameBytes: wireFrame(
          PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OBSERVATION_TYPE_V2,
          Buffer.from([0xff]),
        ),
      }),
      "NODE_NATIVE_CONTROLLER_AGGREGATE_INVALID",
    );
    const oversized = new Uint8Array(
      5 + PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_AGGREGATE_MAX_BYTES_V2 + 1,
    );
    assertControllerError(
      () => beginPlatformReleaseBootstrapNodeNativeControllerFixtureV2({
        openFrameBytes: fixture.open,
        observationFrameBytes: oversized,
      }),
      "NODE_NATIVE_CONTROLLER_INPUT_INVALID",
    );
    assertControllerError(
      () => beginPlatformReleaseBootstrapNodeNativeControllerFixtureV2(
        new Proxy({
          openFrameBytes: fixture.open,
          observationFrameBytes: fixture.observation,
        }, {}) as never,
      ),
      "NODE_NATIVE_CONTROLLER_INPUT_INVALID",
    );
  });

  it("rejects accepted, transplanted, truncated, and trailing terminal frames", () => {
    for (const mutate of [
      (terminal: Buffer) => { terminal[4] = 34; },
      (terminal: Buffer) => { terminal[5] ^= 0xff; },
      (terminal: Buffer) => { terminal[37] ^= 0xff; },
      (terminal: Buffer) => { terminal[69] ^= 0xff; },
      (terminal: Buffer) => { terminal[terminal.length - 1] = 2; },
    ]) {
      const fixture = beginFixture();
      const terminal = Buffer.from(fixture.terminal);
      mutate(terminal);
      assertControllerError(
        () => finalizePlatformReleaseBootstrapNodeNativeControllerFixtureV2(
          fixture.begun.pending,
          {
            terminalFrameBytes: terminal,
            processSettlement: cleanSettlement(),
            externalReleaseProbe: releaseProbe(fixture.begun.evidence),
          },
        ),
        terminal[4] === 34
          ? "NODE_NATIVE_CONTROLLER_FRAME_INVALID"
          : "NODE_NATIVE_CONTROLLER_TERMINAL_INVALID",
      );
    }
    for (const terminal of [
      beginFixture().terminal.subarray(0, -1),
      Buffer.concat([beginFixture().terminal, Buffer.from([0])]),
    ]) {
      const fixture = beginFixture();
      assertControllerError(
        () => finalizePlatformReleaseBootstrapNodeNativeControllerFixtureV2(
          fixture.begun.pending,
          {
            terminalFrameBytes: terminal,
            processSettlement: cleanSettlement(),
            externalReleaseProbe: releaseProbe(fixture.begun.evidence),
          },
        ),
      );
    }
  });

  it("rejects every dirty process settlement", () => {
    const dirty = [
      { exitCode: 1 },
      { signal: "SIGKILL" },
      { protocolEof: false },
      { stdout: Buffer.from([0]) },
      { stderr: Buffer.from([0]) },
    ];
    for (const override of dirty) {
      const fixture = beginFixture();
      assertControllerError(
        () => finalizePlatformReleaseBootstrapNodeNativeControllerFixtureV2(
          fixture.begun.pending,
          {
            terminalFrameBytes: fixture.terminal,
            processSettlement: cleanSettlement(override),
            externalReleaseProbe: releaseProbe(fixture.begun.evidence),
          },
        ),
      );
    }
  });

  it("rejects replacement, swapped, re-ordered, incomplete, or promoted release probes", () => {
    const mutations: Array<(probe: Record<string, unknown>) => void> = [
      (probe) => {
        const shared = probe.sharedParentLock as Record<string, unknown>;
        const identity = shared.objectIdentity as Record<string, unknown>;
        identity.inode = "999";
      },
      (probe) => {
        const shared = probe.sharedParentLock;
        probe.sharedParentLock = probe.registeredNodePackageLock;
        probe.registeredNodePackageLock = shared;
      },
      (probe) => {
        probe.acquisitionOrder = [
          "registered_node_package_lock",
          "shared_parent_lock",
        ];
      },
      (probe) => { delete probe.registeredNodePackageLock; },
      (probe) => { probe.productionAuthority = true; },
    ];
    for (const mutate of mutations) {
      const fixture = beginFixture();
      const probe = releaseProbe(fixture.begun.evidence, mutate);
      assertControllerError(
        () => finalizePlatformReleaseBootstrapNodeNativeControllerFixtureV2(
          fixture.begun.pending,
          {
            terminalFrameBytes: fixture.terminal,
            processSettlement: cleanSettlement(),
            externalReleaseProbe: probe,
          },
        ),
        "NODE_NATIVE_CONTROLLER_PROBE_INVALID",
      );
    }
  });

  it("snapshots caller bytes and enforces forged, double, and failed-finalize one-use semantics", () => {
    const fixture = beginFixture();
    fixture.open.fill(0);
    fixture.observation.fill(0);
    fixture.begun.acknowledgementBytes.fill(0);
    const receipt = finalizeFixture(fixture);
    assert.equal(receipt.cleanProcessSettlement, true);

    assertControllerError(
      () => new PlatformReleaseBootstrapNodeNativeControllerPendingV2({}),
      "NODE_NATIVE_CONTROLLER_PENDING_INVALID",
    );
    const forged = Object.create(
      PlatformReleaseBootstrapNodeNativeControllerPendingV2.prototype,
    );
    assertControllerError(
      () => finalizePlatformReleaseBootstrapNodeNativeControllerFixtureV2(
        forged,
        {} as never,
      ),
      "NODE_NATIVE_CONTROLLER_PENDING_INVALID",
    );

    const twice = beginFixture();
    finalizeFixture(twice);
    assertControllerError(
      () => finalizeFixture(twice),
      "NODE_NATIVE_CONTROLLER_PENDING_INVALID",
    );

    const failed = beginFixture();
    assertControllerError(
      () => finalizePlatformReleaseBootstrapNodeNativeControllerFixtureV2(
        failed.begun.pending,
        {
          terminalFrameBytes: Buffer.alloc(0),
          processSettlement: cleanSettlement(),
          externalReleaseProbe: releaseProbe(failed.begun.evidence),
        },
      ),
    );
    assertControllerError(
      () => finalizeFixture(failed),
      "NODE_NATIVE_CONTROLLER_PENDING_INVALID",
    );

    const dropped = beginFixture();
    assert.equal(
      disposePlatformReleaseBootstrapNodeNativeControllerPendingV2(
        dropped.begun.pending,
      ),
      "disposed",
    );
    assert.equal(
      disposePlatformReleaseBootstrapNodeNativeControllerPendingV2(
        dropped.begun.pending,
      ),
      "already_disposed",
    );
    assertControllerError(
      () => finalizeFixture(dropped),
      "NODE_NATIVE_CONTROLLER_PENDING_INVALID",
    );

    const transportFailure = beginFixture();
    assertControllerError(
      () => finalizePlatformReleaseBootstrapNodeNativeControllerFixtureV2(
        transportFailure.begun.pending,
        {
          terminalFrameBytes: transportFailure.terminal,
          processSettlement: cleanSettlement({ protocolEof: false }),
          externalReleaseProbe: releaseProbe(transportFailure.begun.evidence),
        },
      ),
      "NODE_NATIVE_CONTROLLER_PROCESS_INVALID",
    );
    assert.equal(
      disposePlatformReleaseBootstrapNodeNativeControllerPendingV2(
        transportFailure.begun.pending,
      ),
      "already_disposed",
    );

    assertControllerError(
      () => disposePlatformReleaseBootstrapNodeNativeControllerPendingV2(
        forged,
      ),
      "NODE_NATIVE_CONTROLLER_PENDING_INVALID",
    );
  });

  it("rejects rehashed receipt promotion and keeps serialized parsing non-authoritative", () => {
    const receipt = finalizeFixture();
    assert.deepEqual(
      parsePlatformReleaseBootstrapNodeNativeControllerReceiptCandidateV2(
        structuredClone(receipt),
      ),
      receipt,
    );
    const promoted = structuredClone(receipt) as Record<string, unknown>;
    promoted.productionAuthority = true;
    promoted.receiptHash =
      hashPlatformReleaseBootstrapNodeNativeControllerReceiptV2(
        promoted as never,
      );
    assertControllerError(
      () => parsePlatformReleaseBootstrapNodeNativeControllerReceiptCandidateV2(
        promoted,
      ),
      "NODE_NATIVE_CONTROLLER_RECEIPT_INVALID",
    );
  });
});
