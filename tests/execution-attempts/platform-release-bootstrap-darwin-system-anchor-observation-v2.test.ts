import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureForTestV2,
  observePlatformReleaseBootstrapDarwinSystemAnchorObservationForTestV2,
  PlatformReleaseBootstrapDarwinSystemAnchorObservationErrorV2,
} from "../../src/product-compiler/platform-release-bootstrap-darwin-system-anchor-observation-test-support-v2.js";
import {
  PlatformReleaseBootstrapDarwinSystemAnchorObservationV2Schema,
  hashPlatformReleaseBootstrapDarwinSystemAnchorObservationV2,
  parsePlatformReleaseBootstrapDarwinSystemAnchorObservationCandidateV2,
} from "../../src/execution/schemas/platform-release-bootstrap-darwin-system-anchor-observation-v2.js";

describe("Darwin system-anchor observation v2", () => {
  it("captures exact parents, files, and logical aliases without authority", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture = buildPlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureForTestV2();
    try {
      const receipt = await observePlatformReleaseBootstrapDarwinSystemAnchorObservationForTestV2(
        fixture,
        { challenge: Buffer.alloc(32, 0x51) },
      );
      assert.equal(receipt.admissionScope, "test_fixture");
      assert.equal(receipt.productionAuthority, false);
      assert.equal(receipt.productionAdmission, "forbidden");
      assert.equal(receipt.credentialUse, "none");
      assert.equal(receipt.mutationAuthority, false);
      assert.equal(receipt.trustConclusion, "characterization_only");
      assert.equal(receipt.implementationScope, "test_fixture_direct_descriptor_capture_v2");
      assert.deepEqual(
        receipt.before.parents.map((parent) => parent.absoluteLocator),
        ["/bin", "/usr/bin"],
      );
      assert.deepEqual(
        receipt.before.files.map((file) => file.absoluteLocator),
        ["/bin/chmod", "/bin/ls", "/usr/bin/sandbox-exec", "/usr/bin/xattr"],
      );
      assert.deepEqual(
        receipt.before.logicalBindings.map((binding) => binding.fileRef),
        [
          "HOST_SYSTEM_CHMOD_EXECUTABLE_V2",
          "HOST_SYSTEM_LS_EXECUTABLE_V2",
          "HOST_SYSTEM_SANDBOX_EXECUTABLE_V2",
          "HOST_SYSTEM_XATTR_EXECUTABLE_V2",
          "HOST_SYSTEM_XATTR_EXECUTABLE_V2",
        ],
      );
      assert.equal(receipt.before.files.every((file) => file.stableIdentity.objectKind === "ordinary_file"), true);
      assert.equal(receipt.before.parents.every((parent) => parent.stableIdentity.objectKind === "directory"), true);
      assert.deepEqual(receipt.before, receipt.after);
      assert.equal(PlatformReleaseBootstrapDarwinSystemAnchorObservationV2Schema.safeParse(receipt).success, true);
      assert.equal(
        parsePlatformReleaseBootstrapDarwinSystemAnchorObservationCandidateV2(structuredClone(receipt)).probeHash,
        receipt.probeHash,
      );
      assert.equal(hashPlatformReleaseBootstrapDarwinSystemAnchorObservationV2(receipt), receipt.probeHash);
      assert.equal(JSON.stringify(receipt).includes("setfarm-darwin"), false);
    } finally {
      fixture.dispose();
    }
  });

  it("rejects forged challenge/authority, alias splits, identity drift, and handle replay", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture = buildPlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureForTestV2();
    try {
      await assert.rejects(
        observePlatformReleaseBootstrapDarwinSystemAnchorObservationForTestV2(fixture, { challenge: Buffer.alloc(31) }),
        (error: unknown) => error instanceof PlatformReleaseBootstrapDarwinSystemAnchorObservationErrorV2
          && error.code === "SYSTEM_ANCHOR_CHALLENGE_INVALID",
      );
      await assert.rejects(
        observePlatformReleaseBootstrapDarwinSystemAnchorObservationForTestV2({ dispose() {} }),
        (error: unknown) => error instanceof PlatformReleaseBootstrapDarwinSystemAnchorObservationErrorV2
          && error.code === "SYSTEM_ANCHOR_FIXTURE_HANDLE_UNAUTHENTICATED",
      );
      const receipt = await observePlatformReleaseBootstrapDarwinSystemAnchorObservationForTestV2(
        fixture,
        { challenge: Buffer.alloc(32, 0x52) },
      );
      const forgedAuthority = structuredClone(receipt) as Record<string, unknown>;
      forgedAuthority.productionAuthority = true;
      assert.equal(PlatformReleaseBootstrapDarwinSystemAnchorObservationV2Schema.safeParse(forgedAuthority).success, false);
      const forgedAlias = structuredClone(receipt) as Record<string, any>;
      forgedAlias.before.logicalBindings[4].fileRef = "HOST_SYSTEM_LS_EXECUTABLE_V2";
      assert.equal(PlatformReleaseBootstrapDarwinSystemAnchorObservationV2Schema.safeParse(forgedAlias).success, false);
      const forgedParent = structuredClone(receipt) as Record<string, any>;
      forgedParent.before.parents[0].stableIdentity.inode = "999999999";
      assert.equal(PlatformReleaseBootstrapDarwinSystemAnchorObservationV2Schema.safeParse(forgedParent).success, false);
      const forgedFile = structuredClone(receipt) as Record<string, any>;
      forgedFile.before.files[0].absoluteLocator = "/bin/ls";
      assert.equal(PlatformReleaseBootstrapDarwinSystemAnchorObservationV2Schema.safeParse(forgedFile).success, false);
    } finally {
      fixture.dispose();
    }
  });
});
