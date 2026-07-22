import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { hashCanonicalJson } from "../canonical-json.js";
import {
  NormalizedRelativeLocatorSchema,
  PathBindingIdSchema,
  ProductIdSchema,
  Sha256Schema,
  StableReferenceSchema,
  StoryIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  asciiCaseFoldPathV2,
  hashPortablePathCaseFoldIdentityV2,
  hashPortablePathIdentityV2,
  portablePathIssuesV2,
} from "./path-token-v2.js";
import {
  GeneratorMemberKindV2Schema,
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2,
  NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2,
  NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
  SEMANTIC_REALIZATION_PLAN_CONTRACT_HASH_V2,
  SEMANTIC_REALIZATION_PLAN_V2_SCHEMA,
  hashNodeProductRuntimeGeneratorProfileV2,
  hashNodeProductTestGeneratorProfileV2,
} from "./semantic-realization-plan-v2.js";
import {
  SemanticSourceResponsibilityV1Schema,
  SemanticSourceSubjectKindV1Schema,
} from "./stack-semantic-source-rules-v1.js";

export const FILE_TREE_MANIFEST_V3_SCHEMA =
  "setfarm.file-tree-manifest.v3" as const;
export const FILE_TREE_MANIFEST_VERSION_V3 = "3.0.0" as const;
export const FILE_TREE_MANIFEST_MAX_CANONICAL_BYTES_V3 = 4 * 1024 * 1024;
export const FILE_TREE_MANIFEST_BOUNDED_WORK_LIMITS_V3 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 16,
  maxNodes: FILE_TREE_MANIFEST_MAX_CANONICAL_BYTES_V3 + 40_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (FILE_TREE_MANIFEST_MAX_CANONICAL_BYTES_V3 * 8) + (2 * 1024 * 1024),
});

export const FILE_TREE_MANIFEST_BLOCKER_CODES_V3 = Object.freeze([
  "FILE_TREE_V3_BUILD_TOPOLOGY_V3_UNVERIFIED",
  "FILE_TREE_V3_EVIDENCE_REGISTRY_UNVERIFIED",
  "FILE_TREE_V3_NODE_RUNTIME_GENERATOR_UNVERIFIED",
  "FILE_TREE_V3_NODE_RUNTIME_SOURCE_RECEIPT_UNVERIFIED",
  "FILE_TREE_V3_NODE_TEST_GENERATOR_UNVERIFIED",
  "FILE_TREE_V3_NODE_TEST_SOURCE_RECEIPT_UNVERIFIED",
  "FILE_TREE_V3_RELEASE_MANIFEST_UNVERIFIED",
] as const);

export const FILE_TREE_MANIFEST_CONTRACT_V3 = Object.freeze({
  schema: "setfarm.file-tree-manifest-contract.v3" as const,
  contractVersion: FILE_TREE_MANIFEST_VERSION_V3,
  stage: "realization_targets_planned_on_verified_scaffold_base" as const,
  nativeSourceAuthorities: Object.freeze([
    "product_spec_v2",
    "product_delivery_selection_v2",
    "semantic_realization_plan_v2",
    "node_execution_layout_v2",
    "node_execution_path_token_set_v2",
  ] as const),
  compatibilityScaffoldEvidence: Object.freeze([
    "node_scaffold_toolchain_catalog_v2",
    "scaffold_base_semantic_input_hash_v2",
    "scaffold_base_state_hash_v2",
  ] as const),
  forbiddenNativeInputs: Object.freeze([
    "file_tree_manifest_v2",
    "semantic_source_path_token_set_v2",
    "story_write_grants",
  ] as const),
  pathAuthorities: Object.freeze([
    "scaffold_asset",
    "project_npmrc_absence",
    "generated_runtime_source_target",
    "generated_test_source_target",
  ] as const),
  ownership: Object.freeze({
    setup: "three_exact_readonly_scaffold_files_plus_npmrc_absence" as const,
    runtime: "one_code_owned_whole_file_generator" as const,
    test: "one_code_owned_whole_file_generator" as const,
    storyOwners: "forbidden" as const,
    writeGrants: "forbidden" as const,
    modelWrites: "forbidden" as const,
  }),
  cardinality: Object.freeze({
    owners: 3 as const,
    paths: 6 as const,
    scaffoldFiles: 3 as const,
    npmrcAbsences: 1 as const,
    runtimeSourceTargets: 1 as const,
    testSourceTargets: 1 as const,
  }),
  delegatedToBuildTopologyV3: Object.freeze([
    "runtime_build_output",
    "test_build_output",
    "candidate_runtime_module",
    "build_test_runtime_commands",
    "dependency_receipt",
    "readonly_dependency_runtime_capsule",
  ] as const),
  physicalAttemptProjection: Object.freeze({
    disposition: "forbidden_from_logical_manifest_identity" as const,
    excludedFields: Object.freeze([
      "admissionScope",
      "physicalIdentityHash",
      "privateRootIdentityHash",
      "scaffoldBaseReceiptHash",
    ] as const),
  }),
  blockerCodes: FILE_TREE_MANIFEST_BLOCKER_CODES_V3,
  hashDomains: Object.freeze({
    pathRef: "setfarm.file-tree-path-ref.v3" as const,
    pathAbsence: "setfarm.file-tree-path-absence.v3" as const,
    pathEntry: "setfarm.file-tree-path-entry-hash.v3" as const,
    runtimeBindings: "setfarm.file-tree-runtime-binding-membership-hash.v3" as const,
    testCoverage: "setfarm.file-tree-test-coverage-membership-hash.v3" as const,
    ownerMembership: "setfarm.file-tree-owner-membership-hash.v3" as const,
    pathMembership: "setfarm.file-tree-path-membership-hash.v3" as const,
    manifest: "setfarm.file-tree-manifest-hash.v3" as const,
  }),
} as const);

