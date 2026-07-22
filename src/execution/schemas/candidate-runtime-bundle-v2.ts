import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import {
  GitCodeShaSchema,
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  CandidateBuildReceiptV2Schema,
  CandidateCanonicalRuntimeTreeArtifactRefV2Schema,
  type CandidateBuildReceiptV2,
} from "./candidate-build-receipt-v2.js";
import {
  CANONICAL_RUNTIME_TREE_V2_PROFILES,
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
} from "./canonical-runtime-tree-v2.js";
import {
  EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES,
  ExactPackageLockSourceRefV2Schema,
  PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA,
} from "./external-runtime-resolution-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const CANDIDATE_RUNTIME_BUNDLE_V2_SCHEMA =
  "setfarm.candidate-runtime-bundle.v2" as const;
export const CANDIDATE_RUNTIME_BUNDLE_V2_VERSION = "2.1.0" as const;
export const CANDIDATE_RUNTIME_APPLICATION_TREE_BINDING_V2_SCHEMA =
  "setfarm.candidate-runtime-application-tree-binding.v2" as const;
export const CANDIDATE_RUNTIME_DEPENDENCY_TREE_BINDING_V2_SCHEMA =
  "setfarm.candidate-runtime-dependency-tree-binding.v2" as const;
export const CANDIDATE_RUNTIME_PACKAGE_JSON_REF_V2_SCHEMA =
  "setfarm.candidate-runtime-package-json-ref.v2" as const;
export const CANDIDATE_RUNTIME_SOURCE_BINDING_V2_SCHEMA =
  "setfarm.candidate-runtime-source-binding.v2" as const;
export const CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA =
  "setfarm.candidate-npm-materialization-receipt.v2" as const;
export const CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA =
  "setfarm.candidate-npm-production-materialization-recipe.v2" as const;
export const CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2_SCHEMA =
  "setfarm.candidate-npm-production-materialization-config.v2" as const;
export const CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2_SCHEMA =
  "setfarm.candidate-npm-materialization-receipt-abi-policy.v2" as const;
export const CANDIDATE_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA =
  "setfarm.candidate-runtime-tree-artifact-ref.v2" as const;
export const CANDIDATE_PRODUCTION_GRAPH_ARTIFACT_REF_V2_SCHEMA =
  "setfarm.candidate-production-graph-artifact-ref.v2" as const;
export const CANDIDATE_RUNTIME_PRODUCTION_GRAPH_BINDING_V2_SCHEMA =
  "setfarm.candidate-runtime-production-graph-binding.v2" as const;
export const CANDIDATE_RUNTIME_SOURCE_CHECKPOINT_V2_SCHEMA =
  "setfarm.candidate-runtime-source-checkpoint.v2" as const;
export const CANDIDATE_NPM_PROCESS_OUTCOME_V2_SCHEMA =
  "setfarm.candidate-npm-process-outcome.v2" as const;

export const CANDIDATE_RUNTIME_BUNDLE_V2_MAX_CANONICAL_BYTES = 384 * 1024;
export const CANDIDATE_RUNTIME_PACKAGE_JSON_MAX_BYTES_V2 = 4 * 1024 * 1024;
export const CANDIDATE_RUNTIME_ARTIFACT_ENVELOPE_MAX_BYTES_V2 = 16 * 1024 * 1024;

export const CANDIDATE_RUNTIME_BUNDLE_V2_BLOCKER_CODES = Object.freeze([
  "CANDIDATE_RUNTIME_BUNDLE_V2_ATOMIC_ARTIFACT_SET_ACTIVATION_UNVERIFIED",
  "CANDIDATE_RUNTIME_BUNDLE_V2_EVIDENCE_PLAN_V2_UNVERIFIED",
  "CANDIDATE_RUNTIME_BUNDLE_V2_LAUNCH_AUTHORITY_UNVERIFIED",
  "CANDIDATE_RUNTIME_BUNDLE_V2_REGISTRY_V2_UNVERIFIED",
] as const);

export const CANDIDATE_NPM_PROCESS_POLICY_V2 = Object.freeze({
  stdin: "closed" as const,
  timeoutMs: 120_000 as const,
  maxStdoutBytes: 65_536 as const,
  maxStderrBytes: 65_536 as const,
  shell: "forbidden" as const,
  ambientEnvironment: "forbidden" as const,
  outputLimitDisposition: "typed_runtime_bundle_rejection" as const,
  timeoutDisposition: "typed_runtime_bundle_rejection" as const,
  nonzeroOrSignalDisposition: "typed_runtime_bundle_rejection" as const,
});

export const CANDIDATE_NPM_DIRECT_ARGV_V2 = Object.freeze([
  "npm",
  "ci",
  "--omit=dev",
  "--ignore-scripts",
  "--no-audit",
  "--no-fund",
] as const);

export const CANDIDATE_NPM_DIRECT_ARGV_HASH_V2 = hashCanonicalJson({
  schema: "setfarm.candidate-runtime-npm-direct-argv-hash.v2",
  directArgv: CANDIDATE_NPM_DIRECT_ARGV_V2,
});

