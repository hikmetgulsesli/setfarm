import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { hashCanonicalJson } from "../canonical-json.js";
import {
  NormalizedRelativeLocatorSchema,
  OwnerIdSchema,
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
  SemanticSourceAccessPolicyV1Schema,
  SemanticSourceResponsibilityV1Schema,
  SemanticSourceSubjectKindV1Schema,
} from "./stack-semantic-source-rules-v1.js";
import {
  hashSemanticSourceExternalRequirementMembershipV2,
  hashSemanticSourcePathTokenMembershipV2,
} from "./semantic-source-path-token-set-v2.js";

export const FILE_TREE_MANIFEST_V2_SCHEMA =
  "setfarm.file-tree-manifest.v2" as const;
export const FILE_TREE_MANIFEST_VERSION_V2 = "2.0.0" as const;
export const FILE_TREE_MANIFEST_MAX_CANONICAL_BYTES_V2 = 4 * 1024 * 1024;
export const FILE_TREE_MANIFEST_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 16,
  maxNodes: FILE_TREE_MANIFEST_MAX_CANONICAL_BYTES_V2 + 25_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (FILE_TREE_MANIFEST_MAX_CANONICAL_BYTES_V2 * 8) + (2 * 1024 * 1024),
});

export const FILE_TREE_MANIFEST_BLOCKER_CODES_V2 = Object.freeze([
  "FILE_TREE_V2_BUILD_TOPOLOGY_UNVERIFIED",
  "FILE_TREE_V2_NODE_ENTRYPOINT_SOURCE_RECEIPT_UNVERIFIED",
  "FILE_TREE_V2_NODE_RULE_GENERATOR_TRANSITION_UNVERIFIED",
  "FILE_TREE_V2_RELEASE_ACTIVATION_UNVERIFIED",
  "FILE_TREE_V2_SEMANTIC_DECLARATIONS_UNVERIFIED",
  "FILE_TREE_V2_TEST_SOURCE_AUTHORITY_UNVERIFIED",
] as const);

export const FILE_TREE_MANIFEST_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.file-tree-manifest-contract.v2" as const,
  contractVersion: FILE_TREE_MANIFEST_VERSION_V2,
  stage: "scaffold_base_ready" as const,
  sourceAuthorities: Object.freeze([
    "product_spec_v2",
    "product_delivery_selection_v2",
    "node_execution_layout_v2",
    "node_execution_path_token_set_v2",
    "semantic_source_intent_set_v1",
    "semantic_source_path_token_set_v2",
    "node_scaffold_toolchain_resolution_v2",
    "scaffold_base_semantic_input_hash_v2",
    "scaffold_base_state_hash_v2",
  ] as const),
  pathAuthorities: Object.freeze([
    "scaffold_asset",
    "project_npmrc_absence",
    "semantic_source_path",
    "node_entrypoint_plan",
    "historical_entrypoint_rejection",
  ] as const),
  ownership: Object.freeze({
    exclusive: "one_exact_story_owner" as const,
    sharedCatalogAggregate: "setup_owner_plus_every_exact_story_grant" as const,
    entrypoint: "future_whole_file_generator_model_write_forbidden" as const,
  }),
  physicalAttemptProjection: Object.freeze({
    disposition: "forbidden_from_logical_manifest_identity" as const,
    excludedFields: Object.freeze([
      "admissionScope",
      "environmentReceiptHash",
      "physicalIdentityHash",
      "privateRootIdentityHash",
      "scaffoldBaseReceiptHash",
    ] as const),
  }),
  delegatedToBuildTopologyV2: Object.freeze([
    "build_output",
    "build_test_runtime_commands",
    "dependency_receipt",
    "raw_node_modules_build_input",
    "readonly_dependency_runtime_capsule",
  ] as const),
  blockerCodes: FILE_TREE_MANIFEST_BLOCKER_CODES_V2,
  hashDomains: Object.freeze({
    pathRef: "setfarm.file-tree-path-ref.v2" as const,
    pathAbsence: "setfarm.file-tree-path-absence.v2" as const,
    pathEntry: "setfarm.file-tree-path-entry-hash.v2" as const,
    ownerMembership: "setfarm.file-tree-owner-membership-hash.v2" as const,
    pathMembership: "setfarm.file-tree-path-membership-hash.v2" as const,
    manifest: "setfarm.file-tree-manifest-hash.v2" as const,
  }),
} as const);

export const FILE_TREE_MANIFEST_CONTRACT_HASH_V2 = hashCanonicalJson(
  FILE_TREE_MANIFEST_CONTRACT_V2,
);

