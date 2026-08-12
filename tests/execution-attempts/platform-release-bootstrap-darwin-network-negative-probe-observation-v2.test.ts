import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { describe, it } from "node:test";

import {
  buildPlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationFixtureForTestV2,
  observePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationForTestV2,
  PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationErrorV2,
} from "../../src/product-compiler/platform-release-bootstrap-darwin-network-negative-probe-observation-test-support-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_POLICY_HASH_V2,
  hashNetworkNegativeProbeObservationV2,
  hashPlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationV2,
  parsePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationCandidateV2,
} from "../../src/execution/schemas/platform-release-bootstrap-darwin-network-negative-probe-observation-v2.js";
import {
  hashNetworkIsolationNegativeProbeReceiptV2,
} from "../../src/execution/schemas/network-isolation-negative-probe-v2.js";

const darwinOnly = { skip: process.platform !== "darwin" } as const;

function assertDeepFrozen(value: unknown): void {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object") continue;
    assert.equal(Object.isFrozen(current), true);
    pending.push(...Object.values(current));
  }
}

describe("Darwin network-negative physical observation v2", () => {
  it("joins the unchanged deny-all probe to descriptor-bounded stable and mutable evidence", darwinOnly,
    async () => {
      const fixture =
        await buildPlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationFixtureForTestV2();
      try {
        const observation =
          await observePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationForTestV2(
            fixture,
            { challenge: Buffer.alloc(32, 0x42) },
          );
        assert.equal(
          observation.schema,
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_V2_SCHEMA,
        );
        assert.equal(observation.admissionScope, "test_fixture");
        assert.equal(observation.productionAuthority, false);
        assert.equal(observation.productionAdmission, "forbidden");
        assert.equal(observation.credentialUse, "none");
        assert.equal(observation.mutationAuthority, false);
        assert.equal(observation.trustConclusion, "characterization_only");
        assert.equal(
          observation.payloadBinding,
          "test_fixture_ts_source_module_not_release_dist_v2",
        );
        assert.equal(
          observation.policyHash,
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_POLICY_HASH_V2,
        );
        assert.deepEqual(observation.before, observation.after);
        assert.equal(
          observation.before.root.stableIdentity.hostIdentityHash,
          observation.hostIdentityHash,
        );
        assert.equal(observation.before.files.length, 3);
        assert.deepEqual(
          observation.before.files.map((file) => file.roleRef),
          [
            "NETWORK_PROBE_WRAPPER_MODULE_V2",
            "NETWORK_PROBE_SANDBOX_EXECUTABLE_V2",
            "NETWORK_PROBE_NODE_EXECUTABLE_V2",
          ],
        );
        for (const file of observation.before.files) {
          assert.equal(file.stableIdentity.objectKind, "ordinary_file");
          assert.equal(file.mutableFingerprint.linkCount, 1);
          assert.match(file.stableIdentity.device, /^(?:0|[1-9][0-9]*)$/u);
          assert.match(file.stableIdentity.inode, /^(?:0|[1-9][0-9]*)$/u);
          assert.notEqual(
            file.stableIdentity.inode,
            file.mutableFingerprint.contentHash,
          );
        }
        assert.equal(observation.before.root.stableIdentity.objectKind, "directory");
        assert.equal(
          observation.before.root.mutableFingerprint.contentHash,
          observation.before.root.directEntryNamesHash,
        );
        assert.equal(observation.networkReceipt.probes.loopback.status, "passed");
        assert.equal(observation.networkReceipt.probes.dns.status, "denied");
        assert.equal(observation.networkReceipt.probes.outbound.status, "denied");
        assert.equal(
          observation.networkReceipt.probes.redirect.status,
          "rejected_without_follow",
        );
        assert.equal(
          JSON.stringify(observation).includes("setfarm-network-negative-observation-v2-"),
          false,
        );
        const parsed =
          parsePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationCandidateV2(
            structuredClone(observation),
          );
        assert.equal(isDeepStrictEqual(parsed, observation), true);
        assertDeepFrozen(parsed);
      } finally {
        fixture.dispose();
      }
    });

  it("rejects malformed challenges, forged authority, cross-host joins, and handle replay", darwinOnly,
    async () => {
      const fixture =
        await buildPlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationFixtureForTestV2();
      let observation: Awaited<
        ReturnType<
          typeof observePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationForTestV2
        >
      >;
      try {
        await assert.rejects(
          observePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationForTestV2(
            fixture,
            { challenge: Buffer.alloc(31) },
          ),
          (error: unknown) =>
            error instanceof
              PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationErrorV2
            && error.code === "NETWORK_NEGATIVE_PROBE_CHALLENGE_INVALID",
        );
        observation =
          await observePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationForTestV2(
            fixture,
          );
      } finally {
        fixture.dispose();
      }

      const authorityForgery = structuredClone(observation) as any;
      authorityForgery.productionAuthority = true;
      assert.throws(
        () => parsePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationCandidateV2(
          authorityForgery,
        ),
      );

      const hostJoinForgery = structuredClone(observation) as any;
      hostJoinForgery.after.root.stableIdentity.hostIdentityHash = "f".repeat(64);
      assert.throws(
        () => parsePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationCandidateV2(
          hostJoinForgery,
        ),
      );

      const rootFingerprintForgery = structuredClone(observation) as any;
      rootFingerprintForgery.before.root.mutableFingerprint.contentHash =
        "e".repeat(64);
      assert.throws(
        () => parsePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationCandidateV2(
          rootFingerprintForgery,
        ),
      );

      const unjoinedExecutableForgery = structuredClone(observation) as any;
      unjoinedExecutableForgery.networkReceipt.implementation.wrapperModuleHash =
        "f".repeat(64);
      unjoinedExecutableForgery.networkReceipt.receiptHash =
        hashNetworkIsolationNegativeProbeReceiptV2(
          unjoinedExecutableForgery.networkReceipt,
        );
      unjoinedExecutableForgery.networkReceiptHash =
        unjoinedExecutableForgery.networkReceipt.receiptHash;
      unjoinedExecutableForgery.observationHash =
        hashNetworkNegativeProbeObservationV2({
          challengeHash: unjoinedExecutableForgery.challengeHash,
          hostIdentityHash: unjoinedExecutableForgery.hostIdentityHash,
          networkReceiptHash: unjoinedExecutableForgery.networkReceiptHash,
          observationOutcome: unjoinedExecutableForgery.observationOutcome,
          policyHash: unjoinedExecutableForgery.policyHash,
          before: unjoinedExecutableForgery.before,
          after: unjoinedExecutableForgery.after,
        });
      unjoinedExecutableForgery.probeHash =
        hashPlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationV2(
          unjoinedExecutableForgery,
        );
      assert.throws(
        () => parsePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationCandidateV2(
          unjoinedExecutableForgery,
        ),
      );

      const replayed = new Proxy(observation as object, {});
      await assert.rejects(
        observePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationForTestV2(
          replayed as never,
        ),
        (error: unknown) =>
          error instanceof
            PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationErrorV2
          && error.code === "NETWORK_NEGATIVE_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
      );
    });
});
