import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  buildPlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureForTestV2,
  observePlatformReleaseBootstrapDarwinSystemAnchorObservationForTestV2,
  type PlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureV2,
} from "../../src/product-compiler/platform-release-bootstrap-darwin-system-anchor-observation-test-support-v2.js";
import {
  derivePlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2,
  PlatformReleaseBootstrapDarwinSystemAnchorRelationTestErrorV2,
} from "../../src/product-compiler/platform-release-bootstrap-darwin-system-anchor-relation-test-support-v2.js";

let fixture: PlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureV2 | undefined;
let observation: Record<string, any> | undefined;

function requireObservationV2(): Record<string, any> {
  assert.ok(observation);
  return observation;
}

function assertInvalidV2(action: () => unknown, code: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(
      error instanceof PlatformReleaseBootstrapDarwinSystemAnchorRelationTestErrorV2,
    );
    assert.equal(error.code, code);
    return true;
  });
}

describe("Darwin system-anchor hash-only relation v2", () => {
  before(async () => {
    if (process.platform !== "darwin") return;
    fixture =
      buildPlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureForTestV2();
    observation = await observePlatformReleaseBootstrapDarwinSystemAnchorObservationForTestV2(
      fixture,
      { challenge: Buffer.alloc(32, 0x61) },
    ) as unknown as Record<string, any>;
  });

  after(() => {
    fixture?.dispose();
  });

  it("derives only a frozen false-authority hash relation", {
    skip: process.platform !== "darwin",
  }, () => {
    const relation =
      derivePlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2(
        requireObservationV2(),
      );
    assert.deepEqual(Object.keys(relation).sort(), [
      "admissionScope",
      "observationHash",
      "productionAdmission",
      "productionAuthority",
      "relation",
    ]);
    assert.equal(relation.admissionScope, "test_fixture");
    assert.equal(relation.productionAuthority, false);
    assert.equal(relation.productionAdmission, "forbidden");
    assert.equal(
      relation.observationHash,
      requireObservationV2().observationHash,
    );
    assert.equal(Object.isFrozen(relation), true);
    assert.equal(JSON.stringify(relation).includes("absoluteLocator"), false);
    assert.equal(JSON.stringify(relation).includes("/usr/bin"), false);
  });

  it("rejects a relation/hash supplied without a real observation", {
    skip: process.platform !== "darwin",
  }, () => {
    assertInvalidV2(
      () => derivePlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2({
        relation:
          "external_system_anchor_observation_hash_only_test_relation_v2",
        admissionScope: "test_fixture",
        productionAuthority: false,
        productionAdmission: "forbidden",
        observationHash: "a".repeat(64),
      }),
      "SYSTEM_ANCHOR_RELATION_OBSERVATION_INVALID",
    );
  });

  it("rejects forged authority, hash, topology, and extra serialized fields", {
    skip: process.platform !== "darwin",
  }, () => {
    const forgedAuthority = structuredClone(requireObservationV2());
    forgedAuthority.productionAuthority = true;
    assertInvalidV2(
      () => derivePlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2(
        forgedAuthority,
      ),
      "SYSTEM_ANCHOR_RELATION_OBSERVATION_INVALID",
    );

    const forgedHash = structuredClone(requireObservationV2());
    forgedHash.observationHash = "b".repeat(64);
    assertInvalidV2(
      () => derivePlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2(
        forgedHash,
      ),
      "SYSTEM_ANCHOR_RELATION_OBSERVATION_INVALID",
    );

    const forgedTopology = structuredClone(requireObservationV2());
    forgedTopology.before.logicalBindings[4].fileRef =
      "HOST_SYSTEM_LS_EXECUTABLE_V2";
    assertInvalidV2(
      () => derivePlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2(
        forgedTopology,
      ),
      "SYSTEM_ANCHOR_RELATION_OBSERVATION_INVALID",
    );

    const mismatchedFence = structuredClone(requireObservationV2());
    mismatchedFence.after.parents[0].stableIdentity.inode = "999999999";
    assertInvalidV2(
      () => derivePlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2(
        mismatchedFence,
      ),
      "SYSTEM_ANCHOR_RELATION_OBSERVATION_INVALID",
    );

    const extraField = structuredClone(requireObservationV2());
    extraField.untrustedHash = "c".repeat(64);
    assertInvalidV2(
      () => derivePlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2(
        extraField,
      ),
      "SYSTEM_ANCHOR_RELATION_OBSERVATION_INVALID",
    );
  });

  it("rejects proxies before reading traps", {
    skip: process.platform !== "darwin",
  }, () => {
    let trapCalls = 0;
    const proxied = new Proxy(requireObservationV2(), {
      ownKeys() {
        trapCalls += 1;
        throw new Error("proxy trap must not run");
      },
    });
    assertInvalidV2(
      () => derivePlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2(
        proxied,
      ),
      "SYSTEM_ANCHOR_RELATION_INPUT_INVALID",
    );
    assert.equal(trapCalls, 0);
  });
});
