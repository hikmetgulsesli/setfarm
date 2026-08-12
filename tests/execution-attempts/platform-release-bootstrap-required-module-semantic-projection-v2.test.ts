import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPlatformReleaseBootstrapRequiredModuleSemanticProjectionFixtureForTestV2,
  observePlatformReleaseBootstrapRequiredModuleSemanticProjectionForTestV2,
  PlatformReleaseBootstrapRequiredModuleSemanticProjectionErrorV2,
} from "../../src/product-compiler/platform-release-bootstrap-required-module-semantic-projection-test-support-v2.js";
import {
  PlatformReleaseRequiredModuleSemanticProjectionV2Schema,
  hashPlatformReleaseRequiredModuleSemanticProjectionCatalogV2,
  hashPlatformReleaseRequiredModuleSemanticProjectionEntryV2,
  hashPlatformReleaseRequiredModuleSemanticProjectionEvidenceV2,
  hashPlatformReleaseRequiredModuleSemanticProjectionObservationV2,
  hashPlatformReleaseRequiredModuleSemanticProjectionV2,
  parsePlatformReleaseRequiredModuleSemanticProjectionCandidateV2,
} from "../../src/execution/schemas/platform-release-bootstrap-required-module-semantic-projection-v2.js";
import {
  getPlatformReleaseRequiredModuleRequirementV2,
} from "../../src/execution/schemas/platform-release-required-module-closure-v2.js";