export const CandidateRuntimeBundleProducerV2Schema = z.object({
  pass: z.literal("candidate-runtime-bundle-authority-v2"),
  codeSha: GitCodeShaSchema,
  toolVersions: z.object({
    candidateRuntimeBundle: z.literal(CANDIDATE_RUNTIME_BUNDLE_V2_VERSION),
    candidateBuild: z.literal("2.1.0"),
    candidateSource: z.literal("1.0.0"),
    canonicalRuntimeTree: z.literal("2.0.0"),
    productionPackageResolutionGraph: z.literal("2.0.0"),
  }).strict(),
}).strict();

export type CandidateRuntimeBundleProducerV2 = z.infer<
  typeof CandidateRuntimeBundleProducerV2Schema
>;

export const CandidateRuntimeTreeArtifactRefV2Schema = z.object({
  schema: z.literal(CANDIDATE_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA),
  artifactType: z.literal(CANONICAL_RUNTIME_TREE_V2_SCHEMA),
  envelopeHash: Sha256Schema,
  envelopeByteLength: z.number().int().positive()
    .max(CANDIDATE_RUNTIME_ARTIFACT_ENVELOPE_MAX_BYTES_V2),
  producer: CandidateRuntimeBundleProducerV2Schema,
}).strict();

export type CandidateRuntimeTreeArtifactRefV2 = z.infer<
  typeof CandidateRuntimeTreeArtifactRefV2Schema
>;

export const CandidateProductionGraphArtifactRefV2Schema = z.object({
  schema: z.literal(CANDIDATE_PRODUCTION_GRAPH_ARTIFACT_REF_V2_SCHEMA),
  artifactType: z.literal(PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA),
  envelopeHash: Sha256Schema,
  envelopeByteLength: z.number().int().positive()
    .max(CANDIDATE_RUNTIME_ARTIFACT_ENVELOPE_MAX_BYTES_V2),
  producer: CandidateRuntimeBundleProducerV2Schema,
}).strict();

export type CandidateProductionGraphArtifactRefV2 = z.infer<
  typeof CandidateProductionGraphArtifactRefV2Schema
>;

const CandidateNpmProductionMaterializationConfigIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  executable: z.literal("npm"),
  commandRef: z.literal("MATERIALIZE_CANDIDATE_PRODUCTION_DEPENDENCIES_V2"),
  subcommand: z.literal("ci"),
  arguments: z.tuple([
    z.literal("--omit=dev"),
    z.literal("--ignore-scripts"),
    z.literal("--no-audit"),
    z.literal("--no-fund"),
  ]),
  dependencySelection: z.literal("production_only"),
  outputRoot: z.literal("candidate-bundle/node_modules"),
  lifecycleScripts: z.literal("forbidden"),
}).strict();

export function hashCandidateNpmProductionMaterializationConfigV2(
  value: z.input<typeof CandidateNpmProductionMaterializationConfigIdentityV2Schema>
    | Readonly<Record<string, unknown>>,
): string {
  const config = { ...value } as Record<string, unknown>;
  delete config.configHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-npm-production-materialization-config-hash.v2",
    config,
  });
}

export const CandidateNpmProductionMaterializationConfigV2Schema =
  CandidateNpmProductionMaterializationConfigIdentityV2Schema.extend({
    configHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.configHash !== hashCandidateNpmProductionMaterializationConfigV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["configHash"],
        message: "Candidate npm materialization config hash mismatch",
      });
    }
  });

const CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_IDENTITY_V2 = {
  schema: CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  executable: "npm",
  commandRef: "MATERIALIZE_CANDIDATE_PRODUCTION_DEPENDENCIES_V2",
  subcommand: "ci",
  arguments: ["--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"],
  dependencySelection: "production_only",
  outputRoot: "candidate-bundle/node_modules",
  lifecycleScripts: "forbidden",
} as const;

export const CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2 =
  deepFreezePlatformReleaseJsonV2(
    CandidateNpmProductionMaterializationConfigV2Schema.parse({
      ...CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_IDENTITY_V2,
      configHash: hashCandidateNpmProductionMaterializationConfigV2(
        CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_IDENTITY_V2,
      ),
    }),
  );

const CandidateNpmMaterializationReceiptAbiPolicyIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2_SCHEMA),
  version: z.literal(CANDIDATE_RUNTIME_BUNDLE_V2_VERSION),
  receiptSchema: z.literal(CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA),
  recipeSchema: z.literal(CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA),
  outputRoot: z.literal("candidate-bundle/node_modules"),
  maxPackages: z.literal(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES),
  dependencySelection: z.literal("production_only"),
  lifecycleScripts: z.literal("forbidden"),
  successfulExitCode: z.literal(0),
  processAuthority: z.literal("authenticated_host_environment_and_exact_argv"),
  sourceFence: z.literal("package_manifest_and_lockfile_before_after"),
  productionGraphAuthority: z.literal("complete_indexed_artifact"),
}).strict();

export function hashCandidateNpmMaterializationReceiptAbiPolicyV2(
  value: z.input<typeof CandidateNpmMaterializationReceiptAbiPolicyIdentityV2Schema>
    | Readonly<Record<string, unknown>>,
): string {
  const policy = { ...value } as Record<string, unknown>;
  delete policy.policyHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-npm-materialization-receipt-abi-policy-hash.v2",
    policy,
  });
}