export const FILE_TREE_MANIFEST_CONTRACT_HASH_V3 = hashCanonicalJson(
  FILE_TREE_MANIFEST_CONTRACT_V3,
);

const FileTreeBlockerCodeV3Schema = z.enum(FILE_TREE_MANIFEST_BLOCKER_CODES_V3);
const FileTreeProfileIdV3Schema = z.enum([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);
const FileTreeStackPackIdV3Schema = z.enum(["node-cli", "node-express-api"]);

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalStrings(values: readonly string[]): boolean {
  return hasUniqueStrings(values)
    && values.every((value, index) =>
      index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

export function deriveFileTreePathRefV3(
  physicalSpace: "repository",
  normalizedLocator: string,
): string {
  return `PATH_${hashCanonicalJson({
    schema: "setfarm.file-tree-path-ref.v3",
    physicalSpace,
    normalizedLocator,
  }).toUpperCase()}`;
}

export function hashFileTreePathAbsenceV3(
  physicalSpace: "repository",
  normalizedLocator: string,
): string {
  return hashCanonicalJson({
    schema: "setfarm.file-tree-path-absence.v3",
    physicalSpace,
    normalizedLocator,
  });
}

const FileTreeSetupOwnerV3Schema = z.object({
  ownerRef: z.literal("OWNER_SETUP_V3"),
  kind: z.literal("setup"),
}).strict();

const FileTreeRuntimeGeneratorOwnerV3Schema = z.object({
  ownerRef: z.literal("OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2"),
  kind: z.literal("generator"),
  generatorRef: z.literal("NODE_PRODUCT_RUNTIME_GENERATOR_V2"),
}).strict();

const FileTreeTestGeneratorOwnerV3Schema = z.object({
  ownerRef: z.literal("OWNER_NODE_PRODUCT_TEST_GENERATOR_V2"),
  kind: z.literal("generator"),
  generatorRef: z.literal("NODE_PRODUCT_TEST_GENERATOR_V2"),
}).strict();

export const FileTreeOwnerV3Schema = z.discriminatedUnion("ownerRef", [
  FileTreeRuntimeGeneratorOwnerV3Schema,
  FileTreeTestGeneratorOwnerV3Schema,
  FileTreeSetupOwnerV3Schema,
]);

export type FileTreeOwnerV3 = z.infer<typeof FileTreeOwnerV3Schema>;

const FileTreePresentFileStateV3Schema = z.object({
  state: z.literal("present_file"),
  mode: z.literal("0444"),
  contentHash: Sha256Schema,
  byteLength: z.number().int().positive().max(16 * 1024 * 1024),
}).strict();

const FileTreeAbsentStateV3Schema = z.object({
  state: z.literal("absent"),
  absenceHash: Sha256Schema,
  evidence: z.enum([
    "private_scaffold_base_exact_inventory_v2",
    "private_scaffold_base_source_root_absence_v2",
  ]),
}).strict();

export const FileTreeCurrentStateV3Schema = z.discriminatedUnion("state", [
  FileTreePresentFileStateV3Schema,
  FileTreeAbsentStateV3Schema,
]);

export type FileTreeCurrentStateV3 = z.infer<typeof FileTreeCurrentStateV3Schema>;

export const FileTreeRuntimeRealizationBindingV3Schema = z.object({
  realizationRef: StableReferenceSchema,
  realizationHash: Sha256Schema,
  intentRef: StableReferenceSchema,
  intentHash: Sha256Schema,
  subjectKind: SemanticSourceSubjectKindV1Schema,
  subjectRef: StableReferenceSchema,
  subjectHash: Sha256Schema,
  responsibility: SemanticSourceResponsibilityV1Schema,
  storyId: StoryIdSchema.nullable(),
  memberKind: GeneratorMemberKindV2Schema,
}).strict();

export type FileTreeRuntimeRealizationBindingV3 = z.infer<
  typeof FileTreeRuntimeRealizationBindingV3Schema
>;

export function hashFileTreeRuntimeBindingMembershipV3(
  bindings: readonly FileTreeRuntimeRealizationBindingV3[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.file-tree-runtime-binding-membership-hash.v3",
    bindings,
  });
}

export const FileTreeTestCoverageBindingV3Schema = z.object({
  coverageKind: z.enum(["action", "evidence_relation"]),
  realizationRef: StableReferenceSchema,
  realizationHash: Sha256Schema,
  intentRef: StableReferenceSchema,
  intentHash: Sha256Schema,
  subjectKind: z.enum(["action", "evidence_predicate"]),
  subjectRef: StableReferenceSchema,
  subjectHash: Sha256Schema,
  storyId: StoryIdSchema.nullable(),
}).strict().superRefine((value, context) => {
  if (
    (value.coverageKind === "action" && value.subjectKind === "action")
    || (
      value.coverageKind === "evidence_relation"
      && value.subjectKind === "evidence_predicate"
    )
  ) return;
  context.addIssue({
    code: "custom",
    path: ["subjectKind"],
    message: "Generated test coverage kind and semantic subject kind must join",
  });
});

export type FileTreeTestCoverageBindingV3 = z.infer<
  typeof FileTreeTestCoverageBindingV3Schema
>;

export function hashFileTreeTestCoverageMembershipV3(
  bindings: readonly FileTreeTestCoverageBindingV3[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.file-tree-test-coverage-membership-hash.v3",
    bindings,
  });
}

const FileTreeScaffoldAssetAuthorityV3Schema = z.object({
  kind: z.literal("scaffold_asset"),
  scaffoldBaseSemanticInputHash: Sha256Schema,
  scaffoldBaseStateHash: Sha256Schema,
  assetRole: z.enum([
    "package_manifest",
    "dependency_lock_manifest",
    "typescript_compiler_config",
  ]),
  pathSlotRef: z.enum([
    "PATH_SLOT_NODE_PACKAGE_JSON_V2",
    "PATH_SLOT_NODE_PACKAGE_LOCK_JSON_V2",
    "PATH_SLOT_NODE_TSCONFIG_JSON_V2",
  ]),
  pathToken: Sha256Schema,
  tokenBindingHash: Sha256Schema,
  deepVerificationReceiptHash: Sha256Schema,
  consumerBindingHash: Sha256Schema,
  compatibilityDisposition: z.literal("f4_scaffold_bytes_only"),
}).strict();

const FileTreeNpmrcAbsenceAuthorityV3Schema = z.object({
  kind: z.literal("project_npmrc_absence"),
  scaffoldBaseSemanticInputHash: Sha256Schema,
  scaffoldBaseStateHash: Sha256Schema,
}).strict();

const FileTreeGeneratedRuntimeAuthorityV3Schema = z.object({
  kind: z.literal("generated_runtime_source_target"),
  realizationPlanHash: Sha256Schema,
  realizationMembershipHash: Sha256Schema,
  generatorRef: z.literal("NODE_PRODUCT_RUNTIME_GENERATOR_V2"),
  generatorContractHash: z.literal(
    NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
  ),
  generatorProfileHash: Sha256Schema,
  sourcePathSlotRef: z.enum([
    "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
    "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
  ]),
  sourceReceiptSchema: z.literal(NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA),
  sourceReceiptState: z.literal("absent"),
  modelWriteAuthority: z.literal("forbidden"),
  realizationBindingCount: z.number().int().positive().max(20_000),
  realizationBindings: z.array(FileTreeRuntimeRealizationBindingV3Schema)
    .min(1).max(20_000),
  realizationBindingMembershipHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const refs = value.realizationBindings.map((binding) => binding.realizationRef);
  if (
    value.realizationBindingCount === value.realizationBindings.length
    && canonicalStrings(refs)
    && value.realizationBindingMembershipHash
      === hashFileTreeRuntimeBindingMembershipV3(value.realizationBindings)
  ) return;
  context.addIssue({
    code: "custom",
    path: ["realizationBindings"],
    message: "Runtime realization bindings must be complete, canonical and hashed",
  });
});

const FileTreeGeneratedTestAuthorityV3Schema = z.object({
  kind: z.literal("generated_test_source_target"),
  realizationPlanHash: Sha256Schema,
  realizationMembershipHash: Sha256Schema,
  generatorRef: z.literal("NODE_PRODUCT_TEST_GENERATOR_V2"),
  generatorContractHash: z.literal(NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2),
  generatorProfileHash: Sha256Schema,
  sourcePathRef: z.enum([
    "PATH_NODE_CLI_GENERATED_TEST_SOURCE_V2",
    "PATH_NODE_API_GENERATED_TEST_SOURCE_V2",
  ]),
  compiledPathRef: z.enum([
    "PATH_NODE_CLI_GENERATED_TEST_OUTPUT_V2",
    "PATH_NODE_API_GENERATED_TEST_OUTPUT_V2",
  ]),
  runtimeImportSpecifier: z.enum(["./cli.js", "./app.js"]),
  runnerAbi: z.literal("NODE_TEST_RUNNER_DIRECT_FILE_ABI_V2"),
  sourceReceiptSchema: z.literal(NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA),
  sourceReceiptState: z.literal("absent"),
  modelWriteAuthority: z.literal("forbidden"),
  coverageBindingCount: z.number().int().positive().max(20_000),
  coverageBindings: z.array(FileTreeTestCoverageBindingV3Schema).min(1).max(20_000),
  coverageMembershipHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const keys = value.coverageBindings.map((binding) =>
    `${binding.coverageKind}\0${binding.subjectRef}\0${binding.realizationRef}`);
  if (
    value.coverageBindingCount === value.coverageBindings.length
    && canonicalStrings(keys)
    && value.coverageMembershipHash
      === hashFileTreeTestCoverageMembershipV3(value.coverageBindings)
  ) return;
  context.addIssue({
    code: "custom",
    path: ["coverageBindings"],
    message: "Generated test coverage must be complete, canonical and hashed",
  });
});

export const FileTreePathAuthorityV3Schema = z.discriminatedUnion("kind", [
  FileTreeScaffoldAssetAuthorityV3Schema,
  FileTreeNpmrcAbsenceAuthorityV3Schema,
  FileTreeGeneratedRuntimeAuthorityV3Schema,
  FileTreeGeneratedTestAuthorityV3Schema,
]);

export type FileTreePathAuthorityV3 = z.infer<
  typeof FileTreePathAuthorityV3Schema
>;

const FileTreePathEntryIdentityV3Schema = z.object({
  pathRef: PathBindingIdSchema,
  physicalSpace: z.literal("repository"),
  normalizedLocator: NormalizedRelativeLocatorSchema,
  pathIdentityHash: Sha256Schema,
  caseFoldPathIdentityHash: Sha256Schema,
  classification: z.enum([
    "config",
    "config_absence",
    "generated_runtime_source",
    "generated_test_source",
  ]),
  ownerRef: z.enum([
    "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2",
    "OWNER_NODE_PRODUCT_TEST_GENERATOR_V2",
    "OWNER_SETUP_V3",
  ]),
  writeGrantOwnerRefs: z.tuple([]),
  access: z.enum([
    "forbidden",
    "generator_whole_file_future",
    "setup_readonly",
  ]),
  currentState: FileTreeCurrentStateV3Schema,
  authority: FileTreePathAuthorityV3Schema,
}).strict();

export type FileTreePathEntryHashPayloadV3 = z.infer<
  typeof FileTreePathEntryIdentityV3Schema
>;

export function hashFileTreePathEntryV3(
  value: FileTreePathEntryHashPayloadV3 | FileTreePathEntryV3,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.entryHash;
  return hashCanonicalJson({
    schema: "setfarm.file-tree-path-entry-hash.v3",
    entry: payload,
  });
}

export const FileTreePathEntryV3Schema = FileTreePathEntryIdentityV3Schema.extend({
  entryHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  for (const issue of portablePathIssuesV2(
    value.normalizedLocator,
    { allowEmpty: false },
  )) {
    context.addIssue({
      code: "custom",
      path: ["normalizedLocator"],
      message: issue,
    });
  }
  if (
    value.pathRef !== deriveFileTreePathRefV3(
      value.physicalSpace,
      value.normalizedLocator,
    )
    || value.pathIdentityHash
      !== hashPortablePathIdentityV2(value.physicalSpace, value.normalizedLocator)
    || value.caseFoldPathIdentityHash
      !== hashPortablePathCaseFoldIdentityV2(
        value.physicalSpace,
        value.normalizedLocator,
      )
  ) {
    context.addIssue({
      code: "custom",
      path: ["pathRef"],
      message: "V3 path identity must bind exact and ASCII-folded locator authority",
    });
  }
  if (
    value.currentState.state === "absent"
    && value.currentState.absenceHash
      !== hashFileTreePathAbsenceV3(value.physicalSpace, value.normalizedLocator)
  ) {
    context.addIssue({
      code: "custom",
      path: ["currentState", "absenceHash"],
      message: "V3 absent paths must use the canonical path-specific absence hash",
    });
  }
  if (value.entryHash !== hashFileTreePathEntryV3(value)) {
    context.addIssue({
      code: "custom",
      path: ["entryHash"],
      message: "V3 path-entry hash must bind its complete identity",
    });
  }
});

export type FileTreePathEntryV3 = z.infer<typeof FileTreePathEntryV3Schema>;

export function hashFileTreeOwnerMembershipV3(
  owners: readonly FileTreeOwnerV3[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.file-tree-owner-membership-hash.v3",
    owners,
  });
}

