import { z } from "zod";

import {
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  CanonicalRuntimeDependencyTreeBindingCandidateV2Schema,
} from "./platform-runtime-payload-v2.js";
import {
  PlatformReleaseCompiledOutputPairInspectionV2Schema,
} from "./platform-release-compiled-output-pair-v2.js";
import {
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_DEPENDENCY_OUTPUT_BINDING_V2_SCHEMA =
  "setfarm.platform-release-dependency-output-binding.v2" as const;
export const PLATFORM_RELEASE_DEPENDENCY_MATERIALIZED_PAIR_INSPECTION_V2_SCHEMA =
  "setfarm.platform-release-dependency-materialized-pair-inspection.v2" as const;
export const PLATFORM_RELEASE_DEPENDENCY_MATERIALIZED_PAIR_MAX_CANONICAL_BYTES_V2 =
  192 * 1024;

const PlatformReleaseDependencyOutputBindingIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_DEPENDENCY_OUTPUT_BINDING_V2_SCHEMA,
    ),
    version: z.literal("2.0.0"),
    sourceBindingHash: Sha256Schema,
    predependencyOutputBindingHash: Sha256Schema,
    distTreeHash: Sha256Schema,
    distTreePayloadHash: Sha256Schema,
    distFileCount:
      z.number().int().positive().max(20_000),
    distDirectoryCount:
      z.number().int().nonnegative().max(4_000),
    distTotalBytes:
      z.number().int().positive().max(512 * 1024 * 1024),
    packageSourceRefHash: Sha256Schema,
    packageContentHash: Sha256Schema,
    packageByteLength:
      z.number().int().positive().max(4 * 1024 * 1024),
    dependencyTree:
      CanonicalRuntimeDependencyTreeBindingCandidateV2Schema,
    productionClosureHash: Sha256Schema,
    productionClosureContractHash: Sha256Schema,
    productionResolutionGraphHash: Sha256Schema,
    npmMaterializationReceiptHash: Sha256Schema,
    outputLayout: z.literal(
      "payload_dist_node_modules_and_package_json_only",
    ),
    dependencyState: z.literal(
      "sealed_every_and_only_root_reachable_production_closure",
    ),
    manifestState: z.literal("absent"),
  }).strict();

export type PlatformReleaseDependencyOutputBindingHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseDependencyOutputBindingIdentityV2Schema
  >;

export function hashPlatformReleaseDependencyOutputBindingV2(
  value:
    | PlatformReleaseDependencyOutputBindingHashPayloadV2
    | PlatformReleaseDependencyOutputBindingV2,
): string {
  const identity = { ...value } as Record<string, unknown>;
  delete identity.bindingHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-dependency-output-binding-hash.v2",
    binding: identity,
  });
}

export const PlatformReleaseDependencyOutputBindingV2Schema =
  PlatformReleaseDependencyOutputBindingIdentityV2Schema
    .extend({
      bindingHash: Sha256Schema,
    })
    .strict()
    .superRefine((value, context) => {
      if (
        value.bindingHash
          !== hashPlatformReleaseDependencyOutputBindingV2(
            value,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["bindingHash"],
          message:
            "Dependency-materialized output binding hash mismatch",
        });
      }
    });

export type PlatformReleaseDependencyOutputBindingV2 =
  z.infer<
    typeof PlatformReleaseDependencyOutputBindingV2Schema
  >;

export function createPlatformReleaseDependencyOutputBindingV2(
  input:
    PlatformReleaseDependencyOutputBindingHashPayloadV2,
): PlatformReleaseDependencyOutputBindingV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseDependencyOutputBindingV2Schema.parse({
      ...input,
      bindingHash:
        hashPlatformReleaseDependencyOutputBindingV2(input),
    }),
  );
}

