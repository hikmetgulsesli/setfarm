import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2 } from "../../src/execution/schemas/platform-release-bootstrap-darwin-filesystem-backend-v2.js";
import { PlatformReleaseBootstrapRegistryActivationNextActionV2Schema } from "../../src/product-compiler/platform-release-bootstrap-registry-activation-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2,
  getPlatformReleaseBootstrapRegistryPhysicalActivationContractV2,
  hashPlatformReleaseBootstrapRegistryPhysicalActivationContractV2,
  parsePlatformReleaseBootstrapRegistryPhysicalActivationContractCandidateV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-physical-activation-contract-v2.js";
import { PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_ACTION_METHOD_REFS_V2 } from "../../src/product-compiler/platform-release-bootstrap-registry-physical-activation-types-v2.js";

describe("platform release bootstrap registry physical activation contract v2", () => {
  it("maps every reducer action once and reserves a bounded fresh native session", () => {
    const contract =
      getPlatformReleaseBootstrapRegistryPhysicalActivationContractV2();
    assert.deepEqual(
      contract,
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2,
    );
    assert.notEqual(
      contract,
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2,
    );
    assert.equal(Object.isFrozen(contract), true);
    assert.deepEqual(
      new Set(contract.actionProtocols.map((entry) => entry.nextAction)),
      new Set(
        PlatformReleaseBootstrapRegistryActivationNextActionV2Schema.options,
      ),
    );
    assert.deepEqual(
      contract.actionProtocols.map((entry) => entry.methodRef),
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_ACTION_METHOD_REFS_V2,
    );
    assert.equal(
      contract.backendAbiHash,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
    );
    assert.equal(
      contract.wireContractCatalogHash,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.wireContractCatalogHash,
    );
    assert.ok(
      contract.backendMaxOperationsPerSession >=
        contract.maxNamespaceEntries + contract.reservedSessionOperations,
    );
    assert.equal(
      contract.contractHash,
      hashPlatformReleaseBootstrapRegistryPhysicalActivationContractV2(
        contract,
      ),
    );
    assert.deepEqual(
      parsePlatformReleaseBootstrapRegistryPhysicalActivationContractCandidateV2(
        structuredClone(contract),
      ),
      contract,
    );
  });

  it("rejects rehashed policy/action drift and hostile candidates", () => {
    const mutated = structuredClone(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2,
    ) as unknown as {
      actionProtocols: Array<{ methodRef: string }>;
      contractHash: string;
    };
    mutated.actionProtocols[0]!.methodRef = "weakenedCleanup";
    mutated.contractHash =
      hashPlatformReleaseBootstrapRegistryPhysicalActivationContractV2(
        mutated as unknown as Record<string, unknown>,
      );
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryPhysicalActivationContractCandidateV2(
        mutated,
      ),
    );

    let accessorReads = 0;
    const accessor = Object.defineProperty({}, "schema", {
      enumerable: true,
      get: () => {
        accessorReads += 1;
        return "unreachable";
      },
    });
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryPhysicalActivationContractCandidateV2(
        accessor,
      ),
    );
    assert.equal(accessorReads, 0);

    let proxyReads = 0;
    const proxy = new Proxy(
      {},
      {
        get: () => {
          proxyReads += 1;
          return undefined;
        },
      },
    );
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryPhysicalActivationContractCandidateV2(
        proxy,
      ),
    );
    assert.equal(proxyReads, 0);
  });
});