const FileTreeBlockerCodeV2Schema = z.enum(FILE_TREE_MANIFEST_BLOCKER_CODES_V2);
const FileTreeProfileIdV2Schema = z.enum([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);
const FileTreeStackPackIdV2Schema = z.enum(["node-cli", "node-express-api"]);

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalStrings(values: readonly string[]): boolean {
  return hasUniqueStrings(values)
    && values.every((value, index) => index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

export function deriveFileTreePathRefV2(
  physicalSpace: "repository",
  normalizedLocator: string,
): string {
  return `PATH_${hashCanonicalJson({
    schema: "setfarm.file-tree-path-ref.v2",
    physicalSpace,
    normalizedLocator,
  }).toUpperCase()}`;
}

export function deriveFileTreeStoryOwnerRefV2(
  storyId: string,
  componentHash: string,
): string {
  return `OWNER_${hashCanonicalJson({
    schema: "setfarm.file-tree-story-owner-ref.v2",
    storyId,
    componentHash,
  }).toUpperCase()}`;
}

export function hashFileTreePathAbsenceV2(
  physicalSpace: "repository",
  normalizedLocator: string,
): string {
  return hashCanonicalJson({
    schema: "setfarm.file-tree-path-absence.v2",
    physicalSpace,
    normalizedLocator,
  });
}

const FileTreeSetupOwnerV2Schema = z.object({
  ownerRef: z.literal("OWNER_SETUP_V2"),
  kind: z.literal("setup"),
}).strict();

const FileTreeGeneratorOwnerV2Schema = z.object({
  ownerRef: z.literal("OWNER_NODE_ENTRYPOINT_GENERATOR_V2"),
  kind: z.literal("generator"),
  generatorRef: z.literal("NODE_ENTRYPOINT_GENERATOR_V2"),
}).strict();

const FileTreeStoryOwnerV2Schema = z.object({
  ownerRef: OwnerIdSchema,
  kind: z.literal("story"),
  storyId: StoryIdSchema,
  componentHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.ownerRef === deriveFileTreeStoryOwnerRefV2(value.storyId, value.componentHash)) return;
  context.addIssue({
    code: "custom",
    path: ["ownerRef"],
    message: "Story owner ref must bind the exact story and component identity",
  });
});

export const FileTreeOwnerV2Schema = z.discriminatedUnion("kind", [
  FileTreeSetupOwnerV2Schema,
  FileTreeGeneratorOwnerV2Schema,
  FileTreeStoryOwnerV2Schema,
]);

export type FileTreeOwnerV2 = z.infer<typeof FileTreeOwnerV2Schema>;

const FileTreePresentFileStateV2Schema = z.object({
  state: z.literal("present_file"),
  mode: z.literal("0444"),
  contentHash: Sha256Schema,
  byteLength: z.number().int().positive().max(16 * 1024 * 1024),
}).strict();

const FileTreeAbsentStateV2Schema = z.object({
  state: z.literal("absent"),
  absenceHash: Sha256Schema,
  evidence: z.enum([
    "private_scaffold_base_exact_inventory_v2",
    "private_scaffold_base_source_root_absence_v2",
  ]),
}).strict();

export const FileTreeCurrentStateV2Schema = z.discriminatedUnion("state", [
  FileTreePresentFileStateV2Schema,
  FileTreeAbsentStateV2Schema,
]);

export type FileTreeCurrentStateV2 = z.infer<typeof FileTreeCurrentStateV2Schema>;

const FileTreeScaffoldAssetAuthorityV2Schema = z.object({
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
}).strict();

const FileTreeNpmrcAbsenceAuthorityV2Schema = z.object({
  kind: z.literal("project_npmrc_absence"),
  scaffoldBaseSemanticInputHash: Sha256Schema,
  scaffoldBaseStateHash: Sha256Schema,
}).strict();

export const FileTreeSemanticIntentBindingV2Schema = z.object({
  intentRef: StableReferenceSchema,
  intentHash: Sha256Schema,
  ruleSetHash: Sha256Schema,
  ruleRef: StableReferenceSchema,
  ruleHash: Sha256Schema,
  scopeRef: StableReferenceSchema,
  subjectKind: SemanticSourceSubjectKindV1Schema,
  subjectRef: StableReferenceSchema,
  subjectHash: Sha256Schema,
  responsibility: SemanticSourceResponsibilityV1Schema,
  storyId: StoryIdSchema,
  storyComponentHash: Sha256Schema,
  writerOwnerRef: OwnerIdSchema,
  accessPolicy: SemanticSourceAccessPolicyV1Schema,
  tokenBindingHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.writerOwnerRef
    === deriveFileTreeStoryOwnerRefV2(value.storyId, value.storyComponentHash)
  ) return;
  context.addIssue({
    code: "custom",
    path: ["writerOwnerRef"],
    message: "Semantic writer must equal its exact story owner",
  });
});

export type FileTreeSemanticIntentBindingV2 = z.infer<
  typeof FileTreeSemanticIntentBindingV2Schema
>;

const FileTreeSemanticPathTokenAuthorityV2Schema = z.object({
  kind: z.literal("semantic_source_path"),
  semanticPathTokenSetHash: Sha256Schema,
  semanticPathToken: Sha256Schema,
  materialization: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("exclusive_file") }).strict(),
    z.object({
      kind: z.literal("shared_catalog_aggregate"),
      aggregationRef: z.enum([
        "SEMANTIC_PERSISTENCE_ABSENCE_BY_PRODUCT_V2",
        "SEMANTIC_RUNTIME_DATA_FIXTURE_BY_PRODUCT_V2",
      ]),
    }).strict(),
  ]),
  intentBindingCount: z.number().int().positive().max(20_000),
  intentBindings: z.array(FileTreeSemanticIntentBindingV2Schema).min(1).max(20_000),
}).strict().superRefine((value, context) => {
  const refs = value.intentBindings.map((binding) => binding.intentRef);
  if (
    value.intentBindingCount === value.intentBindings.length
    && canonicalStrings(refs)
  ) return;
  context.addIssue({
    code: "custom",
    path: ["intentBindings"],
    message: "Semantic path intent bindings must be complete, unique and canonical",
  });
});

