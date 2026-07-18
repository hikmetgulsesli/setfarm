import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import {
  BuildCommandV1Schema,
} from "../../product-compiler/schemas/build-topology-v1.js";
import {
  CapabilityIdSchema,
  Sha256Schema,
  StableReferenceSchema,
  hasUniqueStrings,
} from "../../product-compiler/schemas/common-v1.js";
import { SourceRevisionV1Schema } from "./execution-attempt-v1.js";
import {
  CANONICAL_RUNTIME_TREE_V2_PROFILES,
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
} from "./canonical-runtime-tree-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const CANDIDATE_BUILD_RECEIPT_V2_SCHEMA =
  "setfarm.candidate-build-receipt.v2" as const;
export const CANDIDATE_BUILD_COMMAND_BINDING_V2_SCHEMA =
  "setfarm.candidate-build-command-binding.v2" as const;
export const CANDIDATE_BUILD_OUTPUT_TREE_BINDING_V2_SCHEMA =
  "setfarm.candidate-build-output-tree-binding.v2" as const;
export const CANDIDATE_CANONICAL_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA =
  "setfarm.candidate-canonical-runtime-tree-artifact-ref.v2" as const;

export const CANDIDATE_BUILD_RECEIPT_V2_MAX_CANONICAL_BYTES = 128 * 1024;
export const CANDIDATE_CANONICAL_RUNTIME_TREE_ENVELOPE_MAX_BYTES_V2 =
  128 * 1024 * 1024;

const CandidateBuildEnvironmentRefV2Schema = z.string()
  .min(1)
  .max(160)
  .regex(/^[A-Z_][A-Z0-9_]*$/);

const CandidateBuildCommandArgvV2Schema = BuildCommandV1Schema.shape.argv;
const CandidateBuildCommandCapabilityRefsV2Schema = z.array(CapabilityIdSchema)
  .max(500)
  .refine(hasUniqueStrings, {
    message: "Candidate build command capability refs must be unique",
  });
const CandidateBuildCommandEnvironmentRefsV2Schema = z.array(
  CandidateBuildEnvironmentRefV2Schema,
).max(500).refine(hasUniqueStrings, {
  message: "Candidate build command environment refs must be unique",
});

export function hashCandidateBuildCommandArgvV2(input: unknown): string {
  const argv = CandidateBuildCommandArgvV2Schema.parse(input);
  return hashCanonicalJson({
    schema: "setfarm.candidate-build-command-argv-hash.v2",
    argv,
  });
}

export function hashCandidateBuildCommandCapabilityRefsV2(input: unknown): string {
  const capabilityRefs = CandidateBuildCommandCapabilityRefsV2Schema.parse(input);
  return hashCanonicalJson({
    schema: "setfarm.candidate-build-command-capability-refs-hash.v2",
    capabilityRefs,
  });
}

export function hashCandidateBuildCommandEnvironmentRefsV2(input: unknown): string {
  const environmentRefs = CandidateBuildCommandEnvironmentRefsV2Schema.parse(input);
  return hashCanonicalJson({
    schema: "setfarm.candidate-build-command-environment-refs-hash.v2",
    environmentRefs,
  });
}

export const CandidateCanonicalRuntimeTreeArtifactRefV2Schema = z.object({
  schema: z.literal(CANDIDATE_CANONICAL_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA),
  artifactType: z.literal(CANONICAL_RUNTIME_TREE_V2_SCHEMA),
  envelopeHash: Sha256Schema,
  envelopeByteLength: z.number().int().positive()
    .max(CANDIDATE_CANONICAL_RUNTIME_TREE_ENVELOPE_MAX_BYTES_V2),
}).strict();

export type CandidateCanonicalRuntimeTreeArtifactRefV2 = z.infer<
  typeof CandidateCanonicalRuntimeTreeArtifactRefV2Schema
>;

const CandidateBuildOutputTreeBindingIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_BUILD_OUTPUT_TREE_BINDING_V2_SCHEMA),
  treeSchema: z.literal(CANONICAL_RUNTIME_TREE_V2_SCHEMA),
  profile: z.literal("dist"),
  logicalRoot: z.literal("candidate-build-output"),
  treeArtifact: CandidateCanonicalRuntimeTreeArtifactRefV2Schema,
  treeHash: Sha256Schema,
  treePayloadHash: Sha256Schema,
  fileCount: z.number().int().nonnegative()
    .max(CANONICAL_RUNTIME_TREE_V2_PROFILES.dist.maxFiles),
  directoryCount: z.number().int().nonnegative()
    .max(CANONICAL_RUNTIME_TREE_V2_PROFILES.dist.maxDirectories),
  totalBytes: z.number().int().nonnegative()
    .max(CANONICAL_RUNTIME_TREE_V2_PROFILES.dist.maxTotalBytes),
}).strict();