const PlatformReleaseDependencyMaterializedPairInspectionIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_DEPENDENCY_MATERIALIZED_PAIR_INSPECTION_V2_SCHEMA,
    ),
    version: z.literal("2.0.0"),
    authorityState: z.literal(
      "candidate_dependency_materialized_pair_unverified",
    ),
    productionUse: z.literal(
      "forbidden_until_complete_release_composition_and_fresh_release_verification",
    ),
    admissionScope:
      z.enum(["production_candidate", "test_fixture"]),
    lifecycle: z.literal("dependency_materializing"),
    sourceBindingHash: Sha256Schema,
    buildToolchainReceiptHash: Sha256Schema,
    compiledOutputPairInspectionHash: Sha256Schema,
    compiledOutputPair:
      PlatformReleaseCompiledOutputPairInspectionV2Schema,
    stableOutput:
      PlatformReleaseDependencyOutputBindingV2Schema,
    occurrences: z.tuple([
      z.object({
        stageRef: z.literal(
          "PLATFORM_RELEASE_DEPENDENCY_STAGE_FIRST_V2",
        ),
        hostDependencyInstallEvidenceHash: Sha256Schema,
        dependencyTreePhysicalIdentityHash: Sha256Schema,
        dependencyOutputBindingHash: Sha256Schema,
        npmMaterializationReceiptHash: Sha256Schema,
        productionClosureHash: Sha256Schema,
        productionClosureContractHash: Sha256Schema,
        productionResolutionGraphHash: Sha256Schema,
        projectScopeHash: Sha256Schema,
        projectPhysicalIdentityHash: Sha256Schema,
        environmentHash: Sha256Schema,
        environmentScopeHash: Sha256Schema,
      }).strict(),
      z.object({
        stageRef: z.literal(
          "PLATFORM_RELEASE_DEPENDENCY_STAGE_SECOND_V2",
        ),
        hostDependencyInstallEvidenceHash: Sha256Schema,
        dependencyTreePhysicalIdentityHash: Sha256Schema,
        dependencyOutputBindingHash: Sha256Schema,
        npmMaterializationReceiptHash: Sha256Schema,
        productionClosureHash: Sha256Schema,
        productionClosureContractHash: Sha256Schema,
        productionResolutionGraphHash: Sha256Schema,
        projectScopeHash: Sha256Schema,
        projectPhysicalIdentityHash: Sha256Schema,
        environmentHash: Sha256Schema,
        environmentScopeHash: Sha256Schema,
      }).strict(),
    ]),
    equalityState: z.literal(
      "independent_processes_and_physical_trees_with_equal_canonical_dependency_graph_receipt_and_complete_output",
    ),
  }).strict().superRefine((value, context) => {
    if (
      value.sourceBindingHash
        !== value.stableOutput.sourceBindingHash
      || value.sourceBindingHash
        !== value.compiledOutputPair.sourceBindingHash
      || value.buildToolchainReceiptHash
        !== value.compiledOutputPair
          .buildToolchainReceiptHash
      || value.admissionScope
        !== value.compiledOutputPair.admissionScope
      || value.compiledOutputPairInspectionHash
        !== value.compiledOutputPair.inspectionHash
      || value.stableOutput
        .predependencyOutputBindingHash
        !== value.compiledOutputPair
          .stableOutput.bindingHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["compiledOutputPair"],
        message:
          "Dependency pair must join the complete authentic predecessor inspection and stable output",
      });
    }
    const [first, second] = value.occurrences;
    if (
      first.hostDependencyInstallEvidenceHash
        === second.hostDependencyInstallEvidenceHash
      || first.dependencyTreePhysicalIdentityHash
        === second.dependencyTreePhysicalIdentityHash
      || first.projectScopeHash === second.projectScopeHash
      || first.projectPhysicalIdentityHash
        === second.projectPhysicalIdentityHash
      || first.environmentHash === second.environmentHash
      || first.environmentScopeHash
        === second.environmentScopeHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["occurrences"],
        message:
          "Independent dependency occurrences must have distinct process, physical, project and environment identities",
      });
    }
    if (
      value.occurrences.some((occurrence) =>
        occurrence.dependencyOutputBindingHash
          !== value.stableOutput.bindingHash
        || occurrence.npmMaterializationReceiptHash
          !== value.stableOutput
            .npmMaterializationReceiptHash
        || occurrence.productionClosureHash
          !== value.stableOutput.productionClosureHash
        || occurrence.productionClosureContractHash
          !== value.stableOutput
            .productionClosureContractHash
        || occurrence.productionResolutionGraphHash
          !== value.stableOutput
            .productionResolutionGraphHash)
    ) {
      context.addIssue({
        code: "custom",
        path: ["occurrences"],
        message:
          "Every dependency occurrence must join the one stable output, receipt and graph",
      });
    }
  });

export type PlatformReleaseDependencyMaterializedPairInspectionHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseDependencyMaterializedPairInspectionIdentityV2Schema
  >;

export function hashPlatformReleaseDependencyMaterializedPairInspectionV2(
  value:
    | PlatformReleaseDependencyMaterializedPairInspectionHashPayloadV2
    | PlatformReleaseDependencyMaterializedPairInspectionV2,
): string {
  const identity = { ...value } as Record<string, unknown>;
  delete identity.inspectionHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-dependency-materialized-pair-inspection-hash.v2",
    inspection: identity,
  });
}

export const PlatformReleaseDependencyMaterializedPairInspectionV2Schema =
  PlatformReleaseDependencyMaterializedPairInspectionIdentityV2Schema
    .extend({
      inspectionHash: Sha256Schema,
    })
    .strict()
    .superRefine((value, context) => {
      if (
        !platformReleaseCandidateFitsCanonicalCapV2(
          value,
          PLATFORM_RELEASE_DEPENDENCY_MATERIALIZED_PAIR_MAX_CANONICAL_BYTES_V2,
        )
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Dependency-materialized pair inspection exceeds its canonical byte cap",
        });
      }
      if (
        value.inspectionHash
          !== hashPlatformReleaseDependencyMaterializedPairInspectionV2(
            value,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["inspectionHash"],
          message:
            "Dependency-materialized pair inspection hash mismatch",
        });
      }
    });

export type PlatformReleaseDependencyMaterializedPairInspectionV2 =
  z.infer<
    typeof PlatformReleaseDependencyMaterializedPairInspectionV2Schema
  >;

export function createPlatformReleaseDependencyMaterializedPairInspectionV2(
  input:
    PlatformReleaseDependencyMaterializedPairInspectionHashPayloadV2,
): PlatformReleaseDependencyMaterializedPairInspectionV2 {
  const candidate = {
    ...input,
    inspectionHash:
      hashPlatformReleaseDependencyMaterializedPairInspectionV2(
        input,
      ),
  };
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    candidate,
    PLATFORM_RELEASE_DEPENDENCY_MATERIALIZED_PAIR_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseDependencyMaterializedPairInspectionV2Schema
      .parse(snapshot),
  );
}
