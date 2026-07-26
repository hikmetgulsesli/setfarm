import { createHash } from "node:crypto";

import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_BUILD_DIRECT_ARGV_TEMPLATE_V2,
  PlatformReleaseBuildCommandResultV2Schema,
} from "./platform-release-build-v2.js";
import {
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_BUILD_EVIDENCE_V2_SCHEMA =
  "setfarm.platform-release-host-node-toolchain-build-evidence.v2" as const;
export const PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_BUILD_EVIDENCE_MAX_CANONICAL_BYTES_V2 =
  64 * 1024;

const PlatformReleaseHostNodeToolchainBuildEvidenceIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_BUILD_EVIDENCE_V2_SCHEMA,
    ),
    version: z.literal("2.0.0"),
    authorityState: z.literal(
      "authenticated_process_occurrence_unverified",
    ),
    productionUse: z.literal(
      "forbidden_until_source_owned_double_build_and_fresh_release_verification",
    ),
    probeRef: z.literal("HOST_NODE_PLATFORM_RELEASE_BUILD_V2"),
    platformHostToolchainReceiptHash: Sha256Schema,
    nodeIdentityHash: Sha256Schema,
    buildContextRootIdentityHash: Sha256Schema,
    outputStageIdentityHash: Sha256Schema,
    commandModuleHash: Sha256Schema,
    environmentHash: Sha256Schema,
    directArgv: z.tuple([
      z.literal("node"),
      z.literal("scripts/build-platform-release-v2.mjs"),
      z.literal("--source-root"),
      z.literal("<VERIFIED_SOURCE_STAGE>"),
      z.literal("--output-root"),
      z.literal("<EMPTY_OUTPUT_STAGE>"),
      z.literal("--build-toolchain-root"),
      z.literal("<AUTHENTICATED_BUILD_TOOLCHAIN_CAPSULE>"),
      z.literal("--build-toolchain-hash"),
      z.literal("<AUTHENTICATED_BUILD_TOOLCHAIN_TREE_HASH>"),
      z.literal("--source-sha"),
      z.literal("<ADMITTED_SOURCE_SHA>"),
      z.literal("--source-date-epoch"),
      z.literal("<ADMITTED_SOURCE_EPOCH>"),
    ]),
    directArgvHash: Sha256Schema,
    stdin: z.literal("closed"),
    inheritAmbientEnvironment: z.literal(false),
    timeoutMs: z.literal(120_000),
    maxStdoutBytes: z.literal(1_048_576),
    maxStderrBytes: z.literal(1_048_576),
    shell: z.literal("forbidden"),
    termination: z.literal("normal_exit"),
    exitCode: z.literal(0),
    signal: z.null(),
    stdoutContentHash: Sha256Schema,
    stdoutByteLength:
      z.number().int().positive().max(1_048_576),
    stderrContentHash: Sha256Schema,
    stderrByteLength:
      z.number().int().nonnegative().max(1_048_576),
    commandResult: PlatformReleaseBuildCommandResultV2Schema,
  }).strict();

export type PlatformReleaseHostNodeToolchainBuildEvidenceHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseHostNodeToolchainBuildEvidenceIdentityV2Schema
  >;

export function hashPlatformReleaseHostNodeToolchainBuildEvidenceV2(
  value:
    | PlatformReleaseHostNodeToolchainBuildEvidenceHashPayloadV2
    | PlatformReleaseHostNodeToolchainBuildEvidenceV2,
): string {
  const evidence = { ...value } as Record<string, unknown>;
  delete evidence.evidenceHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-node-toolchain-build-evidence-hash.v2",
    evidence,
  });
}

export const PlatformReleaseHostNodeToolchainBuildEvidenceV2Schema =
  PlatformReleaseHostNodeToolchainBuildEvidenceIdentityV2Schema
    .extend({
      evidenceHash: Sha256Schema,
    })
    .strict()
    .superRefine((value, context) => {
      if (
        !platformReleaseCandidateFitsCanonicalCapV2(
          value,
          PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_BUILD_EVIDENCE_MAX_CANONICAL_BYTES_V2,
        )
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Platform release host build evidence exceeds its canonical byte cap",
        });
        return;
      }
      const expectedDirectArgvHash = hashCanonicalJson({
        schema:
          "setfarm.platform-release-build-direct-argv-hash.v2",
        directArgv:
          PLATFORM_RELEASE_BUILD_DIRECT_ARGV_TEMPLATE_V2,
      });
      const expectedEnvironmentHash = hashCanonicalJson({
        schema:
          "setfarm.platform-release-build-process-environment.v2",
        variables: Object.entries({
          CI: "true",
          LANG: "C.UTF-8",
          LC_ALL: "C.UTF-8",
          NO_COLOR: "1",
          SOURCE_DATE_EPOCH:
            value.commandResult.sourceDateEpoch,
          TZ: "UTC",
        }).sort(
          ([left], [right]) =>
            left < right ? -1 : left > right ? 1 : 0,
        ),
      });
      const stdout =
        `${canonicalJsonStringify(value.commandResult)}\n`;
      const expectedStdoutHash = createHash("sha256")
        .update(stdout)
        .digest("hex");
      const emptyHash = createHash("sha256")
        .update("")
        .digest("hex");
      if (
        canonicalJsonStringify(value.directArgv)
          !== canonicalJsonStringify(
            PLATFORM_RELEASE_BUILD_DIRECT_ARGV_TEMPLATE_V2,
          )
        || value.directArgvHash !== expectedDirectArgvHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["directArgvHash"],
          message:
            "Platform release host build evidence must bind the exact direct argv template",
        });
      }
      if (value.environmentHash !== expectedEnvironmentHash) {
        context.addIssue({
          code: "custom",
          path: ["environmentHash"],
          message:
            "Platform release host build evidence must bind the exact process environment",
        });
      }
      if (
        value.stdoutContentHash !== expectedStdoutHash
        || value.stdoutByteLength
          !== Buffer.byteLength(stdout, "utf8")
        || value.stderrContentHash !== emptyHash
        || value.stderrByteLength !== 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["stdoutContentHash"],
          message:
            "Platform release host build evidence must bind canonical stdout and empty stderr",
        });
      }
      if (
        value.evidenceHash
          !== hashPlatformReleaseHostNodeToolchainBuildEvidenceV2(
            value,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["evidenceHash"],
          message:
            "Platform release host build evidence hash mismatch",
        });
      }
    });

export type PlatformReleaseHostNodeToolchainBuildEvidenceV2 =
  z.infer<
    typeof PlatformReleaseHostNodeToolchainBuildEvidenceV2Schema
  >;

export function parsePlatformReleaseHostNodeToolchainBuildEvidenceCandidateV2(
  input: unknown,
): PlatformReleaseHostNodeToolchainBuildEvidenceV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_BUILD_EVIDENCE_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseHostNodeToolchainBuildEvidenceV2Schema.parse(
      snapshot,
    ),
  );
}