export const CandidateNpmMaterializationReceiptAbiPolicyV2Schema =
  CandidateNpmMaterializationReceiptAbiPolicyIdentityV2Schema.extend({
    policyHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.policyHash !== hashCandidateNpmMaterializationReceiptAbiPolicyV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["policyHash"],
        message: "Candidate npm receipt ABI policy hash mismatch",
      });
    }
  });

const CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_IDENTITY_V2 = {
  schema: CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2_SCHEMA,
  version: CANDIDATE_RUNTIME_BUNDLE_V2_VERSION,
  receiptSchema: CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  recipeSchema: CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA,
  outputRoot: "candidate-bundle/node_modules",
  maxPackages: EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES,
  dependencySelection: "production_only",
  lifecycleScripts: "forbidden",
  successfulExitCode: 0,
  processAuthority: "authenticated_host_environment_and_exact_argv",
  sourceFence: "package_manifest_and_lockfile_before_after",
  productionGraphAuthority: "complete_indexed_artifact",
} as const;

export const CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2 =
  deepFreezePlatformReleaseJsonV2(
    CandidateNpmMaterializationReceiptAbiPolicyV2Schema.parse({
      ...CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_IDENTITY_V2,
      policyHash: hashCandidateNpmMaterializationReceiptAbiPolicyV2(
        CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_IDENTITY_V2,
      ),
    }),
  );

const CandidateRuntimeApplicationTreeBindingIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_RUNTIME_APPLICATION_TREE_BINDING_V2_SCHEMA),
  treeSchema: z.literal(CANONICAL_RUNTIME_TREE_V2_SCHEMA),
  profile: z.literal("dist"),
  logicalRoot: z.literal("candidate-bundle/application"),
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

export type CandidateRuntimeApplicationTreeBindingHashPayloadV2 = z.infer<
  typeof CandidateRuntimeApplicationTreeBindingIdentityV2Schema
>;

export function hashCandidateRuntimeApplicationTreeBindingV2(
  value:
    | CandidateRuntimeApplicationTreeBindingHashPayloadV2
    | CandidateRuntimeApplicationTreeBindingV2,
): string {
  const binding = { ...value } as Record<string, unknown>;
  delete binding.bindingHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-runtime-application-tree-binding-hash.v2",
    binding,
  });
}

export const CandidateRuntimeApplicationTreeBindingV2Schema =
  CandidateRuntimeApplicationTreeBindingIdentityV2Schema.extend({
    bindingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.bindingHash !== hashCandidateRuntimeApplicationTreeBindingV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["bindingHash"],
        message: "Candidate application-tree binding hash must bind its exact artifact identity",
      });
    }
  });

export type CandidateRuntimeApplicationTreeBindingV2 = z.infer<
  typeof CandidateRuntimeApplicationTreeBindingV2Schema
>;

const CandidateRuntimeDependencyTreeBindingIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_RUNTIME_DEPENDENCY_TREE_BINDING_V2_SCHEMA),
  treeSchema: z.literal(CANONICAL_RUNTIME_TREE_V2_SCHEMA),
  profile: z.literal("dependencies"),
  logicalRoot: z.literal("candidate-bundle/node_modules"),
  treeArtifact: CandidateRuntimeTreeArtifactRefV2Schema,
  treeHash: Sha256Schema,
  treePayloadHash: Sha256Schema,
  fileCount: z.number().int().nonnegative()
    .max(CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies.maxFiles),
  directoryCount: z.number().int().nonnegative()
    .max(CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies.maxDirectories),
  totalBytes: z.number().int().nonnegative()
    .max(CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies.maxTotalBytes),
}).strict();

export type CandidateRuntimeDependencyTreeBindingHashPayloadV2 = z.infer<
  typeof CandidateRuntimeDependencyTreeBindingIdentityV2Schema
>;

export function hashCandidateRuntimeDependencyTreeBindingV2(
  value:
    | CandidateRuntimeDependencyTreeBindingHashPayloadV2
    | CandidateRuntimeDependencyTreeBindingV2,
): string {
  const binding = { ...value } as Record<string, unknown>;
  delete binding.bindingHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-runtime-dependency-tree-binding-hash.v2",
    binding,
  });
}

export const CandidateRuntimeDependencyTreeBindingV2Schema =
  CandidateRuntimeDependencyTreeBindingIdentityV2Schema.extend({
    bindingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.bindingHash !== hashCandidateRuntimeDependencyTreeBindingV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["bindingHash"],
        message: "Candidate dependency-tree binding hash must bind its exact artifact identity",
      });
    }
  });

export type CandidateRuntimeDependencyTreeBindingV2 = z.infer<
  typeof CandidateRuntimeDependencyTreeBindingV2Schema
>;

export const CandidateRuntimePackageJsonRefV2Schema = z.object({
  schema: z.literal(CANDIDATE_RUNTIME_PACKAGE_JSON_REF_V2_SCHEMA),
  logicalLocator: z.literal("candidate-bundle/package.json"),
  mediaType: z.literal("application/json"),
  contentHash: Sha256Schema,
  byteLength: z.number().int().positive()
    .max(CANDIDATE_RUNTIME_PACKAGE_JSON_MAX_BYTES_V2),
  mode: z.literal("0444"),
}).strict();