export function hashFileTreePathMembershipV3(
  paths: readonly Pick<FileTreePathEntryV3, "pathRef" | "entryHash">[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.file-tree-path-membership-hash.v3",
    paths: paths.map((path) => ({
      pathRef: path.pathRef,
      entryHash: path.entryHash,
    })),
  });
}

const FileTreeManifestIdentityV3Schema = z.object({
  schema: z.literal(FILE_TREE_MANIFEST_V3_SCHEMA),
  manifestVersion: z.literal(FILE_TREE_MANIFEST_VERSION_V3),
  contractHash: z.literal(FILE_TREE_MANIFEST_CONTRACT_HASH_V3),
  stage: z.literal("realization_targets_planned_on_verified_scaffold_base"),
  readiness: z.object({
    status: z.literal("shadow_blocked"),
    productionUse: z.literal("forbidden"),
    blockerCodes: z.array(FileTreeBlockerCodeV3Schema)
      .length(FILE_TREE_MANIFEST_BLOCKER_CODES_V3.length),
  }).strict(),
  authority: z.object({
    productRef: ProductIdSchema,
    productSpecHash: Sha256Schema,
    deliverySelectionHash: Sha256Schema,
    profileId: FileTreeProfileIdV3Schema,
    deliveryProfileHash: Sha256Schema,
    stackPackId: FileTreeStackPackIdV3Schema,
    stackPackVersion: z.literal("1.6.0"),
    stackPackContentHash: Sha256Schema,
    semanticRealizationPlan: z.object({
      schema: z.literal(SEMANTIC_REALIZATION_PLAN_V2_SCHEMA),
      contractHash: z.literal(SEMANTIC_REALIZATION_PLAN_CONTRACT_HASH_V2),
      planHash: Sha256Schema,
      realizationMembershipHash: Sha256Schema,
      realizationCount: z.number().int().positive().max(20_000),
      generatorMemberCount: z.number().int().positive().max(20_000),
      evidenceRelationCount: z.number().int().positive().max(20_000),
      modelWriteGrantCount: z.literal(0),
    }).strict(),
    runtimeGeneratorContractHash: z.literal(
      NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
    ),
    testGeneratorContractHash: z.literal(
      NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
    ),
    nodeExecutionLayout: z.object({
      layoutRef: StableReferenceSchema,
      layoutHash: Sha256Schema,
      pathSlotSetHash: Sha256Schema,
      pathTokenSetHash: Sha256Schema,
    }).strict(),
    scaffoldCompatibilityEvidence: z.object({
      catalogSchema: z.literal("setfarm.node-scaffold-toolchain-catalog.v2"),
      catalogHash: Sha256Schema,
      entryRef: StableReferenceSchema,
      entryHash: Sha256Schema,
      scaffoldBaseSemanticInputHash: Sha256Schema,
      scaffoldBaseStateHash: Sha256Schema,
      disposition: z.literal("authenticated_config_bytes_not_semantic_topology"),
    }).strict(),
    projectInventory: z.object({
      memberNames: z.tuple([
        z.literal("package-lock.json"),
        z.literal("package.json"),
        z.literal("tsconfig.json"),
      ]),
      npmrcState: z.literal("absent"),
      nodeModulesState: z.literal("absent"),
      sourceDirectoryState: z.literal("absent"),
      evidenceAuthority: z.literal("authenticated_private_base_fresh_revalidation_v2"),
    }).strict(),
  }).strict(),
  coverage: z.object({
    runtimeRealizationCount: z.number().int().positive().max(20_000),
    runtimeRealizationMembershipHash: Sha256Schema,
    actionCount: z.number().int().positive().max(20_000),
    evidenceRelationCount: z.number().int().positive().max(20_000),
    testCoverageCount: z.number().int().positive().max(20_000),
    testCoverageMembershipHash: Sha256Schema,
    modelWriteGrantCount: z.literal(0),
    storyOwnerCount: z.literal(0),
    disposition: z.literal(
      "every_generated_runtime_member_and_test_obligation_has_one_physical_target",
    ),
  }).strict(),
  ownerCount: z.literal(3),
  owners: z.array(FileTreeOwnerV3Schema).length(3),
  ownerMembershipHash: Sha256Schema,
  pathCount: z.literal(6),
  paths: z.array(FileTreePathEntryV3Schema).length(6),
  pathMembershipHash: Sha256Schema,
}).strict();