describe("Darwin required-module source semantic projection v2", () => {
  it("projects exact code-owned bootstrap, catalog, and export semantics without authority", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture = buildPlatformReleaseBootstrapRequiredModuleSemanticProjectionFixtureForTestV2();
    try {
      const projection = await observePlatformReleaseBootstrapRequiredModuleSemanticProjectionForTestV2(
        fixture,
        { challenge: Buffer.alloc(32, 0x71) },
      );
      const requirement = getPlatformReleaseRequiredModuleRequirementV2();

      assert.equal(projection.authorityState, "observed_test_fixture_unverified");
      assert.equal(projection.admissionScope, "test_fixture");
      assert.equal(projection.productionAuthority, false);
      assert.equal(projection.productionAdmission, "forbidden");
      assert.equal(projection.credentialUse, "none");
      assert.equal(projection.mutationAuthority, false);
      assert.equal(projection.trustConclusion, "characterization_only");
      assert.equal(projection.implementationScope, "test_fixture_source_semantics_projection_v2");
      assert.equal(projection.payloadBinding, "typescript_source_semantics_fixture_only_v2");
      assert.equal(projection.observationOutcome, "all_required_source_semantics_projected");
      assert.equal(projection.challengeHash, projection.requiredModuleClosureProbe.challengeHash);
      assert.equal(projection.semanticEntries.length, 17);
      assert.deepEqual(
        projection.semanticEntries.map((entry) => entry.role),
        requirement.entries.map((entry) => entry.role),
      );
      const sourcePhysicalKeys = new Set<string>();

      for (const [index, entry] of projection.semanticEntries.entries()) {
        const definition = requirement.entries[index]!;
        const physical = projection.requiredModuleClosureProbe.entries[index]!;
        assert.equal(entry.sourceModuleLocator, definition.sourceModuleLocator);
        assert.equal(entry.moduleRefHash, physical.moduleRef.moduleRefHash);
        assert.equal(entry.sourceModuleHash, entry.sourceModuleHashBefore);
        assert.equal(entry.sourceModuleHash, entry.sourceModuleHashAfter);
        assert.deepEqual(entry.sourcePhysicalObservationBefore, entry.sourcePhysicalObservationAfter);
        assert.equal(
          entry.sourcePhysicalObservationBefore.mutableFingerprint.contentHash,
          entry.sourceModuleHash,
        );
        const sourceStable = entry.sourcePhysicalObservationBefore.stableIdentity;
        const sourcePhysicalKey = `${sourceStable.hostIdentityHash}:${sourceStable.objectKind}:${sourceStable.device}:${sourceStable.inode}`;
        assert.equal(sourcePhysicalKeys.has(sourcePhysicalKey), false);
        sourcePhysicalKeys.add(sourcePhysicalKey);
        assert.deepEqual(
          entry.sourceExports.filter((candidate) =>
            definition.requiredExports.some((required) => required.name === candidate.name)),
          definition.requiredExports,
        );
        assert.equal(
          entry.semanticEvidenceHash,
          hashPlatformReleaseRequiredModuleSemanticProjectionEvidenceV2(entry.semanticEvidence),
        );
        assert.equal(
          entry.entryHash,
          hashPlatformReleaseRequiredModuleSemanticProjectionEntryV2(entry),
        );

        switch (entry.semanticEvidence.kind) {
          case "bootstrap_source_hash_pair_v2":
            assert.equal(entry.semanticEvidence.sourceHash, entry.semanticEvidence.exportedSourceHash);
            assert.equal(entry.semanticEvidence.sourceHashMatches, true);
            break;
          case "manifest_catalog_projection_v2": {
            const catalog = entry.semanticEvidence.catalogProjection as {
              catalogHash?: string;
              policyHash?: string;
              schema: string;
            };
            assert.equal(entry.semanticEvidence.catalogSchema, catalog.schema);
            assert.equal(
              entry.semanticEvidence.catalogHash,
              catalog.catalogHash ?? catalog.policyHash,
            );
            assert.equal(entry.semanticEvidence.productionUse, "forbidden");
            break;
          }
          case "function_export_presence_v2":
            assert.deepEqual(entry.semanticEvidence.presentExports, definition.requiredExports);
            break;
          case "test_fixture_runtime_blocked_v2":
            assert.equal(entry.role, "runner_command");
            assert.equal(entry.semanticEvidence.blocker, "test_fixture_runtime_blocked");
            break;
        }
      }

      assert.equal(
        projection.semanticCatalogHash,
        hashPlatformReleaseRequiredModuleSemanticProjectionCatalogV2(projection.semanticEntries),
      );
      assert.equal(
        PlatformReleaseRequiredModuleSemanticProjectionV2Schema.safeParse(projection).success,
        true,
      );
      const parsed = parsePlatformReleaseRequiredModuleSemanticProjectionCandidateV2(
        structuredClone(projection),
      );
      assert.equal(parsed.probeHash, projection.probeHash);
      assert.equal(hashPlatformReleaseRequiredModuleSemanticProjectionV2(projection), projection.probeHash);
      assert.equal(Object.isFrozen(parsed), true);
      assert.equal(Object.isFrozen(parsed.semanticEntries), true);
    } finally {
      fixture.dispose();
    }
  });

  it("rejects authority, catalog, source-fence, and nested-hash forgery", {
    skip: process.platform !== "darwin",
  }, async () => {
    const fixture = buildPlatformReleaseBootstrapRequiredModuleSemanticProjectionFixtureForTestV2();
    try {
      await assert.rejects(
        observePlatformReleaseBootstrapRequiredModuleSemanticProjectionForTestV2(fixture, { challenge: Buffer.alloc(31) }),
        (error: unknown) => error instanceof PlatformReleaseBootstrapRequiredModuleSemanticProjectionErrorV2
          && error.code === "SEMANTIC_PROJECTION_OBSERVATION_INVALID",
      );

      const projection = await observePlatformReleaseBootstrapRequiredModuleSemanticProjectionForTestV2(
        fixture,
        { challenge: Buffer.alloc(32, 0x72) },
      );

      const forgedAuthority = structuredClone(projection) as Record<string, unknown>;
      forgedAuthority.productionAuthority = true;
      assert.equal(PlatformReleaseRequiredModuleSemanticProjectionV2Schema.safeParse(forgedAuthority).success, false);

      const forgedCatalog = structuredClone(projection) as any;
      const catalogEntry = forgedCatalog.semanticEntries.find((entry: any) => entry.role === "catalog_profile");
      catalogEntry.semanticEvidence.catalogProjection.profiles[0].id = "profile_node_cli_v2";
      catalogEntry.semanticEvidence.catalogProjection.catalogHash = "f".repeat(64);
      catalogEntry.semanticEvidence.catalogHash = "f".repeat(64);
      catalogEntry.semanticEvidenceHash = hashPlatformReleaseRequiredModuleSemanticProjectionEvidenceV2(catalogEntry.semanticEvidence);
      catalogEntry.entryHash = hashPlatformReleaseRequiredModuleSemanticProjectionEntryV2(catalogEntry);
      forgedCatalog.semanticCatalogHash = hashPlatformReleaseRequiredModuleSemanticProjectionCatalogV2(forgedCatalog.semanticEntries);
      forgedCatalog.observationHash = hashPlatformReleaseRequiredModuleSemanticProjectionObservationV2(forgedCatalog);
      forgedCatalog.probeHash = hashPlatformReleaseRequiredModuleSemanticProjectionV2(forgedCatalog);
      assert.equal(PlatformReleaseRequiredModuleSemanticProjectionV2Schema.safeParse(forgedCatalog).success, false);

      const forgedFence = structuredClone(projection) as any;
      const fenceEntry = forgedFence.semanticEntries[0];
      fenceEntry.sourceModuleHashAfter = "e".repeat(64);
      fenceEntry.entryHash = hashPlatformReleaseRequiredModuleSemanticProjectionEntryV2(fenceEntry);
      forgedFence.semanticCatalogHash = hashPlatformReleaseRequiredModuleSemanticProjectionCatalogV2(forgedFence.semanticEntries);
      forgedFence.observationHash = hashPlatformReleaseRequiredModuleSemanticProjectionObservationV2(forgedFence);
      forgedFence.probeHash = hashPlatformReleaseRequiredModuleSemanticProjectionV2(forgedFence);
      assert.equal(PlatformReleaseRequiredModuleSemanticProjectionV2Schema.safeParse(forgedFence).success, false);

      const forgedSelfRehashedFence = structuredClone(projection) as any;
      const selfRehashedEntry = forgedSelfRehashedFence.semanticEntries[0];
      selfRehashedEntry.sourceModuleHash = "c".repeat(64);
      selfRehashedEntry.sourceModuleHashBefore = "c".repeat(64);
      selfRehashedEntry.sourceModuleHashAfter = "c".repeat(64);
      selfRehashedEntry.entryHash = hashPlatformReleaseRequiredModuleSemanticProjectionEntryV2(selfRehashedEntry);
      forgedSelfRehashedFence.semanticCatalogHash = hashPlatformReleaseRequiredModuleSemanticProjectionCatalogV2(forgedSelfRehashedFence.semanticEntries);
      forgedSelfRehashedFence.observationHash = hashPlatformReleaseRequiredModuleSemanticProjectionObservationV2(forgedSelfRehashedFence);
      forgedSelfRehashedFence.probeHash = hashPlatformReleaseRequiredModuleSemanticProjectionV2(forgedSelfRehashedFence);
      assert.equal(PlatformReleaseRequiredModuleSemanticProjectionV2Schema.safeParse(forgedSelfRehashedFence).success, false);

      const forgedEvidence = structuredClone(projection) as any;
      const evidenceEntry = forgedEvidence.semanticEntries[0];
      evidenceEntry.semanticEvidence.sourceHash = "d".repeat(64);
      evidenceEntry.semanticEvidenceHash = hashPlatformReleaseRequiredModuleSemanticProjectionEvidenceV2(evidenceEntry.semanticEvidence);
      evidenceEntry.entryHash = hashPlatformReleaseRequiredModuleSemanticProjectionEntryV2(evidenceEntry);
      forgedEvidence.semanticCatalogHash = hashPlatformReleaseRequiredModuleSemanticProjectionCatalogV2(forgedEvidence.semanticEntries);
      forgedEvidence.observationHash = hashPlatformReleaseRequiredModuleSemanticProjectionObservationV2(forgedEvidence);
      forgedEvidence.probeHash = hashPlatformReleaseRequiredModuleSemanticProjectionV2(forgedEvidence);
      assert.equal(PlatformReleaseRequiredModuleSemanticProjectionV2Schema.safeParse(forgedEvidence).success, false);
    } finally {
      fixture.dispose();
    }
  });
});