export const FileTreeEntrypointRequirementBindingV2Schema = z.object({
  intentRef: StableReferenceSchema,
  intentHash: Sha256Schema,
  ruleSetHash: Sha256Schema,
  requirementHash: Sha256Schema,
  ruleRef: StableReferenceSchema,
  ruleHash: Sha256Schema,
  scopeRef: StableReferenceSchema,
  subjectKind: SemanticSourceSubjectKindV1Schema,
  subjectRef: StableReferenceSchema,
  subjectHash: Sha256Schema,
  responsibility: SemanticSourceResponsibilityV1Schema,
  storyId: StoryIdSchema.nullable(),
  writerOwnerRef: OwnerIdSchema,
  accessPolicy: z.literal("granted_writable"),
  pathAuthorityProjectionHash: Sha256Schema,
  expectation: z.object({
    kind: z.literal("shared_structural_selected_entrypoint"),
    entrypointKind: z.enum(["cli", "api"]),
    requiredAuthority: z.literal("node_execution_path_token_v2"),
  }).strict(),
  compatibilityStatus: z.literal(
    "current_v1_rule_unmigrated_v2_activation_forbidden",
  ),
}).strict();

export type FileTreeEntrypointRequirementBindingV2 = z.infer<
  typeof FileTreeEntrypointRequirementBindingV2Schema
>;

const FileTreeEntrypointPlanAuthorityV2Schema = z.object({
  kind: z.literal("node_entrypoint_plan"),
  scaffoldResolutionHash: Sha256Schema,
  pathSlotRef: z.enum([
    "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
    "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
  ]),
  pathToken: Sha256Schema,
  tokenBindingHash: Sha256Schema,
  finalOwnerRef: z.literal("NODE_ENTRYPOINT_GENERATOR_V2"),
  sourceReceiptSchema: z.literal("setfarm.node-entrypoint-source-receipt.v2"),
  sourceReceiptState: z.literal("absent"),
  modelWriteAuthority: z.literal("forbidden"),
  requirementCount: z.number().int().positive().max(20_000),
  requirements: z.array(FileTreeEntrypointRequirementBindingV2Schema)
    .min(1).max(20_000),
}).strict().superRefine((value, context) => {
  const refs = value.requirements.map((binding) => binding.intentRef);
  if (value.requirementCount === value.requirements.length && canonicalStrings(refs)) return;
  context.addIssue({
    code: "custom",
    path: ["requirements"],
    message: "Entrypoint requirements must be complete, unique and canonical",
  });
});

const FileTreeHistoricalRejectionAuthorityV2Schema = z.object({
  kind: z.literal("historical_entrypoint_rejection"),
  layoutHash: Sha256Schema,
  pathSlotRef: z.enum([
    "PATH_SLOT_NODE_CLI_HISTORICAL_INDEX_V2",
    "PATH_SLOT_NODE_API_HISTORICAL_ROOT_SERVER_V2",
    "PATH_SLOT_NODE_API_HISTORICAL_SOURCE_SERVER_V2",
  ]),
  pathToken: Sha256Schema,
  tokenBindingHash: Sha256Schema,
  disposition: z.literal("reject_only"),
}).strict();