export type CandidateRuntimePackageJsonRefV2 = z.infer<
  typeof CandidateRuntimePackageJsonRefV2Schema
>;

export const CandidateRuntimeSourceBindingV2Schema = z.object({
  schema: z.literal(CANDIDATE_RUNTIME_SOURCE_BINDING_V2_SCHEMA),
  candidateSourceEnvelopeHash: Sha256Schema,
  candidateSourceReceiptHash: Sha256Schema,
  semanticRevisionHash: Sha256Schema,
}).strict();

export type CandidateRuntimeSourceBindingV2 = z.infer<
  typeof CandidateRuntimeSourceBindingV2Schema
>;

const CandidateRuntimeSourceCheckpointIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_RUNTIME_SOURCE_CHECKPOINT_V2_SCHEMA),
  candidateSourceReceiptHash: Sha256Schema,
  semanticRevisionHash: Sha256Schema,
  packageJson: z.object({
    locator: z.literal("package.json"),
    mediaType: z.literal("application/json"),
    contentHash: Sha256Schema,
    byteLength: z.number().int().positive()
      .max(CANDIDATE_RUNTIME_PACKAGE_JSON_MAX_BYTES_V2),
  }).strict(),
  lockfile: ExactPackageLockSourceRefV2Schema,
}).strict();

export type CandidateRuntimeSourceCheckpointHashPayloadV2 = z.infer<
  typeof CandidateRuntimeSourceCheckpointIdentityV2Schema
>;

export function hashCandidateRuntimeSourceCheckpointV2(
  value:
    | CandidateRuntimeSourceCheckpointHashPayloadV2
    | CandidateRuntimeSourceCheckpointV2,
): string {
  const checkpoint = { ...value } as Record<string, unknown>;
  delete checkpoint.checkpointHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-runtime-source-checkpoint-hash.v2",
    checkpoint,
  });
}

export const CandidateRuntimeSourceCheckpointV2Schema =
  CandidateRuntimeSourceCheckpointIdentityV2Schema.extend({
    checkpointHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.checkpointHash !== hashCandidateRuntimeSourceCheckpointV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["checkpointHash"],
        message: "Candidate runtime source checkpoint hash mismatch",
      });
    }
  });

export type CandidateRuntimeSourceCheckpointV2 = z.infer<
  typeof CandidateRuntimeSourceCheckpointV2Schema
>;

const CandidateRuntimeProductionGraphBindingIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_RUNTIME_PRODUCTION_GRAPH_BINDING_V2_SCHEMA),
  graphSchema: z.literal(PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA),
  graphArtifact: CandidateProductionGraphArtifactRefV2Schema,
  resolutionGraphHash: Sha256Schema,
  materializedDependencyTreeHash: Sha256Schema,
  packageCount: z.number().int().nonnegative()
    .max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES),
}).strict();

export type CandidateRuntimeProductionGraphBindingHashPayloadV2 = z.infer<
  typeof CandidateRuntimeProductionGraphBindingIdentityV2Schema
>;

export function hashCandidateRuntimeProductionGraphBindingV2(
  value:
    | CandidateRuntimeProductionGraphBindingHashPayloadV2
    | CandidateRuntimeProductionGraphBindingV2,
): string {
  const binding = { ...value } as Record<string, unknown>;
  delete binding.bindingHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-runtime-production-graph-binding-hash.v2",
    binding,
  });
}

export const CandidateRuntimeProductionGraphBindingV2Schema =
  CandidateRuntimeProductionGraphBindingIdentityV2Schema.extend({
    bindingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.bindingHash !== hashCandidateRuntimeProductionGraphBindingV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["bindingHash"],
        message: "Candidate production graph binding hash mismatch",
      });
    }
  });

export type CandidateRuntimeProductionGraphBindingV2 = z.infer<
  typeof CandidateRuntimeProductionGraphBindingV2Schema
>;

const CandidateNpmIdentityV2Schema = z.object({
  packageName: z.literal("npm"),
  version: z.literal("10.9.8"),
  executableRef: z.literal("TOOL_NODE_NPM_CLI_V2"),
  closureHash: Sha256Schema,
  cliContentHash: Sha256Schema,
  packageTreeHash: Sha256Schema,
}).strict();

const CandidateNpmProductionMaterializationRecipeIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA),
  commandRef: z.literal("MATERIALIZE_CANDIDATE_PRODUCTION_DEPENDENCIES_V2"),
  subcommand: z.literal("ci"),
  arguments: z.tuple([
    z.literal("--omit=dev"),
    z.literal("--ignore-scripts"),
    z.literal("--no-audit"),
    z.literal("--no-fund"),
  ]),
  dependencySelection: z.literal("production_only"),
  outputRoot: z.literal("candidate-bundle/node_modules"),
  lifecycleScripts: z.literal("forbidden"),
  configHash: z.literal(CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2.configHash),
  materializationReceiptSchema: z.literal(
    CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  ),
  materializationReceiptSchemaHash: z.literal(
    CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2.policyHash,
  ),
}).strict();

