import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  createPlatformReleaseCandidateEnvelopeFixtureV2,
} from "./fixtures/platform-release-manifest-v2-fixture.js";
import {
  armPlatformReleaseContentStoreTestDisposeFailureForTestV2,
  buildPlatformReleaseContentStoreTestFixtureForTestV2 as buildPlatformReleaseContentStoreTestFixtureRawForTestV2,
  buildPlatformReleaseContentStoreTestStageForTestV2,
  inspectPlatformReleaseContentStoreCleanupReplacementForTestV2,
  inspectPlatformReleaseContentStoreTestFixtureLifecycleForTestV2,
  inspectPlatformReleaseContentStorePrePublicationMutationForTestV2,
  mutatePlatformReleaseContentStoreExternalSentinelForTestV2,
  mutatePlatformReleaseContentStoreCleanupReplacementForTestV2,
  mutatePlatformReleaseContentStoreTestFixtureForTestV2,
  mutatePlatformReleaseContentStoreTestFixtureBeforePublicationForTestV2,
  PlatformReleaseContentStoreTestErrorV2,
  publishPlatformReleaseContentStoreTestForTestV2,
  recoverPlatformReleaseContentStoreCleanupReplacementForTestV2,
  reproducePlatformReleaseContentStoreTestForTestV2,
} from "../../src/product-compiler/platform-release-content-store-test-support-v2.js";
import {
  buildPlatformReleaseContentStoreDarwinFilesystemFixtureV2,
  type PlatformReleaseContentStoreDarwinFilesystemFixtureV2,
} from "../../src/product-compiler/platform-release-content-store-darwin-filesystem-fixture-v2.js";
import {
  hashPlatformReleaseContentStoreTestV2,
  parsePlatformReleaseContentStoreTestCandidateV2,
  PlatformReleaseContentStoreTestV2Schema,
} from "../../src/execution/schemas/platform-release-content-store-test-v2.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

function expectStoreError(action: () => unknown, code: PlatformReleaseContentStoreTestErrorV2["code"]): void {
  assert.throws(action, (error: unknown) => {
    assert.equal(error instanceof PlatformReleaseContentStoreTestErrorV2, true);
    assert.equal((error as PlatformReleaseContentStoreTestErrorV2).code, code);
    return true;
  });
}

let nativeFilesystemFixture: PlatformReleaseContentStoreDarwinFilesystemFixtureV2;

function buildPlatformReleaseContentStoreTestFixtureForTestV2() {
  assert.notEqual(nativeFilesystemFixture, undefined);
  return buildPlatformReleaseContentStoreTestFixtureRawForTestV2(
    nativeFilesystemFixture,
  );
}

