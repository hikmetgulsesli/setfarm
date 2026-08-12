import { z } from "zod";

import {
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_PREDEPENDENCY_OUTPUT_BINDING_V2_SCHEMA =
  "setfarm.platform-release-predependency-output-binding.v2" as const;
export const PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_INSPECTION_V2_SCHEMA =
  "setfarm.platform-release-compiled-output-pair-inspection.v2" as const;
export const PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_MAX_CANONICAL_BYTES_V2 =
  64 * 1024;

const CanonicalEpochV2Schema = z.string()
  .min(1)
  .max(20)
  .regex(/^(?:0|[1-9][0-9]*)$/);

const PlatformReleasePredependencyOutputBindingIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_PREDEPENDENCY_OUTPUT_BINDING_V2_SCHEMA,
    ),
    version: z.literal("2.0.0"),
    sourceBindingHash: Sha256Schema,
    admittedSha: z.string()
      .regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
    sourceDateEpoch: CanonicalEpochV2Schema,
    commandModuleHash: Sha256Schema,
    buildToolchainTreeBindingHash: Sha256Schema,
    compilerEntryHash: Sha256Schema,
    commandResultHash: Sha256Schema,
    distTreeHash: Sha256Schema,
    distTreePayloadHash: Sha256Schema,
    distFileCount: z.number().int().positive().max(20_000),
    distDirectoryCount:
      z.number().int().nonnegative().max(4_000),
    distTotalBytes:
      z.number().int().positive().max(512 * 1024 * 1024),
    packageSourceRefHash: Sha256Schema,
    packageContentHash: Sha256Schema,
    packageByteLength:
      z.number().int().positive().max(4 * 1024 * 1024),
    outputLayout:
      z.literal("payload_dist_and_package_json_only"),
    dependencyState: z.literal("absent"),
    manifestState: z.literal("absent"),
  }).strict();

export type PlatformReleasePredependencyOutputBindingHashPayloadV2 =
  z.infer<
    typeof PlatformReleasePredependencyOutputBindingIdentityV2Schema
  >;

export function hashPlatformReleasePredependencyOutputBindingV2(
  value:
    | PlatformReleasePredependencyOutputBindingHashPayloadV2
    | PlatformReleasePredependencyOutputBindingV2,
): string {
  const identity = { ...value } as Record<string, unknown>;
  delete identity.bindingHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-predependency-output-binding-hash.v2",
    binding: identity,
  });
}

export const PlatformReleasePredependencyOutputBindingV2Schema =
  PlatformReleasePredependencyOutputBindingIdentityV2Schema
    .extend({
      bindingHash: Sha256Schema,
    })
    .strict()
    .superRefine((value, context) => {
      if (
        value.bindingHash
          !== hashPlatformReleasePredependencyOutputBindingV2(
            value,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["bindingHash"],
          message:
            "Predependency output binding hash mismatch",
        });
      }
    });

export type PlatformReleasePredependencyOutputBindingV2 =
  z.infer<
    typeof PlatformReleasePredependencyOutputBindingV2Schema
  >;

export function createPlatformReleasePredependencyOutputBindingV2(
  input:
    PlatformReleasePredependencyOutputBindingHashPayloadV2,
): PlatformReleasePredependencyOutputBindingV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleasePredependencyOutputBindingV2Schema.parse({
      ...input,
      bindingHash:
        hashPlatformReleasePredependencyOutputBindingV2(input),
    }),
  );
}