export type CandidateNpmProductionMaterializationRecipeHashPayloadV2 = z.infer<
  typeof CandidateNpmProductionMaterializationRecipeIdentityV2Schema
>;

export function hashCandidateNpmProductionMaterializationRecipeV2(
  value:
    | CandidateNpmProductionMaterializationRecipeHashPayloadV2
    | CandidateNpmProductionMaterializationRecipeV2
    | Readonly<Record<string, unknown>>,
): string {
  const recipe = { ...value } as Record<string, unknown>;
  delete recipe.recipeHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-npm-production-materialization-recipe-hash.v2",
    recipe,
  });
}

export const CandidateNpmProductionMaterializationRecipeV2Schema =
  CandidateNpmProductionMaterializationRecipeIdentityV2Schema.extend({
    recipeHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.recipeHash !== hashCandidateNpmProductionMaterializationRecipeV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["recipeHash"],
        message: "Candidate npm recipe hash must bind the exact code-owned install recipe",
      });
    }
  });

export type CandidateNpmProductionMaterializationRecipeV2 = z.infer<
  typeof CandidateNpmProductionMaterializationRecipeV2Schema
>;

const CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_IDENTITY_V2 = {
  schema: CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA,
  commandRef: "MATERIALIZE_CANDIDATE_PRODUCTION_DEPENDENCIES_V2",
  subcommand: "ci",
  arguments: ["--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"],
  dependencySelection: "production_only",
  outputRoot: "candidate-bundle/node_modules",
  lifecycleScripts: "forbidden",
  configHash: CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2.configHash,
  materializationReceiptSchema: CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  materializationReceiptSchemaHash:
    CANDIDATE_NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2.policyHash,
} as const;

export const CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2 =
  deepFreezePlatformReleaseJsonV2(
    CandidateNpmProductionMaterializationRecipeV2Schema.parse({
      ...CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_IDENTITY_V2,
      recipeHash: hashCandidateNpmProductionMaterializationRecipeV2(
        CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_IDENTITY_V2,
      ),
    }),
  );

export const CANDIDATE_RUNTIME_BUNDLE_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.candidate-runtime-bundle-contract.v2" as const,
  contractVersion: CANDIDATE_RUNTIME_BUNDLE_V2_VERSION,
  buildAuthority: "fresh_verified_candidate_build_v2" as const,
  sourceAuthority: "candidate_source_v1_content_first_fenced" as const,
  applicationAuthority: "candidate_build_owned_canonical_dist_tree" as const,
  dependencyAuthority:
    "runtime_bundle_owned_production_graph_and_canonical_dependency_tree" as const,
  installAuthority:
    "authenticated_host_npm_exact_environment_and_bounded_process" as const,
  rootAuthority: "every_and_only_private_read_only_candidate_bundle" as const,
  pathDisclosure: "forbidden" as const,
  gitPlaceholder: "forbidden" as const,
  productionUse: "forbidden" as const,
  configHash: CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2.configHash,
  recipeHash: CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2.recipeHash,
  processPolicy: CANDIDATE_NPM_PROCESS_POLICY_V2,
  blockerCodes: CANDIDATE_RUNTIME_BUNDLE_V2_BLOCKER_CODES,
});

export const CANDIDATE_RUNTIME_BUNDLE_CONTRACT_HASH_V2 = hashCanonicalJson(
  CANDIDATE_RUNTIME_BUNDLE_CONTRACT_V2,
);

const CandidateNpmProcessPolicyV2Schema = z.object({
  stdin: z.literal(CANDIDATE_NPM_PROCESS_POLICY_V2.stdin),
  timeoutMs: z.literal(CANDIDATE_NPM_PROCESS_POLICY_V2.timeoutMs),
  maxStdoutBytes: z.literal(CANDIDATE_NPM_PROCESS_POLICY_V2.maxStdoutBytes),
  maxStderrBytes: z.literal(CANDIDATE_NPM_PROCESS_POLICY_V2.maxStderrBytes),
  shell: z.literal(CANDIDATE_NPM_PROCESS_POLICY_V2.shell),
  ambientEnvironment: z.literal(CANDIDATE_NPM_PROCESS_POLICY_V2.ambientEnvironment),
  outputLimitDisposition: z.literal(
    CANDIDATE_NPM_PROCESS_POLICY_V2.outputLimitDisposition,
  ),
  timeoutDisposition: z.literal(CANDIDATE_NPM_PROCESS_POLICY_V2.timeoutDisposition),
  nonzeroOrSignalDisposition: z.literal(
    CANDIDATE_NPM_PROCESS_POLICY_V2.nonzeroOrSignalDisposition,
  ),
}).strict();

const CandidateNpmProcessOutcomeIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_NPM_PROCESS_OUTCOME_V2_SCHEMA),
  status: z.literal("exited_zero"),
  exitCode: z.literal(0),
  signal: z.null(),
  stdoutHash: Sha256Schema,
  stdoutBytes: z.number().int().nonnegative()
    .max(CANDIDATE_NPM_PROCESS_POLICY_V2.maxStdoutBytes),
  stderrHash: Sha256Schema,
  stderrBytes: z.number().int().nonnegative()
    .max(CANDIDATE_NPM_PROCESS_POLICY_V2.maxStderrBytes),
  processPolicy: CandidateNpmProcessPolicyV2Schema,
}).strict();