export type FileTreeManifestHashPayloadV3 = z.infer<
  typeof FileTreeManifestIdentityV3Schema
>;

export function hashFileTreeManifestV3(
  value: FileTreeManifestHashPayloadV3 | FileTreeManifestV3,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.manifestHash;
  return hashCanonicalJson({
    schema: "setfarm.file-tree-manifest-hash.v3",
    manifest: payload,
  });
}

function expectedProfileV3(stackPackId: "node-cli" | "node-express-api") {
  return stackPackId === "node-cli"
    ? {
        profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2" as const,
        runtimeOwnerRef: "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2" as const,
        runtimeLocator: "src/cli.ts" as const,
        runtimePathSlotRef: "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2" as const,
        testOwnerRef: "OWNER_NODE_PRODUCT_TEST_GENERATOR_V2" as const,
        testLocator: "src/cli.setfarm.test.ts" as const,
        testSourcePathRef: "PATH_NODE_CLI_GENERATED_TEST_SOURCE_V2" as const,
        testCompiledPathRef: "PATH_NODE_CLI_GENERATED_TEST_OUTPUT_V2" as const,
        runtimeImportSpecifier: "./cli.js" as const,
      }
    : {
        profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2" as const,
        runtimeOwnerRef: "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2" as const,
        runtimeLocator: "src/app.ts" as const,
        runtimePathSlotRef: "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2" as const,
        testOwnerRef: "OWNER_NODE_PRODUCT_TEST_GENERATOR_V2" as const,
        testLocator: "src/app.setfarm.test.ts" as const,
        testSourcePathRef: "PATH_NODE_API_GENERATED_TEST_SOURCE_V2" as const,
        testCompiledPathRef: "PATH_NODE_API_GENERATED_TEST_OUTPUT_V2" as const,
        runtimeImportSpecifier: "./app.js" as const,
      };
}

