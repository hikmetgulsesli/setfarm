import assert from "node:assert/strict";
import { createServer, type Server } from "node:net";
import { describe, it } from "node:test";
import { isDeepStrictEqual } from "node:util";

import {
  SOCKET_HANDOFF_TEST_CHILD_PROGRAM_HASH_V2,
  SOCKET_HANDOFF_TEST_HANDLER_ABI_HASH_V2,
  SOCKET_HANDOFF_TEST_LAUNCH_BINDING_V2,
  ExclusiveSocketLeaseErrorV2,
  ExclusiveSocketLeaseV2,
  acquireExclusiveSocketLeaseV2ForTest,
  closeExclusiveSocketLeaseV2ForTest,
  destroyExclusiveSocketLeaseV2ForTest,
  handoffExclusiveSocketLeaseV2ToTestChild,
  observeExclusiveSocketServiceReadinessV2ForTest,
} from "../../src/execution/exclusive-socket-lease-v2.js";
import {
  EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
  EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_HASH_V2,
  ExclusiveSocketLeaseReceiptV2Schema,
  ServiceReadinessReceiptV2Schema,
  SocketCleanupReceiptV2Schema,
  SocketHandoffAcknowledgementV2Schema,
  hashExclusiveSocketLeaseV2,
  hashServiceReadinessReceiptV2,
  hashSocketCleanupReceiptV2,
  hashSocketHandoffAcknowledgementV2,
  hashSocketProcessIdentityV2,
  parseExclusiveSocketLeaseReceiptV2,
  parseServiceReadinessReceiptV2,
  parseSocketCleanupReceiptV2,
  parseSocketHandoffAcknowledgementV2,
} from "../../src/execution/schemas/exclusive-socket-lease-v2.js";

function assertDeepFrozen(value: unknown): void {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object") continue;
    assert.equal(Object.isFrozen(current), true);
    pending.push(...Object.values(current));
  }
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function attemptExactBind(port: number): Promise<
  Readonly<{ bound: boolean; server: Server }>
> {
  const server = createServer();
  const bound = await new Promise<boolean>((resolve) => {
    server.once("error", () => resolve(false));
    server.listen({
      host: "127.0.0.1",
      port,
      exclusive: true,
      reusePort: false,
    }, () => resolve(true));
  });
  return Object.freeze({ bound, server });
}

async function runFullLifecycle() {
  const acquired = await acquireExclusiveSocketLeaseV2ForTest();
  try {
    const acknowledgement = await handoffExclusiveSocketLeaseV2ToTestChild(
      acquired.lease,
    );
    const readiness = await observeExclusiveSocketServiceReadinessV2ForTest(
      acquired.lease,
    );
    const cleanup = await closeExclusiveSocketLeaseV2ForTest(acquired.lease);
    return { acquired, acknowledgement, readiness, cleanup };
  } catch (error) {
    await destroyExclusiveSocketLeaseV2ForTest(acquired.lease);
    throw error;
  }
}

