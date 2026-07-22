import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
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
} from "./external-runtime-resolution-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  PlatformReleaseStableReferenceV2Schema,
  PlatformReleaseVersionIdentityV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const CANDIDATE_RUNTIME_BUNDLE_V2_SCHEMA =
  "setfarm.candidate-runtime-bundle.v2" as const;
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

export const CANDIDATE_RUNTIME_BUNDLE_V2_MAX_CANONICAL_BYTES = 384 * 1024;
export const CANDIDATE_RUNTIME_PACKAGE_JSON_MAX_BYTES_V2 = 4 * 1024 * 1024;

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
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  receiptSchema: z.literal(CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA),
  recipeSchema: z.literal(CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA),
  outputRoot: z.literal("candidate-bundle/node_modules"),
  maxPackages: z.literal(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES),
  dependencySelection: z.literal("production_only"),
  lifecycleScripts: z.literal("forbidden"),
  successfulExitCode: z.literal(0),
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
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  receiptSchema: CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  recipeSchema: CANDIDATE_NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA,
  outputRoot: "candidate-bundle/node_modules",
  maxPackages: EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES,
  dependencySelection: "production_only",
  lifecycleScripts: "forbidden",
  successfulExitCode: 0,
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
  treeArtifact: CandidateCanonicalRuntimeTreeArtifactRefV2Schema,
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

const CandidateNpmIdentityV2Schema = z.object({
  packageName: z.literal("npm"),
  version: PlatformReleaseVersionIdentityV2Schema,
  executableRef: PlatformReleaseStableReferenceV2Schema,
  executableHash: Sha256Schema,
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

const CandidateNpmMaterializationReceiptIdentityV2Schema = z.object({
  schema: z.literal(CANDIDATE_NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA),
  outputRoot: z.literal("candidate-bundle/node_modules"),
  lockfile: ExactPackageLockSourceRefV2Schema,
  installRecipe: CandidateNpmProductionMaterializationRecipeV2Schema,
  recipeHash: Sha256Schema,
  npmIdentity: CandidateNpmIdentityV2Schema,
  productionPackageResolutionGraphHash: Sha256Schema,
  dependencyTreeBindingHash: Sha256Schema,
  dependencyTreeHash: Sha256Schema,
  dependencyTreePayloadHash: Sha256Schema,
  packageCount: z.number().int().nonnegative()
    .max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES),
  lifecycleScripts: z.literal("forbidden"),
  exitCode: z.literal(0),
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
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("candidate_unverified"),
  productionUse: z.literal("forbidden"),
  packetEnvelopeHash: Sha256Schema,
  buildTopologyHash: Sha256Schema,
  sourceAuthority: z.object({
    schema: z.literal(CANDIDATE_RUNTIME_SOURCE_BINDING_V2_SCHEMA),
    candidateSourceEnvelopeHash: Sha256Schema,
    candidateSourceReceiptHash: Sha256Schema,
    semanticRevisionHash: Sha256Schema,
  }).strict(),
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
  ) {
    context.addIssue({
      code: "custom",
      path: ["npmMaterializationReceipt"],
      message: "Candidate npm receipt must bind the exact materialized dependency tree",
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