export type CandidateNpmProcessOutcomeHashPayloadV2 = z.infer<
  typeof CandidateNpmProcessOutcomeIdentityV2Schema
>;

export function hashCandidateNpmProcessOutcomeV2(
  value:
    | CandidateNpmProcessOutcomeHashPayloadV2
    | CandidateNpmProcessOutcomeV2,
): string {
  const outcome = { ...value } as Record<string, unknown>;
  delete outcome.outcomeHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-npm-process-outcome-hash.v2",
    outcome,
  });
}

export const CandidateNpmProcessOutcomeV2Schema =
  CandidateNpmProcessOutcomeIdentityV2Schema.extend({
    outcomeHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.outcomeHash !== hashCandidateNpmProcessOutcomeV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["outcomeHash"],
        message: "Candidate npm process outcome hash mismatch",
      });
    }
  });

export type CandidateNpmProcessOutcomeV2 = z.infer<
  typeof CandidateNpmProcessOutcomeV2Schema
>;

const CandidateNpmMaterializationReceiptIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(CANDIDATE_RUNTIME_BUNDLE_V2_VERSION),
  contractHash: z.literal(CANDIDATE_RUNTIME_BUNDLE_CONTRACT_HASH_V2),
  stage: z.literal("private_candidate_production_dependencies_verified"),
  producer: CandidateRuntimeBundleProducerV2Schema,
  outputRoot: z.literal("candidate-bundle/node_modules"),
  installRecipe: CandidateNpmProductionMaterializationRecipeV2Schema,
  recipeHash: Sha256Schema,
  npmIdentity: CandidateNpmIdentityV2Schema,
  hostToolchain: z.object({
    receiptHash: Sha256Schema,
    nodeIdentityHash: Sha256Schema,
    npmClosureHash: Sha256Schema,
  }).strict(),
  environment: z.object({
    receiptHash: Sha256Schema,
    environmentContractHash: Sha256Schema,
    effectiveConfigHash: Sha256Schema,
    environmentHash: Sha256Schema,
  }).strict(),
  processBinding: z.object({
    probeRef: z.literal("HOST_NPM_CANDIDATE_PRODUCTION_INSTALL_V2"),
    projectScopeHash: Sha256Schema,
    directArgvHash: Sha256Schema,
  }).strict(),
  sourceBefore: CandidateRuntimeSourceCheckpointV2Schema,
  sourceAfter: CandidateRuntimeSourceCheckpointV2Schema,
  productionGraph: CandidateRuntimeProductionGraphBindingV2Schema,
  dependencyTreeBindingHash: Sha256Schema,
  dependencyTreeHash: Sha256Schema,
  dependencyTreePayloadHash: Sha256Schema,
  packageCount: z.number().int().nonnegative()
    .max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES),
  lifecycleScripts: z.literal("forbidden"),
  processOutcome: CandidateNpmProcessOutcomeV2Schema,
}).strict();

export type CandidateNpmMaterializationReceiptHashPayloadV2 = z.infer<
  typeof CandidateNpmMaterializationReceiptIdentityV2Schema
>;

export function hashCandidateNpmMaterializationReceiptV2(
  value:
    | CandidateNpmMaterializationReceiptHashPayloadV2
    | CandidateNpmMaterializationReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-npm-materialization-receipt-hash.v2",
    receipt,
  });
}

export const CandidateNpmMaterializationReceiptV2Schema =
  CandidateNpmMaterializationReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.recipeHash !== value.installRecipe.recipeHash) {
      context.addIssue({
        code: "custom",
        path: ["recipeHash"],
        message: "Candidate npm receipt must join the exact embedded install recipe",
      });
    }
    if (value.outputRoot !== value.installRecipe.outputRoot) {
      context.addIssue({
        code: "custom",
        path: ["outputRoot"],
        message: "Candidate npm receipt and install recipe must bind the same output root",
      });
    }
    if (value.lifecycleScripts !== value.installRecipe.lifecycleScripts) {
      context.addIssue({
        code: "custom",
        path: ["lifecycleScripts"],
        message: "Candidate npm receipt and install recipe must forbid lifecycle scripts",
      });
    }
    if (
      canonicalJsonStringify(value.sourceBefore)
        !== canonicalJsonStringify(value.sourceAfter)
      || value.sourceBefore.lockfile.hash !== value.sourceAfter.lockfile.hash
      || value.sourceBefore.packageJson.contentHash
        !== value.sourceAfter.packageJson.contentHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceAfter"],
        message: "Candidate package manifest and lockfile must remain stable across npm materialization",
      });
    }
    if (
      value.processBinding.directArgvHash !== CANDIDATE_NPM_DIRECT_ARGV_HASH_V2
      || value.processOutcome.processPolicy.timeoutMs
        !== CANDIDATE_NPM_PROCESS_POLICY_V2.timeoutMs
    ) {
      context.addIssue({
        code: "custom",
        path: ["processBinding"],
        message: "Candidate npm receipt must bind the exact code-owned argv and process policy",
      });
    }
    if (
      value.productionGraph.materializedDependencyTreeHash
        !== value.dependencyTreeHash
      || value.productionGraph.packageCount !== value.packageCount
    ) {
      context.addIssue({
        code: "custom",
        path: ["productionGraph"],
        message: "Candidate npm receipt must join its production graph to the exact dependency tree",
      });
    }
    if (value.npmIdentity.closureHash !== value.hostToolchain.npmClosureHash) {
      context.addIssue({
        code: "custom",
        path: ["npmIdentity", "closureHash"],
        message: "Candidate npm identity must equal the authenticated host npm closure",
      });
    }
    if (
      canonicalJsonStringify(value.producer)
        !== canonicalJsonStringify(value.productionGraph.graphArtifact.producer)
    ) {
      context.addIssue({
        code: "custom",
        path: ["producer"],
        message: "Candidate npm receipt and production graph must have one code-owned producer",
      });
    }
    if (value.receiptHash !== hashCandidateNpmMaterializationReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Candidate npm receipt hash must bind lockfile, recipe, npm, graph, and dependency tree",
      });
    }
  });