describe("ExclusiveSocketLeaseV2", () => {
  it("holds one socket through authenticated child handoff, readiness, and cleanup",
    async () => {
      const acquired = await acquireExclusiveSocketLeaseV2ForTest();
      const port = acquired.receipt.endpoint.port;
      try {
        assert.equal(acquired.status, "bound_test_fixture_socket");
        assert.equal(
          acquired.productionDisposition,
          "forbidden_until_verified_platform_release",
        );
        assert.deepEqual(Object.keys(acquired.lease).sort(), [
          "admissionScope",
          "leaseHash",
        ]);
        assert.equal(JSON.stringify(acquired.lease).includes(String(port)), false);
        assert.equal(
          ExclusiveSocketLeaseReceiptV2Schema.safeParse(
            acquired.receipt,
          ).success,
          true,
        );
        assert.equal(
          acquired.receipt.leaseHash,
          hashExclusiveSocketLeaseV2(acquired.receipt),
        );
        assert.equal(
          acquired.receipt.allocatorProcessIdentityHash,
          hashSocketProcessIdentityV2(acquired.receipt.allocatorProcess),
        );

        const whileBound = await attemptExactBind(port);
        assert.equal(whileBound.bound, false);
        await closeServer(whileBound.server);

        const handoff = await handoffExclusiveSocketLeaseV2ToTestChild(
          acquired.lease,
        );
        assert.equal(
          handoff.status,
          "acknowledged_test_fixture_socket",
        );
        assert.equal(
          SocketHandoffAcknowledgementV2Schema.safeParse(
            handoff.acknowledgement,
          ).success,
          true,
        );
        assert.equal(
          handoff.acknowledgement.acknowledgementHash,
          hashSocketHandoffAcknowledgementV2(
            handoff.acknowledgement,
          ),
        );
        assert.equal(
          handoff.acknowledgement.leaseHash,
          acquired.receipt.leaseHash,
        );
        assert.equal(
          handoff.acknowledgement.descriptorCapabilityHash,
          acquired.receipt.descriptorCapabilityHash,
        );
        assert.equal(
          handoff.acknowledgement.sendObservation.sendCallbackAuthority,
          "forbidden",
        );
        assert.equal(
          handoff.acknowledgement.listenerObservation.candidateListen,
          "forbidden",
        );

        const whileChildOwns = await attemptExactBind(port);
        assert.equal(whileChildOwns.bound, false);
        await closeServer(whileChildOwns.server);

        const readiness =
          await observeExclusiveSocketServiceReadinessV2ForTest(
            acquired.lease,
          );
        assert.equal(readiness.status, "ready_test_fixture_socket");
        assert.equal(
          ServiceReadinessReceiptV2Schema.safeParse(
            readiness.receipt,
          ).success,
          true,
        );
        assert.equal(
          readiness.receipt.acknowledgementHash,
          handoff.acknowledgement.acknowledgementHash,
        );
        assert.equal(
          readiness.receipt.probe.requestNonceHash,
          readiness.receipt.probe.responseNonceHash,
        );
        assert.equal(readiness.receipt.probe.requestCount, 1);

        const cleanup = await closeExclusiveSocketLeaseV2ForTest(
          acquired.lease,
        );
        assert.equal(cleanup.status, "closed_test_fixture_socket");
        assert.equal(
          SocketCleanupReceiptV2Schema.safeParse(cleanup.receipt).success,
          true,
        );
        assert.equal(
          cleanup.receipt.readinessHash,
          readiness.receipt.readinessHash,
        );
        assert.equal(
          cleanup.receipt.portRelease.method,
          "exclusive_rebind_probe",
        );
        assert.equal(cleanup.receipt.processTermination.exitCode, 0);
        assert.equal(cleanup.receipt.processTermination.signal, null);

        const afterCleanup = await attemptExactBind(port);
        assert.equal(afterCleanup.bound, true);
        await closeServer(afterCleanup.server);

        for (const receipt of [
          acquired.receipt,
          handoff.acknowledgement,
          readiness.receipt,
          cleanup.receipt,
        ]) {
          assertDeepFrozen(receipt);
          const serialized = JSON.stringify(receipt);
          assert.equal(serialized.includes("setfarm-socket-v2-"), false);
          assert.equal(serialized.includes(String(process.env.HOME)), false);
        }
      } finally {
        await destroyExclusiveSocketLeaseV2ForTest(acquired.lease);
      }
    });

  it("enforces exact private state order and one concurrent handoff owner",
    async () => {
      assert.throws(
        () => new ExclusiveSocketLeaseV2({}, {} as never),
        (error: unknown) => error instanceof ExclusiveSocketLeaseErrorV2
          && error.code === "EXCLUSIVE_SOCKET_V2_AUTHORITY_UNAUTHENTICATED",
      );
      const acquired = await acquireExclusiveSocketLeaseV2ForTest();
      try {
        await assert.rejects(
          observeExclusiveSocketServiceReadinessV2ForTest(acquired.lease),
          (error: unknown) => error instanceof ExclusiveSocketLeaseErrorV2
            && error.code === "EXCLUSIVE_SOCKET_V2_STATE_INVALID",
        );
        await assert.rejects(
          handoffExclusiveSocketLeaseV2ToTestChild(
            { ...acquired.lease } as ExclusiveSocketLeaseV2,
          ),
          (error: unknown) => error instanceof ExclusiveSocketLeaseErrorV2
            && error.code === "EXCLUSIVE_SOCKET_V2_AUTHORITY_UNAUTHENTICATED",
        );
        await assert.rejects(
          handoffExclusiveSocketLeaseV2ToTestChild(
            new Proxy(acquired.lease, {}),
          ),
          (error: unknown) => error instanceof ExclusiveSocketLeaseErrorV2
            && error.code === "EXCLUSIVE_SOCKET_V2_AUTHORITY_UNAUTHENTICATED",
        );

        const concurrent = await Promise.allSettled([
          handoffExclusiveSocketLeaseV2ToTestChild(acquired.lease),
          handoffExclusiveSocketLeaseV2ToTestChild(acquired.lease),
        ]);
        assert.equal(
          concurrent.filter((entry) => entry.status === "fulfilled").length,
          1,
        );
        const rejected = concurrent.find(
          (entry) => entry.status === "rejected",
        ) as PromiseRejectedResult;
        assert.equal(
          rejected.reason instanceof ExclusiveSocketLeaseErrorV2,
          true,
        );
        assert.equal(
          rejected.reason.code,
          "EXCLUSIVE_SOCKET_V2_STATE_INVALID",
        );

        await assert.rejects(
          closeExclusiveSocketLeaseV2ForTest(acquired.lease),
          (error: unknown) => error instanceof ExclusiveSocketLeaseErrorV2
            && error.code === "EXCLUSIVE_SOCKET_V2_STATE_INVALID",
        );
        await observeExclusiveSocketServiceReadinessV2ForTest(acquired.lease);
        await closeExclusiveSocketLeaseV2ForTest(acquired.lease);
        await assert.rejects(
          observeExclusiveSocketServiceReadinessV2ForTest(acquired.lease),
          (error: unknown) => error instanceof ExclusiveSocketLeaseErrorV2
            && error.code === "EXCLUSIVE_SOCKET_V2_STATE_INVALID",
        );
      } finally {
        await destroyExclusiveSocketLeaseV2ForTest(acquired.lease);
      }
    });

  it("destroys an unhanded lease without issuing success evidence",
    async () => {
      const acquired = await acquireExclusiveSocketLeaseV2ForTest();
      const port = acquired.receipt.endpoint.port;
      await destroyExclusiveSocketLeaseV2ForTest(acquired.lease);
      const rebound = await attemptExactBind(port);
      try {
        assert.equal(rebound.bound, true);
      } finally {
        await closeServer(rebound.server);
      }
      await assert.rejects(
        handoffExclusiveSocketLeaseV2ToTestChild(acquired.lease),
        (error: unknown) => error instanceof ExclusiveSocketLeaseErrorV2
          && error.code === "EXCLUSIVE_SOCKET_V2_STATE_INVALID",
      );
    });

  it("supports independent concurrent held sockets without port reuse",
    async () => {
      const [left, right] = await Promise.all([
        acquireExclusiveSocketLeaseV2ForTest(),
        acquireExclusiveSocketLeaseV2ForTest(),
      ]);
      try {
        assert.notEqual(
          left.receipt.endpoint.port,
          right.receipt.endpoint.port,
        );
        assert.notEqual(left.receipt.leaseHash, right.receipt.leaseHash);
        await Promise.all([
          handoffExclusiveSocketLeaseV2ToTestChild(left.lease),
          handoffExclusiveSocketLeaseV2ToTestChild(right.lease),
        ]);
        await Promise.all([
          observeExclusiveSocketServiceReadinessV2ForTest(left.lease),
          observeExclusiveSocketServiceReadinessV2ForTest(right.lease),
        ]);
        await Promise.all([
          closeExclusiveSocketLeaseV2ForTest(left.lease),
          closeExclusiveSocketLeaseV2ForTest(right.lease),
        ]);
      } finally {
        await Promise.all([
          destroyExclusiveSocketLeaseV2ForTest(left.lease),
          destroyExclusiveSocketLeaseV2ForTest(right.lease),
        ]);
      }
    });

  it("rejects self-rehashed cross-field receipt forgeries", async () => {
    const { acquired, acknowledgement, readiness, cleanup } =
      await runFullLifecycle();

    const allocatorForgery = structuredClone(acquired.receipt) as any;
    allocatorForgery.allocatorProcess.pid += 1;
    allocatorForgery.leaseHash =
      hashExclusiveSocketLeaseV2(allocatorForgery);
    assert.equal(
      ExclusiveSocketLeaseReceiptV2Schema.safeParse(
        allocatorForgery,
      ).success,
      false,
    );

    const policyForgery = structuredClone(acquired.receipt) as any;
    policyForgery.allocationPolicy = "verified_http_service_band_v2";
    policyForgery.leaseHash = hashExclusiveSocketLeaseV2(policyForgery);
    assert.equal(
      ExclusiveSocketLeaseReceiptV2Schema.safeParse(policyForgery).success,
      false,
    );

    const lifecycleForgery = structuredClone(acquired.receipt) as any;
    lifecycleForgery.lifecycleAbiHash = "f".repeat(64);
    lifecycleForgery.leaseHash =
      hashExclusiveSocketLeaseV2(lifecycleForgery);
    assert.equal(
      ExclusiveSocketLeaseReceiptV2Schema.safeParse(
        lifecycleForgery,
      ).success,
      false,
    );

    const processForgery = structuredClone(
      acknowledgement.acknowledgement,
    ) as any;
    processForgery.childProcess.pid += 1;
    processForgery.acknowledgementHash =
      hashSocketHandoffAcknowledgementV2(processForgery);
    assert.equal(
      SocketHandoffAcknowledgementV2Schema.safeParse(
        processForgery,
      ).success,
      false,
    );

    const lateAckForgery = structuredClone(
      acknowledgement.acknowledgement,
    ) as any;
    lateAckForgery.acknowledgedAt = new Date(
      Date.parse(lateAckForgery.sentAt) + 5_001,
    ).toISOString();
    lateAckForgery.acknowledgementHash =
      hashSocketHandoffAcknowledgementV2(lateAckForgery);
    assert.equal(
      SocketHandoffAcknowledgementV2Schema.safeParse(
        lateAckForgery,
      ).success,
      false,
    );

    const responseForgery = structuredClone(readiness.receipt) as any;
    responseForgery.probe.responseNonceHash = "f".repeat(64);
    responseForgery.readinessHash =
      hashServiceReadinessReceiptV2(responseForgery);
    assert.equal(
      ServiceReadinessReceiptV2Schema.safeParse(responseForgery).success,
      false,
    );

    const durationForgery = structuredClone(cleanup.receipt) as any;
    durationForgery.durationMs += 1;
    durationForgery.cleanupHash =
      hashSocketCleanupReceiptV2(durationForgery);
    assert.equal(
      SocketCleanupReceiptV2Schema.safeParse(durationForgery).success,
      false,
    );
  });

  it("bounds and freezes every public receipt parser", async () => {
    const { acquired, acknowledgement, readiness, cleanup } =
      await runFullLifecycle();
    const pairs = [
      [
        acquired.receipt,
        parseExclusiveSocketLeaseReceiptV2,
      ],
      [
        acknowledgement.acknowledgement,
        parseSocketHandoffAcknowledgementV2,
      ],
      [
        readiness.receipt,
        parseServiceReadinessReceiptV2,
      ],
      [
        cleanup.receipt,
        parseSocketCleanupReceiptV2,
      ],
    ] as const;
    for (const [receipt, parse] of pairs) {
      const parsed = parse(structuredClone(receipt) as never);
      assert.equal(isDeepStrictEqual(parsed, receipt), true);
      assertDeepFrozen(parsed);
      assert.throws(() => parse({
        ...receipt,
        padding: "x".repeat(65_536),
      } as never));
      const cyclic: Record<string, unknown> = { ...receipt };
      cyclic.self = cyclic;
      assert.throws(() => parse(cyclic as never));
      assert.throws(() => parse(new Proxy({}, {}) as never));
    }
  });

  it("pins lifecycle, port-band, child-program, handler, and launch ABI hashes",
    () => {
      assert.equal(acquireExclusiveSocketLeaseV2ForTest.length, 0);
      assert.equal(handoffExclusiveSocketLeaseV2ToTestChild.length, 1);
      assert.equal(
        observeExclusiveSocketServiceReadinessV2ForTest.length,
        1,
      );
      assert.equal(closeExclusiveSocketLeaseV2ForTest.length, 1);
      assert.deepEqual({
        lifecycleAbiHash: EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
        portBandsHash: EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_HASH_V2,
        childProgramHash: SOCKET_HANDOFF_TEST_CHILD_PROGRAM_HASH_V2,
        handlerAbiHash: SOCKET_HANDOFF_TEST_HANDLER_ABI_HASH_V2,
        launchBindingHash: SOCKET_HANDOFF_TEST_LAUNCH_BINDING_V2.bindingHash,
      }, {
        lifecycleAbiHash:
          "29000efa6a574d5c248ae4b31c35c78947f64772da4e680c6ee48de286de29fe",
        portBandsHash:
          "12302cea555853e9c3dcd7cc5178c7078a208224018a2e0788cac9c4491b8417",
        childProgramHash:
          "3321bdff68275fc8756c6a88c0bebd8699e3d8cad4f86bdb4d38dccb67deaa10",
        handlerAbiHash:
          "e2609f54fd470e501e69dcba185ad8fede9f0f51d2efa5279ca1a54544e7432c",
        launchBindingHash:
          "09d18e9d71e832b25d5ff13d2fa40ed90d6e01871bf682e11a8fec0c21c22283",
      });
      assert.equal(new Set([
        EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
        EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_HASH_V2,
        SOCKET_HANDOFF_TEST_CHILD_PROGRAM_HASH_V2,
        SOCKET_HANDOFF_TEST_HANDLER_ABI_HASH_V2,
        SOCKET_HANDOFF_TEST_LAUNCH_BINDING_V2.bindingHash,
      ]).size, 5);
    });
});