export type CandidateBuildOutputTreeBindingHashPayloadV2 = z.infer<
  typeof CandidateBuildOutputTreeBindingIdentityV2Schema
>;

export function hashCandidateBuildOutputTreeBindingV2(
  value:
    | CandidateBuildOutputTreeBindingHashPayloadV2
    | CandidateBuildOutputTreeBindingV2,
): string {
  const binding = { ...value } as Record<string, unknown>;
  delete binding.bindingHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-build-output-tree-binding-hash.v2",
    binding,
  });
}

export const CandidateBuildOutputTreeBindingV2Schema =
  CandidateBuildOutputTreeBindingIdentityV2Schema.extend({
    bindingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.bindingHash !== hashCandidateBuildOutputTreeBindingV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["bindingHash"],
        message: "Candidate build-output binding hash must bind the exact tree artifact and identity",
      });
    }
  });

export type CandidateBuildOutputTreeBindingV2 = z.infer<
  typeof CandidateBuildOutputTreeBindingV2Schema
>;

const CandidateBuildCommandBindingIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_BUILD_COMMAND_BINDING_V2_SCHEMA),
  commandId: BuildCommandV1Schema.shape.id,
  kind: z.literal("build"),
  invocationMode: z.literal("direct_argv"),
  argvHash: Sha256Schema,
  cwd: BuildCommandV1Schema.shape.cwd,
  timeoutMs: BuildCommandV1Schema.shape.timeoutMs,
  capabilityRefsHash: Sha256Schema,
  environmentRefsHash: Sha256Schema,
  catalogCommandRef: StableReferenceSchema,
  catalogCommandHash: Sha256Schema,
}).strict();

export type CandidateBuildCommandBindingHashPayloadV2 = z.infer<
  typeof CandidateBuildCommandBindingIdentityV2Schema
>;

export function hashCandidateBuildCommandBindingV2(
  value:
    | CandidateBuildCommandBindingHashPayloadV2
    | CandidateBuildCommandBindingV2,
): string {
  const binding = { ...value } as Record<string, unknown>;
  delete binding.commandBindingHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-build-command-binding-hash.v2",
    binding,
  });
}

export const CandidateBuildCommandBindingV2Schema =
  CandidateBuildCommandBindingIdentityV2Schema.extend({
    commandBindingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.commandBindingHash !== hashCandidateBuildCommandBindingV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["commandBindingHash"],
        message: "Candidate build-command binding hash must bind the exact selected topology command",
      });
    }
  });

export type CandidateBuildCommandBindingV2 = z.infer<
  typeof CandidateBuildCommandBindingV2Schema
>;

const CandidateBuildReceiptIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_BUILD_RECEIPT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("candidate_unverified"),
  productionUse: z.literal("forbidden"),
  packetEnvelopeHash: Sha256Schema,
  buildTopologyHash: Sha256Schema,
  sourceBefore: SourceRevisionV1Schema,
  sourceAfter: SourceRevisionV1Schema,
  selectedBuildCommand: CandidateBuildCommandBindingV2Schema,
  toolchainHash: Sha256Schema,
  environmentCapsuleHash: Sha256Schema,
  exitCode: z.literal(0),
  outputTree: CandidateBuildOutputTreeBindingV2Schema,
}).strict();

export type CandidateBuildReceiptHashPayloadV2 = z.infer<
  typeof CandidateBuildReceiptIdentityV2Schema
>;

export function hashCandidateBuildReceiptV2(
  value: CandidateBuildReceiptHashPayloadV2 | CandidateBuildReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-build-receipt-hash.v2",
    receipt,
  });
}

export const CandidateBuildReceiptV2Schema = CandidateBuildReceiptIdentityV2Schema.extend({
  receiptHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.sourceBefore.sha !== value.sourceAfter.sha
    || value.sourceBefore.treeHash !== value.sourceAfter.treeHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["sourceAfter"],
      message: "Candidate build must finish on the exact admitted source revision",
    });
  }
  if (!platformReleaseCandidateFitsCanonicalCapV2(
    value,
    CANDIDATE_BUILD_RECEIPT_V2_MAX_CANONICAL_BYTES,
  )) {
    context.addIssue({
      code: "custom",
      message: `Candidate build receipt exceeds ${CANDIDATE_BUILD_RECEIPT_V2_MAX_CANONICAL_BYTES} canonical bytes`,
    });
    return;
  }
  if (value.receiptHash !== hashCandidateBuildReceiptV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["receiptHash"],
      message: "Candidate build receipt hash must bind the exact domain-separated receipt",
    });
  }
});

export type CandidateBuildReceiptV2 = z.infer<
  typeof CandidateBuildReceiptV2Schema
>;

export function parseCandidateBuildReceiptV2(input: unknown): CandidateBuildReceiptV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    CANDIDATE_BUILD_RECEIPT_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    CandidateBuildReceiptV2Schema.parse(snapshot),
  );
}
