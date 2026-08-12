import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { PlatformReleaseBootstrapRegistryActivationNextActionV2Schema } from "../../src/product-compiler/platform-release-bootstrap-registry-activation-v2.js";
import { PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2 } from "../../src/product-compiler/platform-release-bootstrap-filesystem-capture-core-v2.js";
import { PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2 } from "../../src/product-compiler/platform-release-bootstrap-registry-physical-activation-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_NODE_FIXTURE_CONTRACT_V2,
  getPlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2,
  hashPlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2,
  parsePlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractCandidateV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-physical-activation-node-fixture-contract-v2.js";

describe("platform release bootstrap registry physical activation Node fixture contract v2", () => {
  it("publishes one exact non-promotable partial cooperative coverage catalog", () => {
    const contract =
      getPlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2();
    assert.deepEqual(
      contract,
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_NODE_FIXTURE_CONTRACT_V2,
    );
    assert.notEqual(
      contract,
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_NODE_FIXTURE_CONTRACT_V2,
    );
    assert.equal(Object.isFrozen(contract), true);
    assert.equal(contract.productionAuthority, false);
    assert.equal(contract.fullSessionDriverAvailable, false);
    assert.equal(
      contract.mechanicsCapability,
      PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2,
    );
    assert.deepEqual(
      new Set(contract.actionCoverage.map((entry) => entry.nextAction)),
      new Set(
        PlatformReleaseBootstrapRegistryActivationNextActionV2Schema.options,
      ),
    );
    assert.deepEqual(
      contract.actionCoverage.map((entry) => ({
        nextAction: entry.nextAction,
        methodRef: entry.methodRef,
      })),
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.actionProtocols.map(
        (entry) => ({
          nextAction: entry.nextAction,
          methodRef: entry.methodRef,
        }),
      ),
    );
    assert.deepEqual(
      contract.actionCoverage
        .filter((entry) => entry.coverage === "exact_cooperative_mutation")
        .map((entry) => entry.nextAction),
      ["publish_genesis_epoch_floor", "publish_activation_receipt"],
    );
    assert.deepEqual(
      contract.actionCoverage
        .filter((entry) => entry.coverage === "terminal_mechanics_only")
        .map((entry) => entry.nextAction),
      ["return_activated", "no_mutation"],
    );
    assert.equal(
      contract.contractHash,
      hashPlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2(
        contract,
      ),
    );
    assert.deepEqual(
      parsePlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractCandidateV2(
        structuredClone(contract),
      ),
      contract,
    );
  });

  it("rejects rehashed promotion or completeness claims and stays outside production imports", async () => {
    const promoted = structuredClone(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_NODE_FIXTURE_CONTRACT_V2,
    ) as unknown as {
      productionAuthority: boolean;
      fullSessionDriverAvailable: boolean;
      contractHash: string;
    };
    promoted.productionAuthority = true;
    promoted.fullSessionDriverAvailable = true;
    promoted.contractHash =
      hashPlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2(
        promoted as unknown as Record<string, unknown>,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractCandidateV2(
        promoted,
      ),
    );

    const coverageTampered = structuredClone(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_NODE_FIXTURE_CONTRACT_V2,
    ) as unknown as {
      actionCoverage: Array<{
        coverage: string;
        fullSessionDriverEligible: boolean;
      }>;
      exactCooperativeMutationCount: number;
      partialOrUnsupportedMutationCount: number;
      contractHash: string;
    };
    coverageTampered.actionCoverage[0]!.coverage = "exact_cooperative_mutation";
    coverageTampered.actionCoverage[0]!.fullSessionDriverEligible = true;
    coverageTampered.exactCooperativeMutationCount = 3;
    coverageTampered.partialOrUnsupportedMutationCount = 7;
    coverageTampered.contractHash =
      hashPlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2(
        coverageTampered as unknown as Record<string, unknown>,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractCandidateV2(
        coverageTampered,
      ),
    );

    const [productionSource, mechanicsCoreSource] = await Promise.all([
      readFile(
        new URL(
          "../../src/product-compiler/platform-release-bootstrap-registry-activation-v2.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../src/product-compiler/platform-release-bootstrap-registry-physical-activation-core-v2.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);
    const fixtureContractImport =
      /platform-release-bootstrap-registry-physical-activation-node-fixture-contract-v2/;
    assert.doesNotMatch(productionSource, fixtureContractImport);
    assert.doesNotMatch(mechanicsCoreSource, fixtureContractImport);
  });
});