describe("platform release immutable content store v2", {
  skip: process.platform !== "darwin",
}, () => {
  before(async () => {
    nativeFilesystemFixture =
      await buildPlatformReleaseContentStoreDarwinFilesystemFixtureV2();
  });

  after(() => {
    assert.deepEqual(nativeFilesystemFixture.dispose(), {
      schema:
        "setfarm.platform-release-content-store-filesystem-fixture-retention-disposition.v2",
      admissionScope: "test_fixture",
      productionAuthority: false,
      deletionAuthority: false,
      filesystemMutationPerformed: false,
      rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2",
    });
  });

  it("publishes one private immutable snapshot, then adopts identical content without replacement", () => {
    expectStoreError(
      () => buildPlatformReleaseContentStoreTestFixtureRawForTestV2(
        {
          buildRecipeHash: nativeFilesystemFixture.buildRecipeHash,
          binarySha256: nativeFilesystemFixture.binarySha256,
          binaryByteLength: nativeFilesystemFixture.binaryByteLength,
          dispose() {},
        } as never,
      ),
      "CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED",
    );
    expectStoreError(
      () => buildPlatformReleaseContentStoreTestFixtureRawForTestV2(
        new Proxy(nativeFilesystemFixture, {}),
      ),
      "CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED",
    );
    const candidate = createPlatformReleaseCandidateEnvelopeFixtureV2();
    const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
    try {
      const stage = buildPlatformReleaseContentStoreTestStageForTestV2(candidate);
      const receipt = publishPlatformReleaseContentStoreTestForTestV2(
        fixture,
        stage,
        { challenge: Buffer.alloc(32, 0x81) },
      );

      assert.equal(receipt.authorityState, "test_fixture_content_store_unverified");
      assert.equal(receipt.admissionScope, "test_fixture");
      assert.equal(receipt.productionAuthority, false);
      assert.equal(receipt.productionAdmission, "forbidden");
      assert.equal(receipt.credentialUse, "none");
      assert.equal(receipt.signingAuthority, "unsigned_test_fixture");
      assert.equal(receipt.mutationAuthority, false);
      assert.equal(receipt.operationMode, "test_fixture_publication_only");
      assert.equal(receipt.trustConclusion, "characterization_only");
      assert.deepEqual(receipt.productionBlockers, [
        "production_store_bootstrap_absent",
        "authenticated_release_lease_absent",
        "atomic_conditional_unlink_absent",
        "crash_replay_ledger_absent",
        "runtime_payload_unbound",
        "fresh_production_verifier_absent",
      ]);
      assert.equal(receipt.snapshotScope, "single_release_single_attestation_fixture_snapshot_v2");
      assert.equal(receipt.ephemeralLockPolicy, "ephemeral_lock_lease_excluded_from_stable_receipt_v2");
      assert.deepEqual(receipt.filesystemMechanics, {
        capability: "darwin_descriptor_relative_content_store_fixture_v2",
        productionAuthority: false,
        publicationBackend: "darwin_native_descriptor_relative_no_replace_fixture_v2",
        contentLeasePolicy:
          "descriptor_relative_lockf_exclusive_manifest_payload_hash_lease_v2",
        attestationLeasePolicy:
          "descriptor_relative_lockf_exclusive_attestation_hash_lease_v2",
        conditionalUnlinkPolicy:
          "preserve_unless_exact_identity_revalidated_no_same_uid_atomic_unlink_v2",
        exactCleanupPolicy:
          "descriptor_relative_known_shape_non_recursive_fail_closed_v2",
        staleLeaseRecoveryPolicy:
          "unauthenticated_fixture_exact_inode_and_f_tlock_only_v2",
        contentLeaseRecovered: false,
        attestationLeaseRecovered: false,
        unauthenticatedStaleLeaseRecoveryEnabled: true,
        authenticatedLeaseLedgerPresent: false,
        sameUidAtomicConditionalUnlinkAvailable: false,
        fixtureBuildRecipeHash: nativeFilesystemFixture.buildRecipeHash,
        fixtureBinaryHash: nativeFilesystemFixture.binarySha256,
        fixtureBinaryByteLength: nativeFilesystemFixture.binaryByteLength,
      });
      assert.match(receipt.nativePublicationHash, /^[a-f0-9]{64}$/u);
      assert.equal(receipt.publication, "published");
      assert.equal(receipt.releaseContentHash, receipt.manifestPayloadHash);
      assert.equal(receipt.publishedFence.storeRoot.stableIdentity.objectKind, "directory");
      assert.equal(receipt.publishedFence.locksRoot.stableIdentity.objectKind, "directory");
      assert.equal(receipt.publishedFence.stagingRoot.stableIdentity.objectKind, "directory");
      assert.equal(receipt.publishedFence.attestationsRoot.stableIdentity.objectKind, "directory");
      assert.equal(receipt.publishedFence.releasesRoot.stableIdentity.objectKind, "directory");
      assert.equal(receipt.publishedFence.releaseRoot.stableIdentity.objectKind, "directory");
      assert.equal(receipt.publishedFence.manifest.stableIdentity.objectKind, "ordinary_file");
      assert.equal(receipt.publishedFence.attestation.stableIdentity.objectKind, "ordinary_file");
      const hostHashes = new Set([
        receipt.publishedFence.storeRoot.stableIdentity.hostIdentityHash,
        receipt.publishedFence.locksRoot.stableIdentity.hostIdentityHash,
        receipt.publishedFence.stagingRoot.stableIdentity.hostIdentityHash,
        receipt.publishedFence.attestationsRoot.stableIdentity.hostIdentityHash,
        receipt.publishedFence.releasesRoot.stableIdentity.hostIdentityHash,
        receipt.publishedFence.releaseRoot.stableIdentity.hostIdentityHash,
        receipt.publishedFence.manifest.stableIdentity.hostIdentityHash,
        receipt.publishedFence.attestation.stableIdentity.hostIdentityHash,
      ]);
      assert.equal(hostHashes.size, 1);
      const devices = new Set([
        receipt.publishedFence.storeRoot.stableIdentity.device,
        receipt.publishedFence.locksRoot.stableIdentity.device,
        receipt.publishedFence.stagingRoot.stableIdentity.device,
        receipt.publishedFence.attestationsRoot.stableIdentity.device,
        receipt.publishedFence.releasesRoot.stableIdentity.device,
        receipt.publishedFence.releaseRoot.stableIdentity.device,
        receipt.publishedFence.manifest.stableIdentity.device,
        receipt.publishedFence.attestation.stableIdentity.device,
      ]);
      assert.equal(devices.size, 1);
      const physicalKeys = new Set([
        receipt.publishedFence.storeRoot,
        receipt.publishedFence.locksRoot,
        receipt.publishedFence.stagingRoot,
        receipt.publishedFence.attestationsRoot,
        receipt.publishedFence.releasesRoot,
        receipt.publishedFence.releaseRoot,
        receipt.publishedFence.manifest,
        receipt.publishedFence.attestation,
      ].map((observation) => `${observation.stableIdentity.objectKind}:${observation.stableIdentity.device}:${observation.stableIdentity.inode}`));
      assert.equal(physicalKeys.size, 8);
      assert.equal(receipt.publishedFence.storeRoot.mutableFingerprint.mode, "0700");
      assert.equal(receipt.publishedFence.locksRoot.mutableFingerprint.mode, "0700");
      assert.equal(
        receipt.publishedFence.locksRoot.mutableFingerprint.contentHash,
        hashCanonicalJson({
          schema: "setfarm.platform-release-content-store-test-directory-membership-hash.v2",
          relativePath: ".locks",
          entries: [],
        }),
      );
      assert.equal(receipt.publishedFence.stagingRoot.mutableFingerprint.mode, "0700");
      assert.equal(receipt.publishedFence.attestationsRoot.mutableFingerprint.mode, "0700");
      assert.equal(receipt.publishedFence.releasesRoot.mutableFingerprint.mode, "0700");
      assert.equal(receipt.publishedFence.releaseRoot.mutableFingerprint.mode, "0555");
      assert.equal(receipt.publishedFence.manifest.mutableFingerprint.mode, "0444");
      assert.equal(receipt.publishedFence.attestation.mutableFingerprint.mode, "0444");
      assert.equal(receipt.publishedFence.manifest.mutableFingerprint.linkCount, 1);
      assert.equal(receipt.publishedFence.attestation.mutableFingerprint.linkCount, 1);
      assert.equal(canonicalPathFreeJson(receipt), true);
      assert.equal(PlatformReleaseContentStoreTestV2Schema.safeParse(receipt).success, true);
      const parsed = parsePlatformReleaseContentStoreTestCandidateV2(structuredClone(receipt));
      assert.equal(Object.isFrozen(parsed), true);
      assert.equal(Object.isFrozen(parsed.publishedFence), true);
      assert.equal(hashPlatformReleaseContentStoreTestV2(receipt), receipt.storeHash);
      assert.equal(reproducePlatformReleaseContentStoreTestForTestV2(receipt).storeHash, receipt.storeHash);

      const adoptionStage = buildPlatformReleaseContentStoreTestStageForTestV2(candidate);
      const adopted = publishPlatformReleaseContentStoreTestForTestV2(
        fixture,
        adoptionStage,
        { challenge: Buffer.alloc(32, 0x82) },
      );
      assert.equal(adopted.publication, "adopted_identical");
      assert.equal(adopted.manifestPayloadHash, receipt.manifestPayloadHash);
      assert.equal(adopted.attestationHash, receipt.attestationHash);
      const { locksRoot: firstLocksRoot, ...firstPersistentFence } = receipt.publishedFence;
      const { locksRoot: adoptedLocksRoot, ...adoptedPersistentFence } = adopted.publishedFence;
      assert.deepEqual(adoptedPersistentFence, firstPersistentFence);
      assert.deepEqual(adoptedLocksRoot.stableIdentity, firstLocksRoot.stableIdentity);
      assert.equal(
        adoptedLocksRoot.mutableFingerprint.contentHash,
        firstLocksRoot.mutableFingerprint.contentHash,
      );
      assert.equal(
        adoptedLocksRoot.mutableFingerprint.mode,
        firstLocksRoot.mutableFingerprint.mode,
      );
      assert.equal(reproducePlatformReleaseContentStoreTestForTestV2(adopted).storeHash, adopted.storeHash);

      const forged = structuredClone(receipt) as Record<string, unknown>;
      forged.productionAuthority = true;
      assert.equal(PlatformReleaseContentStoreTestV2Schema.safeParse(forged).success, false);
      const rehashedFresh = structuredClone(receipt) as Record<string, any>;
      rehashedFresh.freshReproduction.reproductionHash = "0".repeat(64);
      assert.equal(PlatformReleaseContentStoreTestV2Schema.safeParse(rehashedFresh).success, false);
      expectStoreError(
        () => reproducePlatformReleaseContentStoreTestForTestV2(structuredClone(receipt) as never),
        "CONTENT_STORE_RECEIPT_UNAUTHENTICATED",
      );
      expectStoreError(
        () => publishPlatformReleaseContentStoreTestForTestV2(
          new Proxy(fixture, {}),
          buildPlatformReleaseContentStoreTestStageForTestV2(candidate),
        ),
        "CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED",
      );
    } finally {
      fixture.dispose();
    }
  });

  for (const mutation of [
    "replace_manifest_same_bytes",
    "replace_manifest_different_bytes",
    "replace_attestation_same_bytes",
    "replace_locks_root_same_layout",
    "replace_staging_root_same_layout",
    "add_release_extra_file",
    "add_staging_extra_file",
    "add_attestations_extra_file",
    "add_releases_extra_directory",
    "remove_attestation",
    "remove_release_and_attestation",
  ] as const) {
    it(`rejects ${mutation} during fresh reproduction`, () => {
      const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
      try {
        const stage = buildPlatformReleaseContentStoreTestStageForTestV2(
          createPlatformReleaseCandidateEnvelopeFixtureV2(),
        );
        const receipt = publishPlatformReleaseContentStoreTestForTestV2(fixture, stage, {
          challenge: Buffer.alloc(32, 0x91),
        });
        mutatePlatformReleaseContentStoreTestFixtureForTestV2(receipt, mutation);
        expectStoreError(
          () => reproducePlatformReleaseContentStoreTestForTestV2(receipt),
          "CONTENT_STORE_REPRODUCTION_INVALID",
        );
      } finally {
        fixture.dispose();
      }
    });
  }

  it("does not republish after both committed objects disappear", () => {
    const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
    const candidate = createPlatformReleaseCandidateEnvelopeFixtureV2();
    try {
      const receipt = publishPlatformReleaseContentStoreTestForTestV2(
        fixture,
        buildPlatformReleaseContentStoreTestStageForTestV2(candidate),
        { challenge: Buffer.alloc(32, 0x9b) },
      );
      mutatePlatformReleaseContentStoreTestFixtureForTestV2(
        receipt,
        "remove_release_and_attestation",
      );
      const retryStage = buildPlatformReleaseContentStoreTestStageForTestV2(candidate);
      expectStoreError(
        () => publishPlatformReleaseContentStoreTestForTestV2(fixture, retryStage, {
          challenge: Buffer.alloc(32, 0x9c),
        }),
        "CONTENT_STORE_FILESYSTEM_DRIFT",
      );
      retryStage.dispose();
    } finally {
      fixture.dispose();
    }
  });

  it("rejects different replacement bytes without consuming the retry stage", () => {
    const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
    const candidate = createPlatformReleaseCandidateEnvelopeFixtureV2();
    try {
      const receipt = publishPlatformReleaseContentStoreTestForTestV2(
        fixture,
        buildPlatformReleaseContentStoreTestStageForTestV2(candidate),
        { challenge: Buffer.alloc(32, 0x9d) },
      );
      mutatePlatformReleaseContentStoreTestFixtureForTestV2(
        receipt,
        "replace_manifest_different_bytes",
      );
      const retryStage = buildPlatformReleaseContentStoreTestStageForTestV2(candidate);
      expectStoreError(
        () => publishPlatformReleaseContentStoreTestForTestV2(fixture, retryStage, {
          challenge: Buffer.alloc(32, 0x9e),
        }),
        "CONTENT_STORE_PUBLICATION_INVALID",
      );
      retryStage.dispose();
    } finally {
      fixture.dispose();
    }
  });

  for (const mutation of [
    "replace_locks_root_with_external_symlink",
    "replace_staging_root_with_external_symlink",
    "replace_attestations_root_with_external_symlink",
    "replace_releases_root_with_external_symlink",
  ] as const) {
    it(`rejects ${mutation} before any escaped publication side effect`, () => {
      const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
      const stage = buildPlatformReleaseContentStoreTestStageForTestV2(
        createPlatformReleaseCandidateEnvelopeFixtureV2(),
      );
      try {
        mutatePlatformReleaseContentStoreTestFixtureBeforePublicationForTestV2(
          fixture,
          mutation,
        );
        expectStoreError(
          () => publishPlatformReleaseContentStoreTestForTestV2(fixture, stage, {
            challenge: Buffer.alloc(32, 0x99),
          }),
          "CONTENT_STORE_FILESYSTEM_DRIFT",
        );
        const observation =
          inspectPlatformReleaseContentStorePrePublicationMutationForTestV2(fixture);
        assert.equal(observation.mutation, mutation);
        assert.equal(observation.externalEntryCount, 0);
        assert.equal(
          observation.externalEntryNamesHash,
          hashCanonicalJson({
            schema: "setfarm.platform-release-content-store-test-external-entry-names.v2",
            entries: [],
          }),
        );
        assert.equal(observation.externalObservationUnchanged, true);
        stage.dispose();
      } finally {
        fixture.dispose();
      }
    });
  }

  for (const mutation of [
    "replace_manifest_same_bytes",
    "replace_attestation_same_bytes",
  ] as const) {
    it(`does not launder ${mutation} through a fresh identical content receipt`, () => {
      const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
      const candidate = createPlatformReleaseCandidateEnvelopeFixtureV2();
      try {
        const receipt = publishPlatformReleaseContentStoreTestForTestV2(
          fixture,
          buildPlatformReleaseContentStoreTestStageForTestV2(candidate),
          { challenge: Buffer.alloc(32, 0x9d) },
        );
        mutatePlatformReleaseContentStoreTestFixtureForTestV2(receipt, mutation);
        expectStoreError(
          () => reproducePlatformReleaseContentStoreTestForTestV2(receipt),
          "CONTENT_STORE_REPRODUCTION_INVALID",
        );
        const retryStage = buildPlatformReleaseContentStoreTestStageForTestV2(candidate);
        expectStoreError(
          () => publishPlatformReleaseContentStoreTestForTestV2(fixture, retryStage, {
            challenge: Buffer.alloc(32, 0x9e),
          }),
          "CONTENT_STORE_FILESYSTEM_DRIFT",
        );
        retryStage.dispose();
      } finally {
        fixture.dispose();
      }
    });
  }

  for (const mutation of [
    "replace_locks_root_same_layout",
    "replace_staging_root_same_layout",
  ] as const) {
    it(`does not launder ${mutation} through a fresh identical adoption`, () => {
      const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
      const candidate = createPlatformReleaseCandidateEnvelopeFixtureV2();
      try {
        const receipt = publishPlatformReleaseContentStoreTestForTestV2(
          fixture,
          buildPlatformReleaseContentStoreTestStageForTestV2(candidate),
          { challenge: Buffer.alloc(32, 0x9a) },
        );
        mutatePlatformReleaseContentStoreTestFixtureForTestV2(receipt, mutation);
        expectStoreError(
          () => reproducePlatformReleaseContentStoreTestForTestV2(receipt),
          "CONTENT_STORE_REPRODUCTION_INVALID",
        );
        const retryStage = buildPlatformReleaseContentStoreTestStageForTestV2(candidate);
        expectStoreError(
          () => publishPlatformReleaseContentStoreTestForTestV2(fixture, retryStage, {
            challenge: Buffer.alloc(32, 0x9b),
          }),
          "CONTENT_STORE_FILESYSTEM_DRIFT",
        );
        retryStage.dispose();
      } finally {
        fixture.dispose();
      }
    });
  }

  it("reports staging cleanup drift terminally instead of publishing success", () => {
    const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
    const stage = buildPlatformReleaseContentStoreTestStageForTestV2(
      createPlatformReleaseCandidateEnvelopeFixtureV2(),
    );
    try {
      expectStoreError(
        () => publishPlatformReleaseContentStoreTestForTestV2(fixture, stage, {
          challenge: Buffer.alloc(32, 0x9c),
          fault: { checkpoint: "replace_staging_root_before_cleanup" },
        }),
        "CONTENT_STORE_CLEANUP_FAILED",
      );
      stage.dispose();
    } finally {
      fixture.dispose();
    }
  });

  it("cleans an owned stage after failure immediately following allocation", () => {
    const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
    const stage = buildPlatformReleaseContentStoreTestStageForTestV2(
      createPlatformReleaseCandidateEnvelopeFixtureV2(),
    );
    try {
      expectStoreError(
        () => publishPlatformReleaseContentStoreTestForTestV2(fixture, stage, {
          challenge: Buffer.alloc(32, 0x9f),
          fault: { checkpoint: "fail_after_staging_allocation" },
        }),
        "CONTENT_STORE_PUBLICATION_INVALID",
      );
      const receipt = publishPlatformReleaseContentStoreTestForTestV2(fixture, stage, {
        challenge: Buffer.alloc(32, 0xa0),
      });
      assert.equal(receipt.publication, "published");
      assert.equal(
        receipt.publishedFence.stagingRoot.mutableFingerprint.contentHash,
        hashCanonicalJson({
          schema: "setfarm.platform-release-content-store-test-directory-membership-hash.v2",
          relativePath: ".staging",
          entries: [],
        }),
      );
    } finally {
      fixture.dispose();
    }
  });

  it("keeps the stage retry owner when lock release rejects a replacement", () => {
    const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
    const stage = buildPlatformReleaseContentStoreTestStageForTestV2(
      createPlatformReleaseCandidateEnvelopeFixtureV2(),
    );
    try {
      expectStoreError(
        () => publishPlatformReleaseContentStoreTestForTestV2(fixture, stage, {
          challenge: Buffer.alloc(32, 0x9f),
          fault: { checkpoint: "replace_lock_before_release" },
        }),
        "CONTENT_STORE_FILESYSTEM_DRIFT",
      );
      stage.dispose();
    } finally {
      fixture.dispose();
    }
  });

  it("preserves the first cleanup cause when lock release also fails", () => {
    const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
    const stage = buildPlatformReleaseContentStoreTestStageForTestV2(
      createPlatformReleaseCandidateEnvelopeFixtureV2(),
    );
    try {
      assert.throws(
        () => publishPlatformReleaseContentStoreTestForTestV2(fixture, stage, {
          challenge: Buffer.alloc(32, 0xa0),
          fault: {
            checkpoint: "replace_staging_root_before_cleanup_and_lock_before_release",
          },
        }),
        (error: unknown) => {
          assert.equal(error instanceof PlatformReleaseContentStoreTestErrorV2, true);
          const typed = error as PlatformReleaseContentStoreTestErrorV2;
          assert.equal(typed.code, "CONTENT_STORE_CLEANUP_FAILED");
          assert.equal(typed.cause instanceof AggregateError, true);
          assert.equal((typed.cause as AggregateError).errors.length, 2);
          return true;
        },
      );
      stage.dispose();
    } finally {
      fixture.dispose();
    }
  });

  it("preserves primary, staging-cleanup, and lock-cleanup failures in order", () => {
    const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
    const stage = buildPlatformReleaseContentStoreTestStageForTestV2(
      createPlatformReleaseCandidateEnvelopeFixtureV2(),
    );
    try {
      assert.throws(
        () => publishPlatformReleaseContentStoreTestForTestV2(fixture, stage, {
          challenge: Buffer.alloc(32, 0xa1),
          fault: {
            checkpoint:
              "fail_publication_and_replace_staging_before_cleanup_and_lock_before_release",
          },
        }),
        (error: unknown) => {
          assert.equal(error instanceof PlatformReleaseContentStoreTestErrorV2, true);
          const typed = error as PlatformReleaseContentStoreTestErrorV2;
          assert.equal(typed.code, "CONTENT_STORE_PUBLICATION_INVALID");
          assert.equal(typed.cause instanceof AggregateError, true);
          const outerErrors = (typed.cause as AggregateError).errors;
          assert.equal(outerErrors.length, 2);
          assert.equal(
            outerErrors[0] instanceof PlatformReleaseContentStoreTestErrorV2,
            true,
          );
          const nestedCause = (
            outerErrors[0] as PlatformReleaseContentStoreTestErrorV2
          ).cause;
          assert.equal(
            nestedCause instanceof AggregateError,
            true,
          );
          assert.equal(
            (nestedCause as AggregateError).errors.length,
            2,
          );
          return true;
        },
      );
      stage.dispose();
    } finally {
      fixture.dispose();
    }
  });

  it("retains retryable fixture cleanup ownership after a disposal failure", () => {
    const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
    armPlatformReleaseContentStoreTestDisposeFailureForTestV2(fixture);
    expectStoreError(() => fixture.dispose(), "CONTENT_STORE_DISPOSE_INVALID");
    fixture.dispose();
    expectStoreError(() => fixture.dispose(), "CONTENT_STORE_DISPOSE_INVALID");
  });

  it("resumes fixture cleanup after an injected failure following external cleanup", () => {
    const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
    mutatePlatformReleaseContentStoreTestFixtureBeforePublicationForTestV2(
      fixture,
      "replace_staging_root_with_external_symlink",
    );
    armPlatformReleaseContentStoreTestDisposeFailureForTestV2(
      fixture,
      "after_external_cleanup",
    );
    expectStoreError(() => fixture.dispose(), "CONTENT_STORE_DISPOSE_INVALID");
    assert.deepEqual(
      inspectPlatformReleaseContentStoreTestFixtureLifecycleForTestV2(fixture),
      {
        lifecycle: "cleanup_failed",
        fixtureRootRetained: true,
        externalMutationOwned: false,
      },
    );
    fixture.dispose();
    expectStoreError(() => fixture.dispose(), "CONTENT_STORE_DISPOSE_INVALID");
  });

  it("preserves an unexpected external sentinel entry instead of recursively deleting it", () => {
    const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
    mutatePlatformReleaseContentStoreTestFixtureBeforePublicationForTestV2(
      fixture,
      "replace_releases_root_with_external_symlink",
    );
    mutatePlatformReleaseContentStoreExternalSentinelForTestV2(
      fixture,
      "add_unexpected_entry",
    );
    expectStoreError(() => fixture.dispose(), "CONTENT_STORE_DISPOSE_INVALID");
    assert.deepEqual(
      inspectPlatformReleaseContentStoreTestFixtureLifecycleForTestV2(fixture),
      {
        lifecycle: "cleanup_failed",
        fixtureRootRetained: true,
        externalMutationOwned: true,
      },
    );
    mutatePlatformReleaseContentStoreExternalSentinelForTestV2(
      fixture,
      "recover_unexpected_entry",
    );
    fixture.dispose();
    expectStoreError(() => fixture.dispose(), "CONTENT_STORE_DISPOSE_INVALID");
  });

  for (const [mutation, kind] of [
    ["replace_descendant_with_foreign_tree", "descendant"],
    ["replace_root_with_foreign_tree", "root"],
  ] as const) {
    it(`preserves a same-UID ${kind} replacement instead of deleting its foreign tree`, () => {
      const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
      let replacementActive = false;
      let disposed = false;
      try {
        mutatePlatformReleaseContentStoreCleanupReplacementForTestV2(
          fixture,
          mutation,
        );
        replacementActive = true;
        expectStoreError(() => fixture.dispose(), "CONTENT_STORE_DISPOSE_INVALID");
        assert.deepEqual(
          inspectPlatformReleaseContentStoreCleanupReplacementForTestV2(fixture),
          {
            kind,
            foreignRootIdentityPreserved: true,
            foreignCanaryPreserved: true,
            ownedFixtureRootPreserved: true,
          },
        );
        recoverPlatformReleaseContentStoreCleanupReplacementForTestV2(fixture);
        replacementActive = false;
        fixture.dispose();
        disposed = true;
        expectStoreError(() => fixture.dispose(), "CONTENT_STORE_DISPOSE_INVALID");
      } finally {
        if (replacementActive) {
          recoverPlatformReleaseContentStoreCleanupReplacementForTestV2(fixture);
        }
        if (!disposed) fixture.dispose();
      }
    });
  }

  it("refuses to repair a partial release/attestation pair", () => {
    const fixture = buildPlatformReleaseContentStoreTestFixtureForTestV2();
    try {
      const candidate = createPlatformReleaseCandidateEnvelopeFixtureV2();
      const firstStage = buildPlatformReleaseContentStoreTestStageForTestV2(candidate);
      const receipt = publishPlatformReleaseContentStoreTestForTestV2(fixture, firstStage, {
        challenge: Buffer.alloc(32, 0xa1),
      });
      mutatePlatformReleaseContentStoreTestFixtureForTestV2(receipt, "remove_attestation");
      const retryStage = buildPlatformReleaseContentStoreTestStageForTestV2(candidate);
      expectStoreError(
        () => publishPlatformReleaseContentStoreTestForTestV2(fixture, retryStage, {
          challenge: Buffer.alloc(32, 0xa2),
        }),
        "CONTENT_STORE_PUBLICATION_INVALID",
      );
      retryStage.dispose();
    } finally {
      fixture.dispose();
    }
  });
});

function canonicalPathFreeJson(value: unknown): boolean {
  const json = JSON.stringify(value);
  return !json.includes("/setfarm-platform-release-content-store-test-v2-")
    && !json.includes("/var/folders/")
    && !json.includes("\\AppData\\Local\\Temp\\");
}
