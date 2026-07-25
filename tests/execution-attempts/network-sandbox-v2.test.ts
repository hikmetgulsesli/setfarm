import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDeepStrictEqual } from "node:util";

import {
  NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_HASH_V2,
  NETWORK_SANDBOX_PROFILE_HASH_V2,
  NETWORK_SANDBOX_PROFILE_V2,
  NetworkIsolationProbeContextV2,
  NetworkIsolationSandboxErrorV2,
  createNetworkIsolationProbeContextV2ForTest,
  destroyNetworkIsolationProbeContextV2,
  runNetworkIsolatedV2,
} from "../../src/execution/network-sandbox-v2.js";
import {
  NETWORK_ISOLATION_AUTHORITY_V2_SCHEMA,
  NetworkIsolationAuthorityCandidateV2Schema,
  hashNetworkIsolationAuthorityV2,
} from "../../src/execution/schemas/evidence-environment-capsule-v2.js";
import {
  NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
  NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA,
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_NAMES_V2,
  NetworkIsolationNegativeProbeReceiptV2Schema,
  hashNetworkIsolationNegativeProbeReceiptV2,
  hashNetworkIsolationProbeSetV2,
  networkIsolationNegativeProbeReceiptSchemaHashV2,
  parseNetworkIsolationNegativeProbeReceiptV2,
} from "../../src/execution/schemas/network-isolation-negative-probe-v2.js";

function assertDeepFrozen(value: unknown): void {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object") continue;
    assert.equal(Object.isFrozen(current), true);
    pending.push(...Object.values(current));
  }
}

const darwinOnly = { skip: process.platform !== "darwin" } as const;