function addManifestClosureIssuesV3(
  value: FileTreeManifestHashPayloadV3 & { manifestHash: string },
  context: z.RefinementCtx,
): void {
  if (
    JSON.stringify(value.readiness.blockerCodes)
      !== JSON.stringify(FILE_TREE_MANIFEST_BLOCKER_CODES_V3)
  ) {
    context.addIssue({
      code: "custom",
      path: ["readiness", "blockerCodes"],
      message: "V3 blockers must equal the exact code-owned set",
    });
  }

  const expected = expectedProfileV3(value.authority.stackPackId);
  if (value.authority.profileId !== expected.profileId) {
    context.addIssue({
      code: "custom",
      path: ["authority", "profileId"],
      message: "V3 stack pack and delivery profile must join exactly",
    });
  }

  const ownerRefs = value.owners.map((owner) => owner.ownerRef);
  const expectedOwnerRefs = [
    "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2",
    "OWNER_NODE_PRODUCT_TEST_GENERATOR_V2",
    "OWNER_SETUP_V3",
  ];
  if (
    JSON.stringify(ownerRefs) !== JSON.stringify(expectedOwnerRefs)
    || value.ownerMembershipHash !== hashFileTreeOwnerMembershipV3(value.owners)
  ) {
    context.addIssue({
      code: "custom",
      path: ["owners"],
      message: "V3 owners must be exactly setup plus the two code-owned generators",
    });
  }

  const pathKeys = value.paths.map((entry) =>
    `${entry.physicalSpace}\0${entry.normalizedLocator}`);
  const foldedPathKeys = value.paths.map((entry) =>
    `${entry.physicalSpace}\0${asciiCaseFoldPathV2(entry.normalizedLocator)}`);
  if (
    !canonicalStrings(pathKeys)
    || !hasUniqueStrings(value.paths.map((entry) => entry.pathRef))
    || !hasUniqueStrings(foldedPathKeys)
    || value.pathMembershipHash !== hashFileTreePathMembershipV3(value.paths)
  ) {
    context.addIssue({
      code: "custom",
      path: ["paths"],
      message: "V3 paths must be exact, canonical and portable",
    });
  }

  const classifications = new Map<string, number>();
  let runtimeEntry: FileTreePathEntryV3 | undefined;
  let testEntry: FileTreePathEntryV3 | undefined;
  const scaffoldRoles = new Set<string>();
  for (let index = 0; index < value.paths.length; index += 1) {
    const entry = value.paths[index]!;
    classifications.set(
      entry.classification,
      (classifications.get(entry.classification) ?? 0) + 1,
    );
    if (entry.authority.kind === "generated_runtime_source_target") {
      runtimeEntry = entry;
    }
    if (entry.authority.kind === "generated_test_source_target") {
      testEntry = entry;
    }
    const present = entry.currentState.state === "present_file";
    if (
      (entry.authority.kind === "scaffold_asset") !== present
      || (
        entry.authority.kind === "scaffold_asset"
        && entry.classification !== "config"
      )
      || (
        entry.authority.kind === "project_npmrc_absence"
        && entry.classification !== "config_absence"
      )
      || (
        entry.authority.kind === "generated_runtime_source_target"
        && entry.classification !== "generated_runtime_source"
      )
      || (
        entry.authority.kind === "generated_test_source_target"
        && entry.classification !== "generated_test_source"
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["paths", index],
        message: "V3 path classification, state and authority kind must join",
      });
    }

    switch (entry.authority.kind) {
      case "scaffold_asset": {
        scaffoldRoles.add(entry.authority.assetRole);
        const expectedLocator = entry.authority.assetRole === "package_manifest"
          ? "package.json"
          : entry.authority.assetRole === "dependency_lock_manifest"
            ? "package-lock.json"
            : "tsconfig.json";
        const expectedSlot = entry.authority.assetRole === "package_manifest"
          ? "PATH_SLOT_NODE_PACKAGE_JSON_V2"
          : entry.authority.assetRole === "dependency_lock_manifest"
            ? "PATH_SLOT_NODE_PACKAGE_LOCK_JSON_V2"
            : "PATH_SLOT_NODE_TSCONFIG_JSON_V2";
        if (
          entry.normalizedLocator !== expectedLocator
          || entry.authority.pathSlotRef !== expectedSlot
          || entry.ownerRef !== "OWNER_SETUP_V3"
          || entry.access !== "setup_readonly"
          || entry.currentState.state !== "present_file"
          || entry.authority.scaffoldBaseSemanticInputHash
            !== value.authority.scaffoldCompatibilityEvidence
              .scaffoldBaseSemanticInputHash
          || entry.authority.scaffoldBaseStateHash
            !== value.authority.scaffoldCompatibilityEvidence.scaffoldBaseStateHash
        ) {
          context.addIssue({
            code: "custom",
            path: ["paths", index],
            message: "V3 scaffold assets must be exact setup-owned F4 bytes",
          });
        }
        break;
      }
      case "project_npmrc_absence":
        if (
          entry.normalizedLocator !== ".npmrc"
          || entry.ownerRef !== "OWNER_SETUP_V3"
          || entry.access !== "forbidden"
          || entry.currentState.state !== "absent"
          || entry.currentState.evidence
            !== "private_scaffold_base_exact_inventory_v2"
          || entry.authority.scaffoldBaseSemanticInputHash
            !== value.authority.scaffoldCompatibilityEvidence
              .scaffoldBaseSemanticInputHash
          || entry.authority.scaffoldBaseStateHash
            !== value.authority.scaffoldCompatibilityEvidence.scaffoldBaseStateHash
        ) {
          context.addIssue({
            code: "custom",
            path: ["paths", index],
            message: "V3 project npmrc must remain an exact forbidden absence",
          });
        }
        break;
      case "generated_runtime_source_target":
        if (
          entry.normalizedLocator !== expected.runtimeLocator
          || entry.ownerRef !== expected.runtimeOwnerRef
          || entry.access !== "generator_whole_file_future"
          || entry.currentState.state !== "absent"
          || entry.currentState.evidence
            !== "private_scaffold_base_source_root_absence_v2"
          || entry.authority.sourcePathSlotRef !== expected.runtimePathSlotRef
          || entry.authority.realizationPlanHash
            !== value.authority.semanticRealizationPlan.planHash
          || entry.authority.realizationMembershipHash
            !== value.authority.semanticRealizationPlan.realizationMembershipHash
          || entry.authority.generatorContractHash
            !== value.authority.runtimeGeneratorContractHash
          || entry.authority.realizationBindingCount
            !== value.coverage.runtimeRealizationCount
          || entry.authority.realizationBindingMembershipHash
            !== value.coverage.runtimeRealizationMembershipHash
        ) {
          context.addIssue({
            code: "custom",
            path: ["paths", index],
            message: "V3 runtime source must bind every generated realization",
          });
        }
        break;
      case "generated_test_source_target":
        if (
          entry.normalizedLocator !== expected.testLocator
          || entry.ownerRef !== expected.testOwnerRef
          || entry.access !== "generator_whole_file_future"
          || entry.currentState.state !== "absent"
          || entry.currentState.evidence
            !== "private_scaffold_base_source_root_absence_v2"
          || entry.authority.sourcePathRef !== expected.testSourcePathRef
          || entry.authority.compiledPathRef !== expected.testCompiledPathRef
          || entry.authority.runtimeImportSpecifier
            !== expected.runtimeImportSpecifier
          || entry.authority.realizationPlanHash
            !== value.authority.semanticRealizationPlan.planHash
          || entry.authority.realizationMembershipHash
            !== value.authority.semanticRealizationPlan.realizationMembershipHash
          || entry.authority.generatorContractHash
            !== value.authority.testGeneratorContractHash
          || entry.authority.coverageBindingCount !== value.coverage.testCoverageCount
          || entry.authority.coverageMembershipHash
            !== value.coverage.testCoverageMembershipHash
        ) {
          context.addIssue({
            code: "custom",
            path: ["paths", index],
            message: "V3 test source must bind exact profile and semantic coverage",
          });
        }
        break;
    }
  }

  if (
    classifications.get("config") !== 3
    || classifications.get("config_absence") !== 1
    || classifications.get("generated_runtime_source") !== 1
    || classifications.get("generated_test_source") !== 1
    || scaffoldRoles.size !== 3
    || !runtimeEntry
    || !testEntry
  ) {
    context.addIssue({
      code: "custom",
      path: ["paths"],
      message: "V3 manifest must contain exactly its six planned repository paths",
    });
  }

  if (
    value.coverage.runtimeRealizationCount
      !== value.authority.semanticRealizationPlan.generatorMemberCount
    || value.coverage.evidenceRelationCount
      !== value.authority.semanticRealizationPlan.evidenceRelationCount
    || value.coverage.testCoverageCount
      !== value.coverage.actionCount + value.coverage.evidenceRelationCount
    || runtimeEntry?.authority.kind !== "generated_runtime_source_target"
    || testEntry?.authority.kind !== "generated_test_source_target"
    || runtimeEntry.authority.realizationBindings.some((binding) =>
      binding.realizationRef === "" || binding.intentRef === "")
    || testEntry.authority.coverageBindings.filter((binding) =>
      binding.coverageKind === "action").length !== value.coverage.actionCount
    || testEntry.authority.coverageBindings.filter((binding) =>
      binding.coverageKind === "evidence_relation").length
      !== value.coverage.evidenceRelationCount
  ) {
    context.addIssue({
      code: "custom",
      path: ["coverage"],
      message: "V3 runtime and generated-test coverage counts must close exactly",
    });
  }

  const selectedRuntimeProfile =
    NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2.profiles.find(
      (profile) => profile.profileId === value.authority.profileId,
    );
  if (
    !selectedRuntimeProfile
    || selectedRuntimeProfile.stackPackId !== value.authority.stackPackId
    || selectedRuntimeProfile.sourcePathSlotRef !== expected.runtimePathSlotRef
    || runtimeEntry?.authority.kind !== "generated_runtime_source_target"
    || runtimeEntry.authority.generatorProfileHash
      !== hashNodeProductRuntimeGeneratorProfileV2(selectedRuntimeProfile)
  ) {
    context.addIssue({
      code: "custom",
      path: ["authority", "runtimeGeneratorContractHash"],
      message: "V3 runtime target must resolve from the exact code-owned runtime profile",
    });
  }

  const selectedTestProfile = NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2.profiles.find(
    (profile) => profile.profileId === value.authority.profileId,
  );
  if (
    !selectedTestProfile
    || selectedTestProfile.stackPackId !== value.authority.stackPackId
    || selectedTestProfile.sourceNormalizedLocator !== expected.testLocator
    || selectedTestProfile.sourcePathRef !== expected.testSourcePathRef
    || selectedTestProfile.compiledPathRef !== expected.testCompiledPathRef
    || selectedTestProfile.runtimeImportSpecifier
      !== expected.runtimeImportSpecifier
    || testEntry?.authority.kind !== "generated_test_source_target"
    || testEntry.authority.generatorProfileHash
      !== hashNodeProductTestGeneratorProfileV2(selectedTestProfile)
    || testEntry.authority.runnerAbi !== selectedTestProfile.execution.runnerAbi
  ) {
    context.addIssue({
      code: "custom",
      path: ["authority", "testGeneratorContractHash"],
      message: "V3 test target must resolve from the exact code-owned test profile",
    });
  }

  if (value.manifestHash !== hashFileTreeManifestV3(value)) {
    context.addIssue({
      code: "custom",
      path: ["manifestHash"],
      message: "V3 manifest hash must bind its complete logical snapshot",
    });
  }
}

const FileTreeManifestCandidateV3Schema = FileTreeManifestIdentityV3Schema.extend({
  manifestHash: Sha256Schema,
}).strict().superRefine(addManifestClosureIssuesV3);

export const FileTreeManifestV3Schema = z.unknown().superRefine(
  (value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: FILE_TREE_MANIFEST_MAX_CANONICAL_BYTES_V3,
        ...FILE_TREE_MANIFEST_BOUNDED_WORK_LIMITS_V3,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: "V3 manifest exceeds its canonical byte or work bound",
      });
    }
  },
).pipe(FileTreeManifestCandidateV3Schema);

export type FileTreeManifestV3 = z.infer<typeof FileTreeManifestCandidateV3Schema>;

export function recursivelyFreezeFileTreeManifestV3<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        pending.push(child);
      }
    }
    Object.freeze(current);
  }
  return value;
}
