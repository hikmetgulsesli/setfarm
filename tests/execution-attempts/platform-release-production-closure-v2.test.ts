import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_PRODUCTION_CLOSURE_MAX_CANONICAL_BYTES_V2,
  PLATFORM_RELEASE_PRODUCTION_CLOSURE_V2_SCHEMA,
  PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_HASH_V2,
  PlatformReleaseProductionClosureV2Schema,
  createPlatformReleaseProductionClosureV2,
  hashPlatformReleaseProductionClosureV2,
  hashPlatformReleaseProductionEdgeMembershipV2,
  hashPlatformReleaseProductionPackageMembershipV2,
  hashPlatformReleaseProductionRootMembershipV2,
  type PlatformReleaseProductionClosureHashPayloadV2,
} from
  "../../src/execution/schemas/platform-release-production-closure-v2.js";

function closureInputV2():
  PlatformReleaseProductionClosureHashPayloadV2 {
  const installedPackages = [
    {
      packagePath: "node_modules/runtime",
      packageName: "runtime",
      version: "1.2.3",
      lockEntryHash: "1".repeat(64),
    },
  ];
  const edges = [
    {
      ownerPackagePath: "",
      kind: "required" as const,
      dependencyName: "runtime",
      declaredSpec: "^1.0.0",
      resolvedPackagePath: "node_modules/runtime",
    },
  ];
  const rootDependencyLocators = [
    "node_modules/runtime",
  ];
  return {
    schema:
      PLATFORM_RELEASE_PRODUCTION_CLOSURE_V2_SCHEMA,
    version: "2.0.0",
    contractHash:
      PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_HASH_V2,
    lockAuthorityHash: "2".repeat(64),
    hostPlatform: "darwin",
    hostArchitecture: "arm64",
    rootDependencyCount:
      rootDependencyLocators.length,
    rootDependencyLocators,
    installedPackageCount: installedPackages.length,
    installedPackages,
    edgeCount: edges.length,
    edges,
    rootMembershipHash:
      hashPlatformReleaseProductionRootMembershipV2(
        rootDependencyLocators,
      ),
    installedPackageMembershipHash:
      hashPlatformReleaseProductionPackageMembershipV2(
        installedPackages,
      ),
    edgeMembershipHash:
      hashPlatformReleaseProductionEdgeMembershipV2(
        edges,
      ),
  };
}

function rehashClosureV2(
  candidate: Record<string, unknown>,
): void {
  candidate.closureHash =
    hashPlatformReleaseProductionClosureV2(
      candidate as
        PlatformReleaseProductionClosureHashPayloadV2,
    );
}

describe("PlatformReleaseProductionClosureV2", () => {
  it("creates one strict recursively frozen and self-hashed closure", () => {
    const closure =
      createPlatformReleaseProductionClosureV2(
        closureInputV2(),
      );
    assert.equal(
      PlatformReleaseProductionClosureV2Schema
        .parse(closure).closureHash,
      closure.closureHash,
    );
    assert.equal(Object.isFrozen(closure), true);
    assert.equal(
      Object.isFrozen(closure.installedPackages),
      true,
    );
    assert.equal(
      Object.isFrozen(closure.installedPackages[0]),
      true,
    );
    assert.equal(Object.isFrozen(closure.edges), true);
    assert.equal(
      closure.rootDependencyCount,
      closure.rootDependencyLocators.length,
    );
    assert.equal(
      closure.installedPackageCount,
      closure.installedPackages.length,
    );
    assert.equal(closure.edgeCount, closure.edges.length);
    assert.throws(() =>
      PlatformReleaseProductionClosureV2Schema.parse({
        ...closure,
        callerClaim: true,
      }));
  });

  it("rejects rehashed unsupported specs, incompatible versions and unreachable packages", () => {
    const closure =
      createPlatformReleaseProductionClosureV2(
        closureInputV2(),
      );
    const unsupported = structuredClone(
      closure,
    ) as unknown as Record<string, unknown>;
    (
      unsupported.edges as Array<Record<string, unknown>>
    )[0]!.declaredSpec = "latest";
    unsupported.edgeMembershipHash =
      hashPlatformReleaseProductionEdgeMembershipV2(
        unsupported.edges as never,
      );
    rehashClosureV2(unsupported);
    assert.throws(() =>
      PlatformReleaseProductionClosureV2Schema.parse(
        unsupported,
      ));

    const incompatible = structuredClone(
      closure,
    ) as unknown as Record<string, unknown>;
    (
      incompatible.installedPackages as
        Array<Record<string, unknown>>
    )[0]!.version = "2.0.0";
    rehashClosureV2(incompatible);
    assert.throws(() =>
      PlatformReleaseProductionClosureV2Schema.parse(
        incompatible,
      ));

    const unreachable = structuredClone(
      closure,
    ) as unknown as Record<string, unknown>;
    (
      unreachable.installedPackages as
        Array<Record<string, unknown>>
    ).push({
      packagePath: "node_modules/unreachable",
      packageName: "unreachable",
      version: "1.0.0",
      lockEntryHash: "3".repeat(64),
    });
    unreachable.installedPackageCount = 2;
    unreachable.installedPackageMembershipHash =
      hashPlatformReleaseProductionPackageMembershipV2(
        unreachable.installedPackages as never,
      );
    rehashClosureV2(unreachable);
    assert.throws(() =>
      PlatformReleaseProductionClosureV2Schema.parse(
        unreachable,
      ));
  });

  it("enforces the 512 KiB producer budget below the graph and external envelopes", () => {
    assert.equal(
      PLATFORM_RELEASE_PRODUCTION_CLOSURE_MAX_CANONICAL_BYTES_V2,
      512 * 1024,
    );
    const installedPackages = Array.from(
      { length: 3_000 },
      (_, index) => {
        const packageName =
          `runtime-${index.toString().padStart(4, "0")}`;
        return {
          packagePath: `node_modules/${packageName}`,
          packageName,
          version: "1.0.0",
          lockEntryHash: "4".repeat(64),
        };
      },
    );
    const edges = installedPackages.map((entry) => ({
      ownerPackagePath: "",
      kind: "required" as const,
      dependencyName: entry.packageName,
      declaredSpec: "1.0.0",
      resolvedPackagePath: entry.packagePath,
    }));
    const rootDependencyLocators =
      installedPackages.map((entry) => entry.packagePath);
    assert.throws(() =>
      createPlatformReleaseProductionClosureV2({
        schema:
          PLATFORM_RELEASE_PRODUCTION_CLOSURE_V2_SCHEMA,
        version: "2.0.0",
        contractHash:
          PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_HASH_V2,
        lockAuthorityHash: "5".repeat(64),
        hostPlatform: "darwin",
        hostArchitecture: "arm64",
        rootDependencyCount:
          rootDependencyLocators.length,
        rootDependencyLocators,
        installedPackageCount:
          installedPackages.length,
        installedPackages,
        edgeCount: edges.length,
        edges,
        rootMembershipHash:
          hashPlatformReleaseProductionRootMembershipV2(
            rootDependencyLocators,
          ),
        installedPackageMembershipHash:
          hashPlatformReleaseProductionPackageMembershipV2(
            installedPackages,
          ),
        edgeMembershipHash:
          hashPlatformReleaseProductionEdgeMembershipV2(
            edges,
          ),
      }));
  });
});