describe("NetworkSandboxV2", () => {
  it("runs exact loopback, DNS, outbound, redirect, and environment probes", darwinOnly,
    async () => {
      const context = await createNetworkIsolationProbeContextV2ForTest();
      try {
        assert.equal(context.admissionScope, "test_fixture");
        assert.match(context.wrapperModuleHash, /^[a-f0-9]{64}$/u);
        assert.match(context.sandboxExecutableHash, /^[a-f0-9]{64}$/u);
        assert.match(context.nodeExecutableHash, /^[a-f0-9]{64}$/u);
        assert.deepEqual(Object.keys(context).sort(), [
          "admissionScope",
          "hostRuntimeIdentityHash",
          "nodeExecutableHash",
          "platformTreeHash",
          "runtimePayloadHash",
          "sandboxExecutableHash",
          "wrapperModuleHash",
        ]);

        const result = await runNetworkIsolatedV2(context);
        assert.equal(result.status, "verified_test_fixture_network_isolation");
        assert.equal(result.productionDisposition,
          "forbidden_until_verified_platform_release");
        assert.equal(result.receipt.schema,
          NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA);
        assert.equal(NetworkIsolationNegativeProbeReceiptV2Schema.safeParse(
          result.receipt,
        ).success, true);
        assert.equal(result.receipt.receiptHash,
          hashNetworkIsolationNegativeProbeReceiptV2(result.receipt));
        assert.equal(result.receipt.probeSetHash,
          hashNetworkIsolationProbeSetV2(result.receipt.probes));
        assert.equal(result.receipt.probes.loopback.status, "passed");
        assert.equal(
          result.receipt.probes.loopback.requestNonceHash,
          result.receipt.probes.loopback.responseNonceHash,
        );
        assert.equal(result.receipt.probes.dns.status, "denied");
        assert.equal(result.receipt.probes.outbound.status, "denied");
        assert.equal(result.receipt.probes.redirect.status,
          "rejected_without_follow");
        assert.equal(result.receipt.probes.redirect.requestCount, 1);
        assert.deepEqual(
          result.receipt.environment.normalizedVariableNames,
          NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_NAMES_V2,
        );
        assert.deepEqual(
          result.receipt.environment.knownOsInjectedVariableNames,
          ["__CF_USER_TEXT_ENCODING"],
        );
        assert.equal(result.receipt.process.exitCode, 0);
        assert.equal(result.receipt.process.stderr.byteLength, 0);
        assert.equal(result.networkAuthority.schema,
          NETWORK_ISOLATION_AUTHORITY_V2_SCHEMA);
        assert.equal(NetworkIsolationAuthorityCandidateV2Schema.safeParse(
          result.networkAuthority,
        ).success, true);
        assert.equal(result.networkAuthority.authorityHash,
          hashNetworkIsolationAuthorityV2(result.networkAuthority));
        assert.equal(
          result.networkAuthority.negativeProbeReceiptSchemaHash,
          NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
        );

        const serialized = JSON.stringify(result);
        assert.equal(serialized.includes(process.cwd()), false);
        assert.equal(serialized.includes("setfarm-network-v2-"), false);
        assert.equal(serialized.includes(String(process.env.HOME)), false);
        assertDeepFrozen(result);

        const parsed = parseNetworkIsolationNegativeProbeReceiptV2(
          structuredClone(result.receipt),
        );
        assert.equal(isDeepStrictEqual(parsed, result.receipt), true);
        assertDeepFrozen(parsed);
      } finally {
        destroyNetworkIsolationProbeContextV2(context);
      }
    });

  it("serializes concurrent probes and supports fresh repeated observations", darwinOnly,
    async () => {
      const context = await createNetworkIsolationProbeContextV2ForTest();
      try {
        const concurrent = await Promise.allSettled([
          runNetworkIsolatedV2(context),
          runNetworkIsolatedV2(context),
        ]);
        assert.equal(concurrent.filter((entry) => entry.status === "fulfilled").length, 1);
        const rejected = concurrent.find((entry) => entry.status === "rejected") as
          PromiseRejectedResult;
        assert.equal(rejected.reason instanceof NetworkIsolationSandboxErrorV2, true);
        assert.equal(rejected.reason.code, "NETWORK_ISOLATION_V2_ALREADY_RUNNING");
        const first = (concurrent.find((entry) => entry.status === "fulfilled") as
          PromiseFulfilledResult<Awaited<ReturnType<typeof runNetworkIsolatedV2>>>).value;

        const second = await runNetworkIsolatedV2(context);
        assert.notEqual(second.receipt.attemptNonceHash,
          first.receipt.attemptNonceHash);
        assert.notEqual(second.receipt.receiptHash, first.receipt.receiptHash);
        assert.equal(second.networkAuthority.authorityHash,
          first.networkAuthority.authorityHash);
        assert.deepEqual(second.receipt.probes.dns, first.receipt.probes.dns);
        assert.deepEqual(second.receipt.probes.outbound,
          first.receipt.probes.outbound);
      } finally {
        destroyNetworkIsolationProbeContextV2(context);
      }
    });

  it("rejects forged, proxied, manually constructed, and destroyed contexts", darwinOnly,
    async () => {
      assert.throws(
        () => new NetworkIsolationProbeContextV2({}, {} as never),
        (error: unknown) => error instanceof NetworkIsolationSandboxErrorV2
          && error.code === "NETWORK_ISOLATION_V2_AUTHORITY_UNAUTHENTICATED",
      );
      const context = await createNetworkIsolationProbeContextV2ForTest();
      await assert.rejects(
        runNetworkIsolatedV2({ ...context } as NetworkIsolationProbeContextV2),
        (error: unknown) => error instanceof NetworkIsolationSandboxErrorV2
          && error.code === "NETWORK_ISOLATION_V2_AUTHORITY_UNAUTHENTICATED",
      );
      await assert.rejects(
        runNetworkIsolatedV2(new Proxy(context, {})),
        (error: unknown) => error instanceof NetworkIsolationSandboxErrorV2
          && error.code === "NETWORK_ISOLATION_V2_AUTHORITY_UNAUTHENTICATED",
      );
      destroyNetworkIsolationProbeContextV2(context);
      await assert.rejects(
        runNetworkIsolatedV2(context),
        (error: unknown) => error instanceof NetworkIsolationSandboxErrorV2
          && error.code === "NETWORK_ISOLATION_V2_DESTROYED",
      );
    });

  it("rejects self-rehashed receipt forgeries at typed cross-field boundaries", darwinOnly,
    async () => {
      const context = await createNetworkIsolationProbeContextV2ForTest();
      try {
        const result = await runNetworkIsolatedV2(context);

        const loopbackForgery = structuredClone(result.receipt) as any;
        loopbackForgery.probes.loopback.responseNonceHash = "f".repeat(64);
        loopbackForgery.probeSetHash = hashNetworkIsolationProbeSetV2(
          loopbackForgery.probes,
        );
        loopbackForgery.receiptHash = hashNetworkIsolationNegativeProbeReceiptV2(
          loopbackForgery,
        );
        assert.equal(NetworkIsolationNegativeProbeReceiptV2Schema.safeParse(
          loopbackForgery,
        ).success, false);

        const durationForgery = structuredClone(result.receipt) as any;
        durationForgery.durationMs += 1;
        durationForgery.receiptHash = hashNetworkIsolationNegativeProbeReceiptV2(
          durationForgery,
        );
        assert.equal(NetworkIsolationNegativeProbeReceiptV2Schema.safeParse(
          durationForgery,
        ).success, false);

        const environmentForgery = structuredClone(result.receipt) as any;
        environmentForgery.environment.normalizedVariableNames[0] = "PATH";
        environmentForgery.receiptHash = hashNetworkIsolationNegativeProbeReceiptV2(
          environmentForgery,
        );
        assert.equal(NetworkIsolationNegativeProbeReceiptV2Schema.safeParse(
          environmentForgery,
        ).success, false);
      } finally {
        destroyNetworkIsolationProbeContextV2(context);
      }
    });

  it("pins the code-owned profile, probe program, and receipt ABI", () => {
    assert.equal(runNetworkIsolatedV2.length, 1);
    assert.equal(createNetworkIsolationProbeContextV2ForTest.length, 0);
    assert.equal(networkIsolationNegativeProbeReceiptSchemaHashV2(),
      NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2);
    assert.match(NETWORK_SANDBOX_PROFILE_V2,
      /deny network-outbound/u);
    assert.match(NETWORK_SANDBOX_PROFILE_V2,
      /allow network-outbound \(remote ip "localhost:\*"\)/u);
    assert.deepEqual({
      profileHash: NETWORK_SANDBOX_PROFILE_HASH_V2,
      probeProgramHash: NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_HASH_V2,
      receiptAbiHash:
        NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
      normalizedEnvironmentHash:
        NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
    }, {
      profileHash:
        "f2c28eccae5791ed71ef703ff9455e68e77acad8ee3da996c4e269ebe031d0c9",
      probeProgramHash:
        "3c4d97c9f741b63daa37378f5b38e4d8e12a516543763435830e01d388a2e546",
      receiptAbiHash:
        "8c77228351b089f43d7146a1b3a048ef5dfd6b626f7d9f11b0f9099f225bb2f9",
      normalizedEnvironmentHash:
        "6a1d6208b0e36db05f098756ba5930ff1433d0c5b3739766996d574e03e1931b",
    });
  });
});