export const FileTreePathAuthorityV2Schema = z.discriminatedUnion("kind", [
  FileTreeScaffoldAssetAuthorityV2Schema,
  FileTreeNpmrcAbsenceAuthorityV2Schema,
  FileTreeSemanticPathTokenAuthorityV2Schema,
  FileTreeEntrypointPlanAuthorityV2Schema,
  FileTreeHistoricalRejectionAuthorityV2Schema,
]);

export type FileTreePathAuthorityV2 = z.infer<typeof FileTreePathAuthorityV2Schema>;

const FileTreePathEntryIdentityV2Schema = z.object({
  pathRef: PathBindingIdSchema,
  physicalSpace: z.literal("repository"),
  normalizedLocator: NormalizedRelativeLocatorSchema,
  pathIdentityHash: Sha256Schema,
  caseFoldPathIdentityHash: Sha256Schema,
  classification: z.enum([
    "compatibility_rejected",
    "config",
    "config_absence",
    "entrypoint_generated",
    "source",
  ]),
  ownerRef: OwnerIdSchema,
  writeGrantOwnerRefs: z.array(OwnerIdSchema).max(5_000),
  access: z.enum([
    "forbidden",
    "generator_whole_file_future",
    "model_granted_writable",
    "model_owned_writable",
    "setup_readonly",
  ]),
  currentState: FileTreeCurrentStateV2Schema,
  authority: FileTreePathAuthorityV2Schema,
}).strict();

export type FileTreePathEntryHashPayloadV2 = z.infer<
  typeof FileTreePathEntryIdentityV2Schema
>;

export function hashFileTreePathEntryV2(
  value: FileTreePathEntryHashPayloadV2 | FileTreePathEntryV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.entryHash;
  return hashCanonicalJson({
    schema: "setfarm.file-tree-path-entry-hash.v2",
    entry: payload,
  });
}

export const FileTreePathEntryV2Schema = FileTreePathEntryIdentityV2Schema.extend({
  entryHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  for (const issue of portablePathIssuesV2(value.normalizedLocator, { allowEmpty: false })) {
    context.addIssue({ code: "custom", path: ["normalizedLocator"], message: issue });
  }
  if (
    value.pathRef !== deriveFileTreePathRefV2(value.physicalSpace, value.normalizedLocator)
    || value.pathIdentityHash
      !== hashPortablePathIdentityV2(value.physicalSpace, value.normalizedLocator)
    || value.caseFoldPathIdentityHash
      !== hashPortablePathCaseFoldIdentityV2(value.physicalSpace, value.normalizedLocator)
  ) {
    context.addIssue({
      code: "custom",
      path: ["pathRef"],
      message: "File-tree path identity must bind exact and ASCII-folded locator authority",
    });
  }
  if (
    value.currentState.state === "absent"
    && value.currentState.absenceHash
      !== hashFileTreePathAbsenceV2(value.physicalSpace, value.normalizedLocator)
  ) {
    context.addIssue({
      code: "custom",
      path: ["currentState", "absenceHash"],
      message: "Absent file-tree paths must use the canonical path-specific absence hash",
    });
  }
  if (!canonicalStrings(value.writeGrantOwnerRefs)) {
    context.addIssue({
      code: "custom",
      path: ["writeGrantOwnerRefs"],
      message: "File-tree write grants must be unique and canonical",
    });
  }
  if (value.entryHash !== hashFileTreePathEntryV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["entryHash"],
      message: "File-tree path-entry hash must bind its complete identity",
    });
  }
});

export type FileTreePathEntryV2 = z.infer<typeof FileTreePathEntryV2Schema>;

export function hashFileTreeOwnerMembershipV2(
  owners: readonly FileTreeOwnerV2[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.file-tree-owner-membership-hash.v2",
    owners,
  });
}

export function hashFileTreePathMembershipV2(
  paths: readonly Pick<FileTreePathEntryV2, "pathRef" | "entryHash">[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.file-tree-path-membership-hash.v2",
    paths: paths.map((path) => ({ pathRef: path.pathRef, entryHash: path.entryHash })),
  });
}