export type CandidateNpmMaterializationReceiptV2 = z.infer<
  typeof CandidateNpmMaterializationReceiptV2Schema
>;

const CandidateRuntimeBundleIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_RUNTIME_BUNDLE_V2_SCHEMA),
  receiptVersion: z.literal(CANDIDATE_RUNTIME_BUNDLE_V2_VERSION),
  contractHash: z.literal(CANDIDATE_RUNTIME_BUNDLE_CONTRACT_HASH_V2),
  stage: z.literal("private_candidate_runtime_bundle_verified"),
  readiness: z.object({
    status: z.literal("verified_private_shadow"),
    productionUse: z.literal("forbidden"),
    blockerCodes: z.tuple([
      z.literal(CANDIDATE_RUNTIME_BUNDLE_V2_BLOCKER_CODES[0]),
      z.literal(CANDIDATE_RUNTIME_BUNDLE_V2_BLOCKER_CODES[1]),
      z.literal(CANDIDATE_RUNTIME_BUNDLE_V2_BLOCKER_CODES[2]),
      z.literal(CANDIDATE_RUNTIME_BUNDLE_V2_BLOCKER_CODES[3]),
    ]),
  }).strict(),
  producer: CandidateRuntimeBundleProducerV2Schema,
  packetEnvelopeHash: Sha256Schema,
  implementationClosureHash: Sha256Schema,
  buildTopologyHash: Sha256Schema,
  sourceAuthority: CandidateRuntimeSourceBindingV2Schema,
  buildReceiptHash: Sha256Schema,
  buildReceipt: CandidateBuildReceiptV2Schema,
  logicalRoot: z.literal("candidate-bundle"),
  rootMode: z.literal("0555"),
  allowedRootEntries: z.tuple([
    z.literal("application"),
    z.literal("node_modules"),
    z.literal("package.json"),
  ]),
  applicationTree: CandidateRuntimeApplicationTreeBindingV2Schema,
  dependencyTree: CandidateRuntimeDependencyTreeBindingV2Schema,
  productionGraph: CandidateRuntimeProductionGraphBindingV2Schema,
  packageJson: CandidateRuntimePackageJsonRefV2Schema,
  npmMaterializationReceipt: CandidateNpmMaterializationReceiptV2Schema,
  bundleClosureHash: Sha256Schema,
}).strict();

export type CandidateRuntimeBundleHashPayloadV2 = z.infer<
  typeof CandidateRuntimeBundleIdentityV2Schema
>;

export type CandidateRuntimeBundleClosureHashPayloadV2 = Readonly<Pick<
  CandidateRuntimeBundleHashPayloadV2,
  | "logicalRoot"
  | "rootMode"
  | "allowedRootEntries"
  | "applicationTree"
  | "dependencyTree"
  | "productionGraph"
  | "packageJson"
>>;

export function hashCandidateRuntimeBundleClosureV2(
  value:
    | CandidateRuntimeBundleClosureHashPayloadV2
    | CandidateRuntimeBundleHashPayloadV2
    | CandidateRuntimeBundleV2,
): string {
  const closure: CandidateRuntimeBundleClosureHashPayloadV2 = {
    logicalRoot: value.logicalRoot,
    rootMode: value.rootMode,
    allowedRootEntries: value.allowedRootEntries,
    applicationTree: value.applicationTree,
    dependencyTree: value.dependencyTree,
    productionGraph: value.productionGraph,
    packageJson: value.packageJson,
  };
  return hashCanonicalJson({
    schema: "setfarm.candidate-runtime-bundle-closure-hash.v2",
    closure,
  });
}

export function hashCandidateRuntimeBundleV2(
  value: CandidateRuntimeBundleHashPayloadV2 | CandidateRuntimeBundleV2,
): string {
  const bundle = { ...value } as Record<string, unknown>;
  delete bundle.bundleHash;
  return hashCanonicalJson({
    schema: "setfarm.candidate-runtime-bundle-hash.v2",
    bundle,
  });
}

