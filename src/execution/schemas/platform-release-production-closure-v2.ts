import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  NPM_LOCK_V3_DEPENDENCY_SPEC_MAX_CHARACTERS_V2,
  isCanonicalNpmExactVersionV2,
  isSupportedNpmDependencySpecV2,
  npmVersionSatisfiesDependencySpecV2,
} from
  "../../product-compiler/schemas/npm-lock-v3-grammar-v2.js";
import {
  EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DEPENDENCY_EDGES,
  EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES,
  PlatformReleaseNpmLockPackageLocatorV2Schema,
  PlatformReleaseNpmRootPackageLocatorV2Schema,
} from "./external-runtime-resolution-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  PlatformReleaseNpmPackageNameV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  hasCanonicalUniquePlatformReleaseStringsV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_PRODUCTION_CLOSURE_V2_SCHEMA =
  "setfarm.platform-release-production-closure.v2" as const;
export const PLATFORM_RELEASE_PRODUCTION_CLOSURE_MAX_CANONICAL_BYTES_V2 =
  512 * 1024;

export const PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_V2 =
  Object.freeze({
    schema:
      "setfarm.platform-release-production-dependency-materialization-contract.v2" as const,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    rootSelection:
      "dependencies_plus_observed_host_eligible_optional_dependencies" as const,
    developmentDependencies: "forbidden" as const,
    peerDependencies: "forbidden_by_source_lock_admission" as const,
    lifecycleScripts: "installed_but_not_executed" as const,
    libcSelectors:
      "fail_closed_without_separate_darwin_libc_authority" as const,
    packageMembership:
      "every_and_only_root_reachable_installed_lock_entries" as const,
    generatedNpmMetadata:
      "verified_hidden_lock_and_bin_surface_removed_before_seal" as const,
    callerPackageSelection: "forbidden" as const,
    maxPackages:
      EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES,
    maxDependencyEdges:
      EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DEPENDENCY_EDGES,
    maxCanonicalBytes:
      PLATFORM_RELEASE_PRODUCTION_CLOSURE_MAX_CANONICAL_BYTES_V2,
  } as const);

export const PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_HASH_V2 =
  hashCanonicalJson(
    PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_V2,
  );

const PlatformReleaseProductionClosurePackageV2Schema =
  z.object({
    packagePath:
      PlatformReleaseNpmLockPackageLocatorV2Schema,
    packageName:
      PlatformReleaseNpmPackageNameV2Schema,
    version: z.string().refine(
      isCanonicalNpmExactVersionV2,
      "Production closure version must be one canonical exact three-part version",
    ),
    lockEntryHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !value.packagePath.endsWith(
        `node_modules/${value.packageName}`,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["packagePath"],
        message:
          "Production closure package path must terminate in its exact package name",
      });
    }
  });

export type PlatformReleaseProductionClosurePackageV2 =
  z.infer<
    typeof PlatformReleaseProductionClosurePackageV2Schema
  >;

const PlatformReleaseProductionDependencyEdgeV2Schema =
  z.object({
    ownerPackagePath: z.union([
      z.literal(""),
      PlatformReleaseNpmLockPackageLocatorV2Schema,
    ]),
    kind: z.enum(["required", "optional"]),
    dependencyName:
      PlatformReleaseNpmPackageNameV2Schema,
    declaredSpec: z.string()
      .max(
        NPM_LOCK_V3_DEPENDENCY_SPEC_MAX_CHARACTERS_V2,
      )
      .refine(
        isSupportedNpmDependencySpecV2,
        "Production closure dependency spec must use the supported canonical lock grammar",
      ),
    resolvedPackagePath:
      PlatformReleaseNpmLockPackageLocatorV2Schema,
  }).strict();

export type PlatformReleaseProductionDependencyEdgeV2 =
  z.infer<
    typeof PlatformReleaseProductionDependencyEdgeV2Schema
  >;

function closureEdgeKeyV2(
  edge: PlatformReleaseProductionDependencyEdgeV2,
): string {
  return [
    edge.ownerPackagePath,
    edge.kind,
    edge.dependencyName,
    edge.resolvedPackagePath,
    edge.declaredSpec,
  ].join("\0");
}

export function hashPlatformReleaseProductionRootMembershipV2(
  roots: readonly string[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-production-root-membership-hash.v2",
    roots,
  });
}

export function hashPlatformReleaseProductionPackageMembershipV2(
  packages:
    readonly PlatformReleaseProductionClosurePackageV2[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-production-package-membership-hash.v2",
    packages: packages.map((entry) => ({
      packagePath: entry.packagePath,
      lockEntryHash: entry.lockEntryHash,
    })),
  });
}

export function hashPlatformReleaseProductionEdgeMembershipV2(
  edges:
    readonly PlatformReleaseProductionDependencyEdgeV2[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-production-edge-membership-hash.v2",
    edges,
  });
}

const PlatformReleaseProductionClosureIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_PRODUCTION_CLOSURE_V2_SCHEMA,
    ),
    version: z.literal(
      PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    ),
    contractHash: z.literal(
      PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_HASH_V2,
    ),
    lockAuthorityHash: Sha256Schema,
    hostPlatform: z.string().min(1).max(100),
    hostArchitecture: z.string().min(1).max(100),
    rootDependencyCount:
      z.number().int().nonnegative()
        .max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES),
    rootDependencyLocators: z.array(
      PlatformReleaseNpmRootPackageLocatorV2Schema,
    ).max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES),
    installedPackageCount:
      z.number().int().nonnegative()
        .max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES),
    installedPackages: z.array(
      PlatformReleaseProductionClosurePackageV2Schema,
    ).max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES),
    edgeCount:
      z.number().int().nonnegative()
        .max(
          EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DEPENDENCY_EDGES,
        ),
    edges: z.array(
      PlatformReleaseProductionDependencyEdgeV2Schema,
    ).max(
      EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DEPENDENCY_EDGES,
    ),
    rootMembershipHash: Sha256Schema,
    installedPackageMembershipHash: Sha256Schema,
    edgeMembershipHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const packageLocators =
      value.installedPackages.map((entry) =>
        entry.packagePath);
    const edgeKeys = value.edges.map(closureEdgeKeyV2);
    if (
      !hasCanonicalUniquePlatformReleaseStringsV2(
        value.rootDependencyLocators,
      )
      || !hasCanonicalUniquePlatformReleaseStringsV2(
        packageLocators,
      )
      || !hasCanonicalUniquePlatformReleaseStringsV2(
        edgeKeys,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["edges"],
        message:
          "Production closure roots, packages and edges must be unique and canonically sorted",
      });
    }
    if (
      value.rootDependencyCount
        !== value.rootDependencyLocators.length
      || value.installedPackageCount
        !== value.installedPackages.length
      || value.edgeCount !== value.edges.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["edgeCount"],
        message:
          "Production closure counts must equal their exact arrays",
      });
    }
    const packages = new Map(
      value.installedPackages.map((entry) => [
        entry.packagePath,
        entry,
      ]),
    );
    const rootLocators = [
      ...new Set(
        value.edges
          .filter((edge) => edge.ownerPackagePath === "")
          .map((edge) => edge.resolvedPackagePath),
      ),
    ].sort();
    if (
      canonicalJsonStringify(rootLocators)
        !== canonicalJsonStringify(
          value.rootDependencyLocators,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["rootDependencyLocators"],
        message:
          "Production closure roots must equal every and only exact root edge",
      });
    }
    value.edges.forEach((edge, index) => {
      const resolved = packages.get(
        edge.resolvedPackagePath,
      );
      if (
        !resolved
        || (
          edge.ownerPackagePath !== ""
          && !packages.has(edge.ownerPackagePath)
        )
        || edge.ownerPackagePath
          === edge.resolvedPackagePath
        || resolved.packageName !== edge.dependencyName
        || !npmVersionSatisfiesDependencySpecV2(
          resolved.version,
          edge.declaredSpec,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["edges", index],
          message:
            "Production closure edge must join an existing owner and exact resolved package identity",
        });
      }
    });
    const reached = new Set<string>();
    const pending = [...value.rootDependencyLocators];
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (reached.has(current)) continue;
      reached.add(current);
      for (const edge of value.edges) {
        if (edge.ownerPackagePath === current) {
          pending.push(edge.resolvedPackagePath);
        }
      }
    }
    if (
      reached.size !== packages.size
      || [...packages.keys()].some((packagePath) =>
        !reached.has(packagePath))
    ) {
      context.addIssue({
        code: "custom",
        path: ["installedPackages"],
        message:
          "Every and only production package must be reachable from an exact root edge",
      });
    }
    if (
      value.rootMembershipHash
        !== hashPlatformReleaseProductionRootMembershipV2(
          value.rootDependencyLocators,
        )
      || value.installedPackageMembershipHash
        !== hashPlatformReleaseProductionPackageMembershipV2(
          value.installedPackages,
        )
      || value.edgeMembershipHash
        !== hashPlatformReleaseProductionEdgeMembershipV2(
          value.edges,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["edgeMembershipHash"],
        message:
          "Production closure membership hashes must bind the exact roots, packages and edges",
      });
    }
  });

export type PlatformReleaseProductionClosureHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseProductionClosureIdentityV2Schema
  >;

export function hashPlatformReleaseProductionClosureV2(
  value:
    | PlatformReleaseProductionClosureHashPayloadV2
    | PlatformReleaseProductionClosureV2,
): string {
  const closure = { ...value } as Record<string, unknown>;
  delete closure.closureHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-production-closure-hash.v2",
    closure,
  });
}

export const PlatformReleaseProductionClosureV2Schema =
  PlatformReleaseProductionClosureIdentityV2Schema
    .extend({
      closureHash: Sha256Schema,
    })
    .strict()
    .superRefine((value, context) => {
      if (
        !platformReleaseCandidateFitsCanonicalCapV2(
          value,
          PLATFORM_RELEASE_PRODUCTION_CLOSURE_MAX_CANONICAL_BYTES_V2,
        )
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Production closure exceeds its canonical byte cap",
        });
      }
      if (
        value.closureHash
          !== hashPlatformReleaseProductionClosureV2(
            value,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["closureHash"],
          message:
            "Production closure hash must bind the complete exact closure",
        });
      }
    });

export type PlatformReleaseProductionClosureV2 =
  z.infer<typeof PlatformReleaseProductionClosureV2Schema>;

export function createPlatformReleaseProductionClosureV2(
  input:
    PlatformReleaseProductionClosureHashPayloadV2,
): PlatformReleaseProductionClosureV2 {
  const candidate = {
    ...input,
    closureHash:
      hashPlatformReleaseProductionClosureV2(input),
  };
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    candidate,
    PLATFORM_RELEASE_PRODUCTION_CLOSURE_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseProductionClosureV2Schema.parse(
      snapshot,
    ),
  );
}