const FileTreeManifestIdentityV2Schema = z.object({
  schema: z.literal(FILE_TREE_MANIFEST_V2_SCHEMA),
  manifestVersion: z.literal(FILE_TREE_MANIFEST_VERSION_V2),
  contractHash: z.literal(FILE_TREE_MANIFEST_CONTRACT_HASH_V2),
  stage: z.literal("scaffold_base_ready"),
  readiness: z.object({
    status: z.literal("shadow_blocked"),
    productionUse: z.literal("forbidden"),
    blockerCodes: z.array(FileTreeBlockerCodeV2Schema)
      .length(FILE_TREE_MANIFEST_BLOCKER_CODES_V2.length),
  }).strict(),
  authority: z.object({
    productRef: ProductIdSchema,
    productSpecHash: Sha256Schema,
    deliverySelectionHash: Sha256Schema,
    profileId: FileTreeProfileIdV2Schema,
    stackPackId: FileTreeStackPackIdV2Schema,
    nodeExecutionLayoutHash: Sha256Schema,
    nodePathTokenSetHash: Sha256Schema,
    semanticRuleSetHash: Sha256Schema,
    semanticIntentSetHash: Sha256Schema,
    semanticPathTokenSetHash: Sha256Schema,
    scaffoldResolutionHash: Sha256Schema,
    scaffoldCatalogHash: Sha256Schema,
    scaffoldEntryHash: Sha256Schema,
    scaffoldBaseSemanticInputHash: Sha256Schema,
    scaffoldBaseStateHash: Sha256Schema,
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
  semanticCoverage: z.object({
    sourceSlotIntentCount: z.number().int().positive().max(20_000),
    semanticTokenIntentCount: z.number().int().nonnegative().max(20_000),
    externalRequirementIntentCount: z.number().int().nonnegative().max(20_000),
    semanticTokenMembershipHash: Sha256Schema,
    externalRequirementMembershipHash: Sha256Schema,
    disposition: z.literal("every_source_slot_exactly_once"),
  }).strict(),
  ownerCount: z.number().int().positive().max(5_002),
  owners: z.array(FileTreeOwnerV2Schema).min(1).max(5_002),
  ownerMembershipHash: Sha256Schema,
  pathCount: z.number().int().positive().max(25_000),
  paths: z.array(FileTreePathEntryV2Schema).min(1).max(25_000),
  pathMembershipHash: Sha256Schema,
}).strict();

export type FileTreeManifestHashPayloadV2 = z.infer<
  typeof FileTreeManifestIdentityV2Schema
>;

export function hashFileTreeManifestV2(
  value: FileTreeManifestHashPayloadV2 | FileTreeManifestV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.manifestHash;
  return hashCanonicalJson({
    schema: "setfarm.file-tree-manifest-hash.v2",
    manifest: payload,
  });
}

function addManifestClosureIssues(
  value: FileTreeManifestHashPayloadV2 & { manifestHash: string },
  context: z.RefinementCtx,
): void {
  if (
    JSON.stringify(value.readiness.blockerCodes)
    !== JSON.stringify(FILE_TREE_MANIFEST_BLOCKER_CODES_V2)
  ) {
    context.addIssue({
      code: "custom",
      path: ["readiness", "blockerCodes"],
      message: "File-tree blockers must equal the exact code-owned scaffold-base-ready set",
    });
  }

  const ownerRefs = value.owners.map((owner) => owner.ownerRef);
  if (
    value.ownerCount !== value.owners.length
    || !canonicalStrings(ownerRefs)
    || value.ownerMembershipHash !== hashFileTreeOwnerMembershipV2(value.owners)
  ) {
    context.addIssue({
      code: "custom",
      path: ["owners"],
      message: "File-tree owners must be complete, unique, canonical and content-bound",
    });
  }
  const owners = new Set(ownerRefs);
  const pathKeys = value.paths.map((entry) =>
    `${entry.physicalSpace}\0${entry.normalizedLocator}`);
  const foldedPathKeys = value.paths.map((entry) =>
    `${entry.physicalSpace}\0${asciiCaseFoldPathV2(entry.normalizedLocator)}`);
  if (
    value.pathCount !== value.paths.length
    || !canonicalStrings(pathKeys)
    || !hasUniqueStrings(value.paths.map((entry) => entry.pathRef))
    || !hasUniqueStrings(foldedPathKeys)
    || value.pathMembershipHash !== hashFileTreePathMembershipV2(value.paths)
  ) {
    context.addIssue({
      code: "custom",
      path: ["paths"],
      message: "File-tree paths must be every-only, portable, canonical and collision-free",
    });
  }
  value.paths.forEach((entry, index) => {
    if (
      !owners.has(entry.ownerRef)
      || entry.writeGrantOwnerRefs.some((ownerRef) => !owners.has(ownerRef))
    ) {
      context.addIssue({
        code: "custom",
        path: ["paths", index, "ownerRef"],
        message: "Every file-tree owner and grant must resolve inside the exact owner set",
      });
    }
  });

  const expectedProfile = value.authority.stackPackId === "node-cli"
    ? {
        profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2" as const,
        entrypointSlot: "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2" as const,
        entrypointLocator: "src/cli.ts" as const,
        historicalCount: 1,
      }
    : {
        profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2" as const,
        entrypointSlot: "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2" as const,
        entrypointLocator: "src/app.ts" as const,
        historicalCount: 2,
      };
  if (value.authority.profileId !== expectedProfile.profileId) {
    context.addIssue({
      code: "custom",
      path: ["authority", "profileId"],
      message: "File-tree stack pack and delivery profile must join exactly",
    });
  }

  const classifications = new Map<string, number>();
  const scaffoldRoles = new Set<string>();
  for (let index = 0; index < value.paths.length; index += 1) {
    const entry = value.paths[index]!;
    classifications.set(
      entry.classification,
      (classifications.get(entry.classification) ?? 0) + 1,
    );
    const present = entry.currentState.state === "present_file";
    const authorityKind = entry.authority.kind;
    if (
      (authorityKind === "scaffold_asset") !== present
      || (authorityKind === "scaffold_asset" && entry.classification !== "config")
      || (authorityKind === "project_npmrc_absence" && entry.classification !== "config_absence")
      || (authorityKind === "semantic_source_path" && entry.classification !== "source")
      || (authorityKind === "node_entrypoint_plan" && entry.classification !== "entrypoint_generated")
      || (
        authorityKind === "historical_entrypoint_rejection"
        && entry.classification !== "compatibility_rejected"
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["paths"],
        message: "Path classification, current state and authority kind must join exactly",
      });
      break;
    }

    const noGrants = entry.writeGrantOwnerRefs.length === 0;
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
          || entry.ownerRef !== "OWNER_SETUP_V2"
          || !noGrants
          || entry.access !== "setup_readonly"
          || entry.currentState.state !== "present_file"
          || entry.authority.scaffoldBaseSemanticInputHash
            !== value.authority.scaffoldBaseSemanticInputHash
          || entry.authority.scaffoldBaseStateHash
            !== value.authority.scaffoldBaseStateHash
        ) {
          context.addIssue({
            code: "custom",
            path: ["paths", index],
            message: "Scaffold assets must be exact setup-owned read-only receipt members",
          });
        }
        break;
      }
      case "project_npmrc_absence":
        if (
          entry.normalizedLocator !== ".npmrc"
          || entry.ownerRef !== "OWNER_SETUP_V2"
          || !noGrants
          || entry.access !== "forbidden"
          || entry.currentState.state !== "absent"
          || entry.currentState.evidence
            !== "private_scaffold_base_exact_inventory_v2"
          || entry.authority.scaffoldBaseSemanticInputHash
            !== value.authority.scaffoldBaseSemanticInputHash
          || entry.authority.scaffoldBaseStateHash
            !== value.authority.scaffoldBaseStateHash
        ) {
          context.addIssue({
            code: "custom",
            path: ["paths", index],
            message: "Project npmrc must remain an exact forbidden absence",
          });
        }
        break;
      case "semantic_source_path": {
        const bindings = entry.authority.intentBindings;
        const writerRefs = [...new Set(bindings.map((binding) =>
          binding.writerOwnerRef))].sort(compareUtf16);
        const shared = entry.authority.materialization.kind
          === "shared_catalog_aggregate";
        const semanticPrefix =
          `src/setfarm/semantic/${entry.authority.semanticPathToken}`;
        const semanticSuffix = entry.normalizedLocator.slice(semanticPrefix.length);
        const ownershipValid = shared
          ? entry.ownerRef === "OWNER_SETUP_V2"
            && entry.access === "model_granted_writable"
            && JSON.stringify(entry.writeGrantOwnerRefs) === JSON.stringify(writerRefs)
          : bindings.length === 1
            && entry.ownerRef === bindings[0]!.writerOwnerRef
            && entry.access === "model_owned_writable"
            && noGrants;
        if (
          !ownershipValid
          || bindings.some((binding) => binding.accessPolicy !== "owned_writable")
          || entry.currentState.state !== "absent"
          || entry.currentState.evidence
            !== "private_scaffold_base_source_root_absence_v2"
          || entry.authority.semanticPathTokenSetHash
            !== value.authority.semanticPathTokenSetHash
          || !entry.normalizedLocator.startsWith(semanticPrefix)
          || ![".js", ".jsx", ".json", ".py", ".ts", ".tsx"]
            .includes(semanticSuffix)
        ) {
          context.addIssue({
            code: "custom",
            path: ["paths", index],
            message: "Semantic paths must preserve exact story ownership or explicit aggregate grants",
          });
        }
        break;
      }
      case "node_entrypoint_plan":
        if (
          entry.normalizedLocator !== expectedProfile.entrypointLocator
          || entry.authority.pathSlotRef !== expectedProfile.entrypointSlot
          || entry.ownerRef !== "OWNER_NODE_ENTRYPOINT_GENERATOR_V2"
          || !noGrants
          || entry.access !== "generator_whole_file_future"
          || entry.currentState.state !== "absent"
          || entry.currentState.evidence
            !== "private_scaffold_base_source_root_absence_v2"
          || entry.authority.scaffoldResolutionHash
            !== value.authority.scaffoldResolutionHash
          || entry.authority.requirements.some((requirement) =>
            requirement.accessPolicy !== "granted_writable"
            || requirement.expectation.entrypointKind
              !== (value.authority.stackPackId === "node-cli" ? "cli" : "api"))
        ) {
          context.addIssue({
            code: "custom",
            path: ["paths", index],
            message: "Canonical entrypoint must remain one generator-owned absent whole-file plan",
          });
        }
        break;
      case "historical_entrypoint_rejection":
        if (
          entry.ownerRef !== "OWNER_SETUP_V2"
          || !noGrants
          || entry.access !== "forbidden"
          || entry.currentState.state !== "absent"
          || entry.currentState.evidence
            !== "private_scaffold_base_exact_inventory_v2"
          || entry.authority.layoutHash !== value.authority.nodeExecutionLayoutHash
        ) {
          context.addIssue({
            code: "custom",
            path: ["paths", index],
            message: "Historical entrypoints must remain explicit forbidden absences",
          });
        }
        break;
    }
  }
  if (
    classifications.get("config") !== 3
    || classifications.get("config_absence") !== 1
    || classifications.get("entrypoint_generated") !== 1
    || classifications.get("compatibility_rejected") !== expectedProfile.historicalCount
    || (classifications.get("source") ?? 0) < 1
    || scaffoldRoles.size !== 3
  ) {
    context.addIssue({
      code: "custom",
      path: ["paths"],
      message: "Scaffold-base-ready FileTree must contain every required path class",
    });
  }
  const historicalMembership = value.paths.flatMap((entry) =>
    entry.authority.kind === "historical_entrypoint_rejection"
      ? [`${entry.authority.pathSlotRef}\0${entry.normalizedLocator}`]
      : []);
  const expectedHistoricalMembership = value.authority.stackPackId === "node-cli"
    ? ["PATH_SLOT_NODE_CLI_HISTORICAL_INDEX_V2\0src/index.ts"]
    : [
        "PATH_SLOT_NODE_API_HISTORICAL_ROOT_SERVER_V2\0server.ts",
        "PATH_SLOT_NODE_API_HISTORICAL_SOURCE_SERVER_V2\0src/server.ts",
      ];
  if (
    JSON.stringify(historicalMembership.sort(compareUtf16))
    !== JSON.stringify(expectedHistoricalMembership.sort(compareUtf16))
  ) {
    context.addIssue({
      code: "custom",
      path: ["paths"],
      message: "Historical entrypoint rejection membership must equal the exact profile set",
    });
  }

  const semanticEntries = value.paths.filter((entry) =>
    entry.authority.kind === "semantic_source_path");
  const entrypointEntries = value.paths.filter((entry) =>
    entry.authority.kind === "node_entrypoint_plan");
  const semanticIntentRefs = semanticEntries.flatMap((entry) =>
    entry.authority.kind === "semantic_source_path"
      ? entry.authority.intentBindings.map((binding) => binding.intentRef)
      : []);
  const externalIntentRefs = entrypointEntries.flatMap((entry) =>
    entry.authority.kind === "node_entrypoint_plan"
      ? entry.authority.requirements.map((binding) => binding.intentRef)
      : []);
  const semanticMembership = semanticEntries.flatMap((entry) =>
    entry.authority.kind === "semantic_source_path"
      ? entry.authority.intentBindings.map((binding) => ({
          intentAuthority: {
            ruleSetHash: binding.ruleSetHash,
            scopeRef: binding.scopeRef,
            subjectKind: binding.subjectKind,
            subjectRef: binding.subjectRef,
            intentRef: binding.intentRef,
            intentHash: binding.intentHash,
          },
          bindingHash: binding.tokenBindingHash,
        }))
      : []).sort((left, right) =>
        compareUtf16(left.intentAuthority.intentRef, right.intentAuthority.intentRef));
  const externalMembership = entrypointEntries.flatMap((entry) =>
    entry.authority.kind === "node_entrypoint_plan"
      ? entry.authority.requirements.map((binding) => ({
          intentRef: binding.intentRef,
          requirementHash: binding.requirementHash,
        }))
      : []).sort((left, right) => compareUtf16(left.intentRef, right.intentRef));
  if (
    entrypointEntries.length !== 1
    || semanticIntentRefs.length !== value.semanticCoverage.semanticTokenIntentCount
    || externalIntentRefs.length !== value.semanticCoverage.externalRequirementIntentCount
    || !hasUniqueStrings([...semanticIntentRefs, ...externalIntentRefs])
    || semanticIntentRefs.length + externalIntentRefs.length
      !== value.semanticCoverage.sourceSlotIntentCount
    || value.semanticCoverage.semanticTokenMembershipHash
      !== hashSemanticSourcePathTokenMembershipV2(semanticMembership)
    || value.semanticCoverage.externalRequirementMembershipHash
      !== hashSemanticSourceExternalRequirementMembershipV2(externalMembership)
    || semanticEntries.some((entry) =>
      entry.authority.kind === "semantic_source_path"
      && entry.authority.intentBindings.some((binding) =>
        binding.ruleSetHash !== value.authority.semanticRuleSetHash))
    || entrypointEntries.some((entry) =>
      entry.authority.kind === "node_entrypoint_plan"
      && entry.authority.requirements.some((binding) =>
        binding.ruleSetHash !== value.authority.semanticRuleSetHash))
  ) {
    context.addIssue({
      code: "custom",
      path: ["semanticCoverage"],
      message: "Every source-slot intent must resolve exactly once to a path entry",
    });
  }

  const expectedOwnerRefs = [...new Set([
    "OWNER_NODE_ENTRYPOINT_GENERATOR_V2",
    "OWNER_SETUP_V2",
    ...semanticEntries.flatMap((entry) =>
      entry.authority.kind === "semantic_source_path"
        ? entry.authority.intentBindings.map((binding) => binding.writerOwnerRef)
        : []),
    ...entrypointEntries.flatMap((entry) =>
      entry.authority.kind === "node_entrypoint_plan"
        ? entry.authority.requirements.map((binding) => binding.writerOwnerRef)
        : []),
  ])].sort(compareUtf16);
  if (JSON.stringify(ownerRefs) !== JSON.stringify(expectedOwnerRefs)) {
    context.addIssue({
      code: "custom",
      path: ["owners"],
      message: "File-tree owners must equal every-and-only fixed and semantic writer owner",
    });
  }
  const storyOwnersByRef = new Map(value.owners.flatMap((owner) =>
    owner.kind === "story" ? [[owner.ownerRef, owner] as const] : []));
  const semanticBindings = semanticEntries.flatMap((entry) =>
    entry.authority.kind === "semantic_source_path"
      ? entry.authority.intentBindings
      : []);
  const entrypointRequirements = entrypointEntries.flatMap((entry) =>
    entry.authority.kind === "node_entrypoint_plan"
      ? entry.authority.requirements
      : []);
  if (
    semanticBindings.some((binding) => {
      const owner = storyOwnersByRef.get(binding.writerOwnerRef);
      return !owner
        || owner.storyId !== binding.storyId
        || owner.componentHash !== binding.storyComponentHash;
    })
    || entrypointRequirements.some((requirement) =>
      requirement.storyId === null
        ? requirement.writerOwnerRef !== "OWNER_SETUP_V2"
        : storyOwnersByRef.get(requirement.writerOwnerRef)?.storyId
          !== requirement.storyId)
  ) {
    context.addIssue({
      code: "custom",
      path: ["owners"],
      message: "Every semantic writer must resolve to its exact story component or setup owner",
    });
  }

  if (value.manifestHash !== hashFileTreeManifestV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["manifestHash"],
      message: "File-tree manifest hash must bind the complete scaffold-base-ready snapshot",
    });
  }
}

const FileTreeManifestCandidateV2Schema = FileTreeManifestIdentityV2Schema.extend({
  manifestHash: Sha256Schema,
}).strict().superRefine(addManifestClosureIssues);

export const FileTreeManifestV2Schema = z.unknown().superRefine((value, context) => {
  try {
    canonicalJsonBytesBounded(value, {
      maxBytes: FILE_TREE_MANIFEST_MAX_CANONICAL_BYTES_V2,
      ...FILE_TREE_MANIFEST_BOUNDED_WORK_LIMITS_V2,
    });
  } catch {
    context.addIssue({
      code: "custom",
      message: "File-tree manifest exceeds its canonical byte or work bound",
    });
  }
}).pipe(FileTreeManifestCandidateV2Schema);

export type FileTreeManifestV2 = z.infer<typeof FileTreeManifestCandidateV2Schema>;

export function recursivelyFreezeFileTreeManifestV2<T>(value: T): T {
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