const PlatformReleaseCompiledOutputPairInspectionIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_INSPECTION_V2_SCHEMA,
    ),
    version: z.literal("2.0.0"),
    authorityState: z.literal(
      "candidate_compiled_output_pair_unverified",
    ),
    productionUse: z.literal(
      "forbidden_until_dependency_materialization_and_fresh_release_verification",
    ),
    admissionScope:
      z.enum(["production_candidate", "test_fixture"]),
    lifecycle: z.literal("double_build_complete"),
    sourceBindingHash: Sha256Schema,
    buildToolchainReceiptHash: Sha256Schema,
    stableOutput:
      PlatformReleasePredependencyOutputBindingV2Schema,
    occurrences: z.tuple([
      z.object({
        stageRef: z.literal(
          "PLATFORM_RELEASE_BUILD_STAGE_FIRST_V2",
        ),
        hostBuildEvidenceHash: Sha256Schema,
        outputStagePhysicalIdentityHash: Sha256Schema,
        predependencyOutputBindingHash: Sha256Schema,
        stableHostProjectionHash: Sha256Schema,
      }).strict(),
      z.object({
        stageRef: z.literal(
          "PLATFORM_RELEASE_BUILD_STAGE_SECOND_V2",
        ),
        hostBuildEvidenceHash: Sha256Schema,
        outputStagePhysicalIdentityHash: Sha256Schema,
        predependencyOutputBindingHash: Sha256Schema,
        stableHostProjectionHash: Sha256Schema,
      }).strict(),
    ]),
    equalityState: z.literal(
      "canonical_command_results_dist_trees_and_package_bytes_equal",
    ),
  }).strict().superRefine((value, context) => {
    if (
      value.sourceBindingHash
        !== value.stableOutput.sourceBindingHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["stableOutput", "sourceBindingHash"],
        message:
          "Compiled pair source must join its stable output binding",
      });
    }
    if (
      value.occurrences[0].hostBuildEvidenceHash
        === value.occurrences[1].hostBuildEvidenceHash
      || value.occurrences[0]
        .outputStagePhysicalIdentityHash
        === value.occurrences[1]
          .outputStagePhysicalIdentityHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["occurrences"],
        message:
          "Independent build occurrences must have distinct physical and evidence identities",
      });
    }
    if (
      value.occurrences.some((occurrence) =>
        occurrence.predependencyOutputBindingHash
          !== value.stableOutput.bindingHash)
    ) {
      context.addIssue({
        code: "custom",
        path: ["occurrences"],
        message:
          "Every build occurrence must join the one stable output binding",
      });
    }
    if (
      value.occurrences[0].stableHostProjectionHash
        !== value.occurrences[1].stableHostProjectionHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["occurrences"],
        message:
          "Independent build occurrences must share one stable host projection",
      });
    }
  });

export type PlatformReleaseCompiledOutputPairInspectionHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseCompiledOutputPairInspectionIdentityV2Schema
  >;

export function hashPlatformReleaseCompiledOutputPairInspectionV2(
  value:
    | PlatformReleaseCompiledOutputPairInspectionHashPayloadV2
    | PlatformReleaseCompiledOutputPairInspectionV2,
): string {
  const identity = { ...value } as Record<string, unknown>;
  delete identity.inspectionHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-compiled-output-pair-inspection-hash.v2",
    inspection: identity,
  });
}

export const PlatformReleaseCompiledOutputPairInspectionV2Schema =
  PlatformReleaseCompiledOutputPairInspectionIdentityV2Schema
    .extend({
      inspectionHash: Sha256Schema,
    })
    .strict()
    .superRefine((value, context) => {
      if (
        !platformReleaseCandidateFitsCanonicalCapV2(
          value,
          PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_MAX_CANONICAL_BYTES_V2,
        )
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Compiled output pair inspection exceeds its canonical byte cap",
        });
      }
      if (
        value.inspectionHash
          !== hashPlatformReleaseCompiledOutputPairInspectionV2(
            value,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["inspectionHash"],
          message:
            "Compiled output pair inspection hash mismatch",
        });
      }
    });

export type PlatformReleaseCompiledOutputPairInspectionV2 =
  z.infer<
    typeof PlatformReleaseCompiledOutputPairInspectionV2Schema
  >;

export function createPlatformReleaseCompiledOutputPairInspectionV2(
  input:
    PlatformReleaseCompiledOutputPairInspectionHashPayloadV2,
): PlatformReleaseCompiledOutputPairInspectionV2 {
  const candidate = {
    ...input,
    inspectionHash:
      hashPlatformReleaseCompiledOutputPairInspectionV2(input),
  };
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    candidate,
    PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseCompiledOutputPairInspectionV2Schema.parse(
      snapshot,
    ),
  );
}