function applicationEqualsBuildOutputV2(
  application: CandidateRuntimeApplicationTreeBindingV2,
  buildReceipt: CandidateBuildReceiptV2,
): boolean {
  const output = buildReceipt.outputTree;
  return application.treeSchema === output.treeSchema
    && application.profile === output.profile
    && application.treeHash === output.treeHash
    && application.treePayloadHash === output.treePayloadHash
    && application.fileCount === output.fileCount
    && application.directoryCount === output.directoryCount
    && application.totalBytes === output.totalBytes
    && canonicalJsonStringify(application.treeArtifact)
      === canonicalJsonStringify(output.treeArtifact);
}

export const CandidateRuntimeBundleV2Schema = CandidateRuntimeBundleIdentityV2Schema.extend({
  bundleHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const build = value.buildReceipt;
  if (
    value.packetEnvelopeHash !== build.authority.packet.envelopeHash
    || value.implementationClosureHash
      !== build.authority.implementationClosure.closureHash
    || value.buildTopologyHash !== build.authority.buildTopology.manifestHash
    || value.buildReceiptHash !== build.receiptHash
    || value.sourceAuthority.candidateSourceEnvelopeHash
      !== build.sourceAfter.candidateSourceEnvelopeHash
    || value.sourceAuthority.candidateSourceReceiptHash
      !== build.sourceAfter.candidateSourceReceiptHash
    || value.sourceAuthority.semanticRevisionHash
      !== build.sourceAfter.semanticRevisionHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["buildReceipt"],
      message: "Candidate runtime bundle must join the exact packet, topology, source, and build receipt",
    });
  }
  if (!applicationEqualsBuildOutputV2(value.applicationTree, build)) {
    context.addIssue({
      code: "custom",
      path: ["applicationTree"],
      message: "Candidate application tree must equal the exact successful build output identity",
    });
  }
  const npmReceipt = value.npmMaterializationReceipt;
  if (
    npmReceipt.dependencyTreeBindingHash !== value.dependencyTree.bindingHash
    || npmReceipt.dependencyTreeHash !== value.dependencyTree.treeHash
    || npmReceipt.dependencyTreePayloadHash !== value.dependencyTree.treePayloadHash
    || canonicalJsonStringify(npmReceipt.productionGraph)
      !== canonicalJsonStringify(value.productionGraph)
  ) {
    context.addIssue({
      code: "custom",
      path: ["npmMaterializationReceipt"],
      message: "Candidate npm receipt must bind the exact materialized dependency tree",
    });
  }
  if (
    npmReceipt.sourceAfter.packageJson.contentHash !== value.packageJson.contentHash
    || npmReceipt.sourceAfter.packageJson.byteLength !== value.packageJson.byteLength
    || npmReceipt.sourceAfter.candidateSourceReceiptHash
      !== value.sourceAuthority.candidateSourceReceiptHash
    || npmReceipt.sourceAfter.semanticRevisionHash
      !== value.sourceAuthority.semanticRevisionHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["packageJson"],
      message: "Candidate bundle package manifest must equal the fenced source manifest",
    });
  }
  if (
    canonicalJsonStringify(value.producer)
      !== canonicalJsonStringify(npmReceipt.producer)
    || canonicalJsonStringify(value.producer)
      !== canonicalJsonStringify(value.dependencyTree.treeArtifact.producer)
    || canonicalJsonStringify(value.producer)
      !== canonicalJsonStringify(value.productionGraph.graphArtifact.producer)
    || value.producer.codeSha !== build.producer.codeSha
  ) {
    context.addIssue({
      code: "custom",
      path: ["producer"],
      message: "Candidate bundle, npm, dependency tree, graph and build must join code-owned producers",
    });
  }
  if (
    canonicalJsonStringify(value.readiness.blockerCodes)
      !== canonicalJsonStringify(CANDIDATE_RUNTIME_BUNDLE_V2_BLOCKER_CODES)
  ) {
    context.addIssue({
      code: "custom",
      path: ["readiness", "blockerCodes"],
      message: "Candidate runtime blocker set must be code-owned and complete",
    });
  }
  if (value.bundleClosureHash !== hashCandidateRuntimeBundleClosureV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["bundleClosureHash"],
      message: "Candidate bundle closure hash must bind every and only runtime-root entry",
    });
  }
  if (!platformReleaseCandidateFitsCanonicalCapV2(
    value,
    CANDIDATE_RUNTIME_BUNDLE_V2_MAX_CANONICAL_BYTES,
  )) {
    context.addIssue({
      code: "custom",
      message: `Candidate runtime bundle exceeds ${CANDIDATE_RUNTIME_BUNDLE_V2_MAX_CANONICAL_BYTES} canonical bytes`,
    });
    return;
  }
  if (value.bundleHash !== hashCandidateRuntimeBundleV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["bundleHash"],
      message: "Candidate runtime bundle hash must bind the exact domain-separated bundle",
    });
  }
});

export type CandidateRuntimeBundleV2 = z.infer<
  typeof CandidateRuntimeBundleV2Schema
>;

export function parseCandidateRuntimeBundleV2(input: unknown): CandidateRuntimeBundleV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    CANDIDATE_RUNTIME_BUNDLE_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    CandidateRuntimeBundleV2Schema.parse(snapshot),
  );
}
