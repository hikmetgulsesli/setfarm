import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import {
  Sha256Schema,
  StableReferenceSchema,
  ProductIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  PATH_TOKEN_CONTRACT_HASH_V2,
  asciiCaseFoldPathV2,
  portablePathIssuesV2,
} from "./path-token-v2.js";
import {
  SemanticSourceResponsibilityV1Schema,
  SemanticSourceSubjectKindV1Schema,
} from "./stack-semantic-source-rules-v1.js";

export const SEMANTIC_SOURCE_PATH_TOKEN_V2_SCHEMA =
  "setfarm.semantic-source-path-token.v2" as const;
export const SEMANTIC_SOURCE_EXTERNAL_PATH_REQUIREMENT_V2_SCHEMA =
  "setfarm.semantic-source-external-path-requirement.v2" as const;
export const SEMANTIC_SOURCE_PATH_TOKEN_SET_V2_SCHEMA =
  "setfarm.semantic-source-path-token-set.v2" as const;
export const SEMANTIC_SOURCE_PATH_PROJECTION_V2_SCHEMA =
  "setfarm.semantic-source-path-projection.v2" as const;
export const SEMANTIC_SOURCE_PATH_SCOPE_IDENTITY_V2_SCHEMA =
  "setfarm.semantic-source-path-scope-identity.v2" as const;
export const SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA =
  "setfarm.semantic-source-path-subject-identity.v2" as const;
export const SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_VERSION_V2 = "2.0.0" as const;
export const SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_VERSION_V2 =
  "2.0.0" as const;
export const SEMANTIC_SOURCE_PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2 =
  4 * 1024 * 1024;

const SEMANTIC_SOURCE_PATH_TOKEN_ORIGIN_VALUE_FIELDS_V2 = Object.freeze([
  "contractVersion",
  "contractHash",
  "scopeIdentity",
  "subjectIdentity",
  "responsibility",
  "ruleRef",
  "pathProjectionHash",
] as const);

export const SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.semantic-source-path-token-contract.v2" as const,
  contractVersion: SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_VERSION_V2,
  algorithm: "sha256" as const,
  encoding: "setfarm_canonical_json_v1" as const,
  originKind: "semantic_source_intent_path_projection" as const,
  inputFields: SEMANTIC_SOURCE_PATH_TOKEN_ORIGIN_VALUE_FIELDS_V2,
  scopeProjection: Object.freeze([
    "story=>story+productRef",
    "product=>product+productRef",
    "setup=>setup+stackPackId",
    "platform=>platform+platformAuthorityRef",
    "runtime_data_contract=>product+productRef",
    "persistence_absence=>product+productRef",
  ] as const),
  subjectProjection: Object.freeze([
    "entrypoint=>productRef+entrypointKind",
    "command=>commandRef",
    "route=>routeRef",
    "surface=>surfaceRef",
    "control_slot=>controlSlotRef+actionRef",
    "physical_control=>physicalControlRef+controlSlotRef+actionRef",
    "action=>actionRef",
    "action_input=>actionRef+fieldName",
    "state=>stateRef",
    "persistence_policy=>persistenceRef",
    "persistence_absence=>product_aggregate",
    "entity=>entityRef",
    "observable=>observableRef+actionRef",
    "evidence_predicate=>evidenceRef",
    "runtime_data_contract=>product_aggregate",
  ] as const),
  sharedAggregation: Object.freeze({
    runtimeData:
      "SEMANTIC_RUNTIME_DATA_FIXTURE_BY_PRODUCT_V2" as const,
    persistenceAbsence:
      "SEMANTIC_PERSISTENCE_ABSENCE_BY_PRODUCT_V2" as const,
    duplicateLocatorPolicy:
      "same_origin_same_catalog_aggregate_only" as const,
  }),
  forbiddenIdentityInputs: Object.freeze([
    "ruleSetHash",
    "scopeRef",
    "componentHash",
    "intentRef",
    "intentHash",
    "storyId",
    "storyOrder",
    "ordinal",
    "title",
    "label",
    "description",
    "tokenAlgorithm",
    "tokenContractRef",
    "tokenContractHash",
    "pathResolutionHash",
    "legacyV1Token",
    "legacyV1TokenContractHash",
  ] as const),
  pathAssembly: "${root}/${pathToken}${extension}" as const,
  outputEncoding: "lowercase_hex_full_64" as const,
  portabilityContractRef: "PATH_TOKEN_CONTRACT_V2" as const,
  portabilityContractHash: PATH_TOKEN_CONTRACT_HASH_V2,
  hashDomains: Object.freeze({
    origin: "setfarm.semantic-source-path-token-origin-hash.v2" as const,
  }),
  hashPayloadShapes: Object.freeze({
    origin: Object.freeze({
      domainField: "schema" as const,
      wrapper: "origin" as const,
      valueFields: SEMANTIC_SOURCE_PATH_TOKEN_ORIGIN_VALUE_FIELDS_V2,
    }),
  }),
  filesystemRealization: "not_authorized_by_semantic_path_token" as const,
} as const);

export const SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V2 = hashCanonicalJson(
  SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2,
);

export const SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.semantic-source-path-token-set-contract.v2" as const,
  setContractVersion: SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_VERSION_V2,
  tokenContractRef: "SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2" as const,
  tokenContractHash: SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V2,
  artifactSchemas: Object.freeze({
    set: SEMANTIC_SOURCE_PATH_TOKEN_SET_V2_SCHEMA,
    token: SEMANTIC_SOURCE_PATH_TOKEN_V2_SCHEMA,
    externalRequirement: SEMANTIC_SOURCE_EXTERNAL_PATH_REQUIREMENT_V2_SCHEMA,
    scopeIdentity: SEMANTIC_SOURCE_PATH_SCOPE_IDENTITY_V2_SCHEMA,
    subjectIdentity: SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA,
    pathProjection: SEMANTIC_SOURCE_PATH_PROJECTION_V2_SCHEMA,
  }),
  sourceAuthority: "fresh_semantic_source_intent_set_v1" as const,
  partition: Object.freeze({
    token: "pathResolution.kind === compiler_semantic_token_path" as const,
    external: "pathResolution.kind !== compiler_semantic_token_path" as const,
    completeness: "every_source_slot_exactly_once" as const,
    tokenCardinality: "one_binding_per_source_slot_intent" as const,
    uniquePathCount:
      "cardinality_of_physicalSpace_plus_normalizedLocator" as const,
  }),
  semanticProjection: Object.freeze({
    schema: SEMANTIC_SOURCE_PATH_PROJECTION_V2_SCHEMA,
    root: "src/setfarm/semantic" as const,
    extensions: Object.freeze([".ts", ".tsx", ".js", ".jsx", ".py", ".json"]),
    namespace: "repository_source" as const,
    physicalSpace: "repository" as const,
    underRootRef: "PATH_ROOT_NODE_SOURCE_V2" as const,
  }),
  externalProjectionRules: Object.freeze({
    selectedEntrypoint: Object.freeze({
      sourceKind: "selected_entrypoint_path" as const,
      expectationKind: "selected_entrypoint_path" as const,
      requiredAuthority: "node_execution_path_token_v2" as const,
    }),
    generatedReceipt: Object.freeze({
      sourceKind: "generated_receipt_path" as const,
      expectationKind: "generated_receipt_path" as const,
      receiptSchema: "setfarm.generated-source-receipt.v2" as const,
      requiredAuthority: "verified_generated_source_receipt_v2" as const,
    }),
    fixedRelease: Object.freeze({
      sourceKind: "fixed_release_path" as const,
      expectationKind: "fixed_release_path_catalog_required" as const,
      requiredAuthority: "fixed_release_path_catalog_v2" as const,
    }),
    sharedSelectedEntrypoint: Object.freeze({
      sourceKind: "shared_structural_slot_path" as const,
      pathSourceKind: "selected_entrypoint_path" as const,
      expectationKind: "shared_structural_selected_entrypoint" as const,
      requiredAuthority: "node_execution_path_token_v2" as const,
    }),
    sharedFixedRelease: Object.freeze({
      sourceKind: "shared_structural_slot_path" as const,
      pathSourceKind: "fixed_release_path" as const,
      expectationKind:
        "shared_structural_fixed_release_catalog_required" as const,
      requiredAuthority: "fixed_release_path_catalog_v2" as const,
    }),
  }),
  legacyRawPathPolicy: "hash_only_never_locator_authority" as const,
  hashDomains: Object.freeze({
    pathProjection: "setfarm.semantic-source-path-projection-hash.v2" as const,
    tokenBinding: "setfarm.semantic-source-path-token-binding-hash.v2" as const,
    portablePathIdentity: "setfarm.portable-path-identity-hash.v2" as const,
    portableCaseFoldPathIdentity:
      "setfarm.portable-path-ascii-casefold-identity-hash.v2" as const,
    legacyFixedReleaseProjection:
      "setfarm.legacy-fixed-release-path-projection-hash.v1" as const,
    externalPathProjection:
      "setfarm.semantic-source-external-path-projection-hash.v2" as const,
    externalRequirement:
      "setfarm.semantic-source-external-path-requirement-hash.v2" as const,
    tokenMembership:
      "setfarm.semantic-source-path-token-membership-hash.v2" as const,
    externalMembership:
      "setfarm.semantic-source-external-path-requirement-membership-hash.v2" as const,
    set: "setfarm.semantic-source-path-token-set-hash.v2" as const,
  }),
  hashPayloadShapes: Object.freeze({
    pathProjection: Object.freeze({
      domainField: "schema" as const,
      wrapper: "pathProjection" as const,
      valueFields: Object.freeze([
        "schema",
        "root",
        "extension",
        "namespace",
        "physicalSpace",
        "underRootRef",
      ] as const),
    }),
    tokenBinding: Object.freeze({
      domainField: "schema" as const,
      wrapper: "pathTokenBinding" as const,
      valueFields: Object.freeze([
        "schema",
        "origin",
        "intentAuthority",
        "materialization",
        "pathToken",
        "pathProjection",
        "namespace",
        "disposition",
        "nodeKind",
        "physicalSpace",
        "underRootRef",
        "normalizedLocator",
        "locatorByteLength",
        "segmentCount",
        "pathIdentityHash",
        "caseFoldPathIdentityHash",
      ] as const),
    }),
    portablePathIdentity: Object.freeze({
      domainField: "schema" as const,
      topLevelFields: Object.freeze({
        physicalSpace: "physicalSpace" as const,
        locator: "normalizedLocator" as const,
      }),
    }),
    portableCaseFoldPathIdentity: Object.freeze({
      domainField: "schema" as const,
      topLevelFields: Object.freeze({
        physicalSpace: "physicalSpace" as const,
        locator: "asciiCaseFoldedLocator" as const,
      }),
    }),
    legacyFixedReleaseProjection: Object.freeze({
      domainField: "schema" as const,
      topLevelFields: Object.freeze({
        locator: "normalizedLocator" as const,
      }),
    }),
    externalPathProjection: Object.freeze({
      domainField: "schema" as const,
      wrapper: "projection" as const,
      valueMode: "complete_strict_typed_value" as const,
    }),
    externalRequirement: Object.freeze({
      domainField: "schema" as const,
      wrapper: "requirement" as const,
      valueFields: Object.freeze([
        "schema",
        "ruleSetHash",
        "scopeRef",
        "subjectKind",
        "subjectRef",
        "responsibility",
        "ruleRef",
        "intentRef",
        "intentHash",
        "pathAuthorityProjectionHash",
        "expectation",
      ] as const),
    }),
    tokenMembership: Object.freeze({
      domainField: "schema" as const,
      wrapper: "members" as const,
      memberFields: Object.freeze({
        intentRef: "intentRef" as const,
        bindingHash: "bindingHash" as const,
      }),
    }),
    externalMembership: Object.freeze({
      domainField: "schema" as const,
      wrapper: "members" as const,
      memberFields: Object.freeze({
        intentRef: "intentRef" as const,
        requirementHash: "requirementHash" as const,
      }),
    }),
    set: Object.freeze({
      domainField: "schema" as const,
      wrapper: "tokenSet" as const,
      valueFields: Object.freeze([
        "schema",
        "setVersion",
        "tokenContractHash",
        "setContractHash",
        "sourceAuthority",
        "readiness",
        "tokenCount",
        "uniquePathCount",
        "tokens",
        "tokenMembershipHash",
        "externalRequirementCount",
        "externalRequirements",
        "externalRequirementMembershipHash",
      ] as const),
    }),
  }),
  ordering: "utf16_ascending_intent_ref" as const,
  productionUse: "forbidden" as const,
} as const);

export const SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_HASH_V2 = hashCanonicalJson(
  SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2,
);

export const SEMANTIC_SOURCE_PATH_TOKEN_SET_BLOCKER_CODES_V2 = Object.freeze([
  "SEMANTIC_SOURCE_PATH_TOKEN_V2_SOURCE_INTENT_AUTHORITY_SHADOW",
  "SEMANTIC_SOURCE_PATH_TOKEN_V2_EXTERNAL_REQUIREMENTS_UNRESOLVED",
  "SEMANTIC_SOURCE_PATH_TOKEN_V2_FILE_TREE_UNVERIFIED",
  "SEMANTIC_SOURCE_PATH_TOKEN_V2_DECLARATIONS_UNVERIFIED",
  "SEMANTIC_SOURCE_PATH_TOKEN_V2_RELEASE_ACTIVATION_UNVERIFIED",
] as const);

const BlockerCodeV2Schema = z.enum(
  SEMANTIC_SOURCE_PATH_TOKEN_SET_BLOCKER_CODES_V2,
);

const ReadinessV2Schema = z.object({
  status: z.literal("shadow"),
  productionUse: z.literal("forbidden"),
  blockerCodes: z.array(BlockerCodeV2Schema)
    .length(SEMANTIC_SOURCE_PATH_TOKEN_SET_BLOCKER_CODES_V2.length),
}).strict().superRefine((value, context) => {
  if (
    canonicalJsonStringify(value.blockerCodes)
    === canonicalJsonStringify(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_BLOCKER_CODES_V2,
    )
  ) return;
  context.addIssue({
    code: "custom",
    path: ["blockerCodes"],
    message: "Semantic path-token blockers must equal the exact code-owned set",
  });
});

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function projectContractHashFieldsV2(
  value: object,
  fields: readonly string[],
): Readonly<Record<string, unknown>> {
  const record = value as Record<string, unknown>;
  return Object.fromEntries(fields.map((field) => [field, record[field]]));
}

function hashWrappedContractValueV2(
  domain: string,
  shape: Readonly<{
    domainField: string;
    wrapper: string;
    valueFields?: readonly string[];
    valueMode?: "complete_strict_typed_value";
  }>,
  value: object,
): string {
  let wrappedValue: object;
  if (shape.valueFields !== undefined) {
    wrappedValue = projectContractHashFieldsV2(value, shape.valueFields);
  } else if (shape.valueMode === "complete_strict_typed_value") {
    wrappedValue = value;
  } else {
    throw new Error("Unsupported contract hash payload value shape");
  }
  return hashCanonicalJson({
    [shape.domainField]: domain,
    [shape.wrapper]: wrappedValue,
  });
}

export const SemanticSourcePathScopeIdentityV2Schema = z.object({
  schema: z.literal(SEMANTIC_SOURCE_PATH_SCOPE_IDENTITY_V2_SCHEMA),
  scope: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("story"),
      productRef: ProductIdSchema,
    }).strict(),
    z.object({
      kind: z.literal("product"),
      productRef: ProductIdSchema,
    }).strict(),
    z.object({
      kind: z.literal("setup"),
      stackPackId: z.enum(["node-cli", "node-express-api"]),
    }).strict(),
    z.object({
      kind: z.literal("platform"),
      platformAuthorityRef: z.enum([
        "PLATFORM_BUILD_COMMAND_V1",
        "PLATFORM_RUNTIME_REGISTRATION_V1",
      ]),
    }).strict(),
  ]),
}).strict();

export type SemanticSourcePathScopeIdentityV2 = z.infer<
  typeof SemanticSourcePathScopeIdentityV2Schema
>;

export const SemanticSourcePathSubjectIdentityV2Schema = z.discriminatedUnion(
  "originKind",
  [
    z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA),
      originKind: z.literal("entrypoint"),
      subjectKind: z.literal("entrypoint"),
      productRef: ProductIdSchema,
      entrypointKind: z.enum(["web", "cli", "api", "worker", "native", "game"]),
    }).strict(),
    z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA),
      originKind: z.literal("command"),
      subjectKind: z.literal("command"),
      commandRef: StableReferenceSchema,
    }).strict(),
    z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA),
      originKind: z.literal("route"),
      subjectKind: z.literal("route"),
      routeRef: StableReferenceSchema,
    }).strict(),
    z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA),
      originKind: z.literal("surface"),
      subjectKind: z.literal("surface"),
      surfaceRef: StableReferenceSchema,
    }).strict(),
    z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA),
      originKind: z.literal("control_slot"),
      subjectKind: z.literal("control_slot"),
      controlSlotRef: StableReferenceSchema,
      actionRef: StableReferenceSchema,
    }).strict(),
    z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA),
      originKind: z.literal("physical_control"),
      subjectKind: z.literal("physical_control"),
      physicalControlRef: StableReferenceSchema,
      controlSlotRef: StableReferenceSchema,
      actionRef: StableReferenceSchema,
    }).strict(),
    z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA),
      originKind: z.literal("action"),
      subjectKind: z.literal("action"),
      actionRef: StableReferenceSchema,
    }).strict(),
    z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA),
      originKind: z.literal("action_input"),
      subjectKind: z.literal("action_input"),
      actionRef: StableReferenceSchema,
      fieldName: z.string().min(1).max(160),
    }).strict(),
    z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA),
      originKind: z.literal("state"),
      subjectKind: z.literal("state"),
      stateRef: StableReferenceSchema,
    }).strict(),
    z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA),
      originKind: z.literal("persistence_policy"),
      subjectKind: z.literal("persistence_policy"),
      persistenceRef: StableReferenceSchema,
    }).strict(),
    z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA),
      originKind: z.literal("persistence_absence"),
      subjectKind: z.literal("persistence_policy"),
      productRef: ProductIdSchema,
      aggregationRef: z.literal(
        SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2.sharedAggregation
          .persistenceAbsence,
      ),
    }).strict(),
    z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA),
      originKind: z.literal("entity"),
      subjectKind: z.literal("entity"),
      entityRef: StableReferenceSchema,
    }).strict(),
    z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA),
      originKind: z.literal("observable"),
      subjectKind: z.literal("observable"),
      observableRef: StableReferenceSchema,
      actionRef: StableReferenceSchema,
    }).strict(),
    z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA),
      originKind: z.literal("evidence_predicate"),
      subjectKind: z.literal("evidence_predicate"),
      evidenceRef: StableReferenceSchema,
    }).strict(),
    z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_SUBJECT_IDENTITY_V2_SCHEMA),
      originKind: z.literal("runtime_data_contract"),
      subjectKind: z.literal("runtime_data_contract"),
      productRef: ProductIdSchema,
      aggregationRef: z.literal(
        SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2.sharedAggregation.runtimeData,
      ),
    }).strict(),
  ],
);

export type SemanticSourcePathSubjectIdentityV2 = z.infer<
  typeof SemanticSourcePathSubjectIdentityV2Schema
>;

const StablePathIdentityV2Shape = {
  scopeIdentity: SemanticSourcePathScopeIdentityV2Schema,
  subjectIdentity: SemanticSourcePathSubjectIdentityV2Schema,
  responsibility: SemanticSourceResponsibilityV1Schema,
  ruleRef: StableReferenceSchema,
} as const;

const IntentAuthorityBindingV2Shape = {
  ruleSetHash: Sha256Schema,
  scopeRef: StableReferenceSchema,
  subjectKind: SemanticSourceSubjectKindV1Schema,
  subjectRef: StableReferenceSchema,
  responsibility: SemanticSourceResponsibilityV1Schema,
  ruleRef: StableReferenceSchema,
  intentRef: StableReferenceSchema,
  intentHash: Sha256Schema,
} as const;

const TokenIntentAuthorityV2Schema = z.object({
  ruleSetHash: Sha256Schema,
  scopeRef: StableReferenceSchema,
  subjectKind: SemanticSourceSubjectKindV1Schema,
  subjectRef: StableReferenceSchema,
  intentRef: StableReferenceSchema,
  intentHash: Sha256Schema,
}).strict();

const SemanticSourcePathMaterializationV2Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exclusive_file") }).strict(),
  z.object({
    kind: z.literal("shared_catalog_aggregate"),
    aggregationRef: z.enum([
      SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2.sharedAggregation.runtimeData,
      SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2.sharedAggregation
        .persistenceAbsence,
    ]),
  }).strict(),
]);

const SemanticSourcePathProjectionIdentityV2Schema = z.object({
  schema: z.literal(SEMANTIC_SOURCE_PATH_PROJECTION_V2_SCHEMA),
  root: z.literal("src/setfarm/semantic"),
  extension: z.enum([".ts", ".tsx", ".js", ".jsx", ".py", ".json"]),
  namespace: z.literal("repository_source"),
  physicalSpace: z.literal("repository"),
  underRootRef: z.literal("PATH_ROOT_NODE_SOURCE_V2"),
}).strict();

export type SemanticSourcePathProjectionHashPayloadV2 = z.infer<
  typeof SemanticSourcePathProjectionIdentityV2Schema
>;

export function hashSemanticSourcePortablePathIdentityV2(
  physicalSpace: string,
  normalizedLocator: string,
): string {
  const shape = SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashPayloadShapes
    .portablePathIdentity;
  return hashCanonicalJson({
    [shape.domainField]:
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashDomains.portablePathIdentity,
    [shape.topLevelFields.physicalSpace]: physicalSpace,
    [shape.topLevelFields.locator]: normalizedLocator,
  });
}

export function hashSemanticSourcePortableCaseFoldPathIdentityV2(
  physicalSpace: string,
  normalizedLocator: string,
): string {
  const shape = SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashPayloadShapes
    .portableCaseFoldPathIdentity;
  return hashCanonicalJson({
    [shape.domainField]:
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashDomains
        .portableCaseFoldPathIdentity,
    [shape.topLevelFields.physicalSpace]: physicalSpace,
    [shape.topLevelFields.locator]: asciiCaseFoldPathV2(normalizedLocator),
  });
}

export function hashSemanticSourceLegacyFixedReleaseProjectionV2(
  normalizedLocator: string,
): string {
  const shape = SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashPayloadShapes
    .legacyFixedReleaseProjection;
  return hashCanonicalJson({
    [shape.domainField]:
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashDomains
        .legacyFixedReleaseProjection,
    [shape.topLevelFields.locator]: normalizedLocator,
  });
}

export function hashSemanticSourcePathProjectionV2(
  value: SemanticSourcePathProjectionHashPayloadV2,
): string {
  return hashWrappedContractValueV2(
    SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashDomains.pathProjection,
    SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashPayloadShapes.pathProjection,
    value,
  );
}

const SemanticSourcePathProjectionCandidateV2Schema =
  SemanticSourcePathProjectionIdentityV2Schema.extend({
    projectionHash: Sha256Schema,
  }).strict();

export const SemanticSourcePathProjectionV2Schema =
  SemanticSourcePathProjectionCandidateV2Schema.superRefine((value, context) => {
    const { projectionHash: _projectionHash, ...identity } = value;
    if (value.projectionHash === hashSemanticSourcePathProjectionV2(identity)) return;
    context.addIssue({
      code: "custom",
      path: ["projectionHash"],
      message: "Semantic path projection hash must bind the exact V2 path plan",
    });
  });

export type SemanticSourcePathProjectionV2 = z.infer<
  typeof SemanticSourcePathProjectionV2Schema
>;

const SemanticSourcePathTokenOriginV2Schema = z.object({
  contractVersion: z.literal(SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_VERSION_V2),
  contractHash: z.literal(SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V2),
  ...StablePathIdentityV2Shape,
  pathProjectionHash: Sha256Schema,
}).strict();

export type SemanticSourcePathTokenOriginV2 = z.infer<
  typeof SemanticSourcePathTokenOriginV2Schema
>;

export function hashSemanticSourcePathTokenOriginV2(
  origin: SemanticSourcePathTokenOriginV2,
): string {
  return hashWrappedContractValueV2(
    SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2.hashDomains.origin,
    SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V2.hashPayloadShapes.origin,
    origin,
  );
}

const SemanticSourcePathTokenIdentityV2Schema = z.object({
  schema: z.literal(SEMANTIC_SOURCE_PATH_TOKEN_V2_SCHEMA),
  origin: SemanticSourcePathTokenOriginV2Schema,
  intentAuthority: TokenIntentAuthorityV2Schema,
  materialization: SemanticSourcePathMaterializationV2Schema,
  pathToken: Sha256Schema,
  pathProjection: SemanticSourcePathProjectionV2Schema,
  namespace: z.literal("repository_source"),
  disposition: z.literal("planned"),
  nodeKind: z.literal("file"),
  physicalSpace: z.literal("repository"),
  underRootRef: z.literal("PATH_ROOT_NODE_SOURCE_V2"),
  normalizedLocator: z.string().min(1).max(1_024),
  locatorByteLength: z.number().int().positive().max(1_024),
  segmentCount: z.number().int().positive().max(64),
  pathIdentityHash: Sha256Schema,
  caseFoldPathIdentityHash: Sha256Schema,
}).strict();

export type SemanticSourcePathTokenBindingHashPayloadV2 = z.infer<
  typeof SemanticSourcePathTokenIdentityV2Schema
>;

export function hashSemanticSourcePathTokenBindingV2(
  value: SemanticSourcePathTokenBindingHashPayloadV2,
): string {
  return hashWrappedContractValueV2(
    SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashDomains.tokenBinding,
    SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashPayloadShapes.tokenBinding,
    value,
  );
}

const SemanticSourcePathTokenCandidateV2Schema =
  SemanticSourcePathTokenIdentityV2Schema.extend({
    bindingHash: Sha256Schema,
  }).strict();

export const SemanticSourcePathTokenV2Schema =
  SemanticSourcePathTokenCandidateV2Schema.superRefine((value, context) => {
    const subject = value.origin.subjectIdentity;
    const expectedAggregationRef = subject.originKind === "runtime_data_contract"
      || subject.originKind === "persistence_absence"
      ? subject.aggregationRef
      : null;
    if (
      (expectedAggregationRef === null
        && value.materialization.kind !== "exclusive_file")
      || (expectedAggregationRef !== null
        && (
          value.materialization.kind !== "shared_catalog_aggregate"
          || value.materialization.aggregationRef !== expectedAggregationRef
        ))
    ) {
      context.addIssue({
        code: "custom",
        path: ["materialization"],
        message: "Semantic path materialization must equal its stable subject projection",
      });
    }
    const issues = portablePathIssuesV2(value.normalizedLocator, {
      allowEmpty: false,
    });
    for (const issue of issues) {
      context.addIssue({
        code: "custom",
        path: ["normalizedLocator"],
        message: issue,
      });
    }
    if (value.origin.pathProjectionHash !== value.pathProjection.projectionHash) {
      context.addIssue({
        code: "custom",
        path: ["origin", "pathProjectionHash"],
        message: "Token origin must bind the exact V2 path projection",
      });
    }
    if (value.pathToken !== hashSemanticSourcePathTokenOriginV2(value.origin)) {
      context.addIssue({
        code: "custom",
        path: ["pathToken"],
        message: "Semantic path token must bind the exact stable origin tuple",
      });
    }
    const expectedLocator =
      `${value.pathProjection.root}/${value.pathToken}${value.pathProjection.extension}`;
    if (value.normalizedLocator !== expectedLocator) {
      context.addIssue({
        code: "custom",
        path: ["normalizedLocator"],
        message: "Semantic locator must equal the exact V2 projection assembly",
      });
    }
    if (
      value.namespace !== value.pathProjection.namespace
      || value.physicalSpace !== value.pathProjection.physicalSpace
      || value.underRootRef !== value.pathProjection.underRootRef
    ) {
      context.addIssue({
        code: "custom",
        path: ["pathProjection"],
        message: "Token namespace, physical space, and root must equal its path projection",
      });
    }
    if (
      value.locatorByteLength
      !== Buffer.byteLength(value.normalizedLocator, "utf8")
      || value.segmentCount !== value.normalizedLocator.split("/").length
    ) {
      context.addIssue({
        code: "custom",
        path: ["locatorByteLength"],
        message: "Semantic locator byte and segment counts must be exact",
      });
    }
    if (
      value.pathIdentityHash
      !== hashSemanticSourcePortablePathIdentityV2(
        value.physicalSpace,
        value.normalizedLocator,
      )
      || value.caseFoldPathIdentityHash
      !== hashSemanticSourcePortableCaseFoldPathIdentityV2(
        value.physicalSpace,
        value.normalizedLocator,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["pathIdentityHash"],
        message: "Semantic token path identities must bind exact and ASCII-folded locators",
      });
    }
    const { bindingHash: _bindingHash, ...identity } = value;
    if (value.bindingHash !== hashSemanticSourcePathTokenBindingV2(identity)) {
      context.addIssue({
        code: "custom",
        path: ["bindingHash"],
        message: "Semantic path token binding hash must bind the complete token",
      });
    }
  });

export type SemanticSourcePathTokenV2 = z.infer<
  typeof SemanticSourcePathTokenV2Schema
>;

const ExternalResolutionExpectationV2Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.externalProjectionRules
        .selectedEntrypoint.expectationKind,
    ),
    entrypointKind: z.enum(["web", "cli", "api", "worker", "native", "game"]),
    requiredAuthority: z.literal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.externalProjectionRules
        .selectedEntrypoint.requiredAuthority,
    ),
  }).strict(),
  z.object({
    kind: z.literal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.externalProjectionRules
        .sharedSelectedEntrypoint.expectationKind,
    ),
    entrypointKind: z.enum(["web", "cli", "api", "worker", "native", "game"]),
    requiredAuthority: z.literal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.externalProjectionRules
        .sharedSelectedEntrypoint.requiredAuthority,
    ),
  }).strict(),
  z.object({
    kind: z.literal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.externalProjectionRules
        .generatedReceipt.expectationKind,
    ),
    receiptSchema: z.literal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.externalProjectionRules
        .generatedReceipt.receiptSchema,
    ),
    requiredAuthority: z.literal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.externalProjectionRules
        .generatedReceipt.requiredAuthority,
    ),
  }).strict(),
  z.object({
    kind: z.literal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.externalProjectionRules
        .fixedRelease.expectationKind,
    ),
    requiredAuthority: z.literal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.externalProjectionRules
        .fixedRelease.requiredAuthority,
    ),
    legacyProjectionHash: Sha256Schema,
  }).strict(),
  z.object({
    kind: z.literal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.externalProjectionRules
        .sharedFixedRelease.expectationKind,
    ),
    requiredAuthority: z.literal(
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.externalProjectionRules
        .sharedFixedRelease.requiredAuthority,
    ),
    legacyProjectionHash: Sha256Schema,
  }).strict(),
]);

export type ExternalResolutionExpectationV2 = z.infer<
  typeof ExternalResolutionExpectationV2Schema
>;

export function hashSemanticSourceExternalPathProjectionV2(
  expectation: ExternalResolutionExpectationV2,
): string {
  return hashWrappedContractValueV2(
    SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashDomains
      .externalPathProjection,
    SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashPayloadShapes
      .externalPathProjection,
    expectation,
  );
}

const ExternalPathRequirementIdentityV2Schema = z.object({
  schema: z.literal(SEMANTIC_SOURCE_EXTERNAL_PATH_REQUIREMENT_V2_SCHEMA),
  ...IntentAuthorityBindingV2Shape,
  pathAuthorityProjectionHash: Sha256Schema,
  expectation: ExternalResolutionExpectationV2Schema,
}).strict();

export type ExternalPathRequirementHashPayloadV2 = z.infer<
  typeof ExternalPathRequirementIdentityV2Schema
>;

export function hashSemanticSourceExternalPathRequirementV2(
  value: ExternalPathRequirementHashPayloadV2,
): string {
  return hashWrappedContractValueV2(
    SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashDomains.externalRequirement,
    SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashPayloadShapes
      .externalRequirement,
    value,
  );
}

const ExternalPathRequirementCandidateV2Schema =
  ExternalPathRequirementIdentityV2Schema.extend({
    requirementHash: Sha256Schema,
  }).strict();

export const SemanticSourceExternalPathRequirementV2Schema =
  ExternalPathRequirementCandidateV2Schema.superRefine((value, context) => {
    if (
      value.pathAuthorityProjectionHash
      !== hashSemanticSourceExternalPathProjectionV2(value.expectation)
    ) {
      context.addIssue({
        code: "custom",
        path: ["pathAuthorityProjectionHash"],
        message: "External path projection hash must bind the exact typed expectation",
      });
    }
    const { requirementHash: _requirementHash, ...identity } = value;
    if (
      value.requirementHash
      === hashSemanticSourceExternalPathRequirementV2(identity)
    ) return;
    context.addIssue({
      code: "custom",
      path: ["requirementHash"],
      message: "External path requirement hash must bind the complete requirement",
    });
  });

export type SemanticSourceExternalPathRequirementV2 = z.infer<
  typeof SemanticSourceExternalPathRequirementV2Schema
>;

export function hashSemanticSourcePathTokenMembershipV2(
  tokens: readonly Pick<
    SemanticSourcePathTokenV2,
    "intentAuthority" | "bindingHash"
  >[],
): string {
  const shape = SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashPayloadShapes
    .tokenMembership;
  return hashCanonicalJson({
    [shape.domainField]:
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashDomains.tokenMembership,
    [shape.wrapper]: tokens.map((token) => ({
      [shape.memberFields.intentRef]: token.intentAuthority.intentRef,
      [shape.memberFields.bindingHash]: token.bindingHash,
    })),
  });
}

export function hashSemanticSourceExternalRequirementMembershipV2(
  requirements: readonly Pick<
    SemanticSourceExternalPathRequirementV2,
    "intentRef" | "requirementHash"
  >[],
): string {
  const shape = SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashPayloadShapes
    .externalMembership;
  return hashCanonicalJson({
    [shape.domainField]:
      SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashDomains.externalMembership,
    [shape.wrapper]: requirements.map((requirement) => ({
      [shape.memberFields.intentRef]: requirement.intentRef,
      [shape.memberFields.requirementHash]: requirement.requirementHash,
    })),
  });
}

const SourceAuthorityV2Schema = z.object({
  kind: z.literal("semantic_source_intent_set_v1"),
  productRef: ProductIdSchema,
  productSpecHash: Sha256Schema,
  deliverySelectionHash: Sha256Schema,
  profileId: z.enum([
    "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
  ]),
  stackPackId: z.enum(["node-cli", "node-express-api"]),
  semanticRuleSetHash: Sha256Schema,
  semanticIntentSetHash: Sha256Schema,
  sourceSlotIntentCount: z.number().int().positive().max(20_000),
}).strict();

const SemanticSourcePathTokenSetCandidateV2Schema = z.object({
  schema: z.literal(SEMANTIC_SOURCE_PATH_TOKEN_SET_V2_SCHEMA),
  setVersion: z.literal(SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_VERSION_V2),
  tokenContractHash: z.literal(SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V2),
  setContractHash: z.literal(SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_HASH_V2),
  sourceAuthority: SourceAuthorityV2Schema,
  readiness: ReadinessV2Schema,
  tokenCount: z.number().int().nonnegative().max(20_000),
  uniquePathCount: z.number().int().nonnegative().max(20_000),
  tokens: z.array(SemanticSourcePathTokenV2Schema).max(20_000),
  tokenMembershipHash: Sha256Schema,
  externalRequirementCount: z.number().int().nonnegative().max(20_000),
  externalRequirements: z.array(
    SemanticSourceExternalPathRequirementV2Schema,
  ).max(20_000),
  externalRequirementMembershipHash: Sha256Schema,
  setHash: Sha256Schema,
}).strict();

export type SemanticSourcePathTokenSetV2 = z.infer<
  typeof SemanticSourcePathTokenSetCandidateV2Schema
>;

export function hashSemanticSourcePathTokenSetV2(
  value:
    | Omit<SemanticSourcePathTokenSetV2, "setHash">
    | SemanticSourcePathTokenSetV2,
): string {
  return hashWrappedContractValueV2(
    SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashDomains.set,
    SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_V2.hashPayloadShapes.set,
    value,
  );
}

function addSetClosureIssues(
  value: SemanticSourcePathTokenSetV2,
  context: z.RefinementCtx,
): void {
  const tokenRefs = value.tokens.map((token) =>
    token.intentAuthority.intentRef);
  const requirementRefs = value.externalRequirements.map((item) => item.intentRef);
  if (
    value.tokenCount !== value.tokens.length
    || !hasUniqueStrings(tokenRefs)
    || value.tokens.some((token, index) =>
      index > 0
      && compareUtf16(
        value.tokens[index - 1]!.intentAuthority.intentRef,
        token.intentAuthority.intentRef,
      ) >= 0)
  ) {
    context.addIssue({
      code: "custom",
      path: ["tokens"],
      message: "Semantic path tokens must be complete, unique, and ordered by intentRef",
    });
  }
  const uniquePathKeys = new Set(value.tokens.map((token) =>
    `${token.physicalSpace}\0${token.normalizedLocator}`));
  if (value.uniquePathCount !== uniquePathKeys.size) {
    context.addIssue({
      code: "custom",
      path: ["uniquePathCount"],
      message: "Unique semantic path count must equal the exact materialization set",
    });
  }
  if (
    value.externalRequirementCount !== value.externalRequirements.length
    || !hasUniqueStrings(requirementRefs)
    || value.externalRequirements.some((item, index) =>
      index > 0
      && compareUtf16(
        value.externalRequirements[index - 1]!.intentRef,
        item.intentRef,
      ) >= 0)
  ) {
    context.addIssue({
      code: "custom",
      path: ["externalRequirements"],
      message: "External path requirements must be complete, unique, and ordered by intentRef",
    });
  }
  const allIntentRefs = [...tokenRefs, ...requirementRefs];
  if (
    !hasUniqueStrings(allIntentRefs)
    || allIntentRefs.length !== value.sourceAuthority.sourceSlotIntentCount
  ) {
    context.addIssue({
      code: "custom",
      path: ["sourceAuthority", "sourceSlotIntentCount"],
      message: "Every source-slot intent must have exactly one token or external requirement",
    });
  }
  for (let index = 0; index < value.tokens.length; index += 1) {
    const token = value.tokens[index]!;
    if (
      token.origin.contractHash !== value.tokenContractHash
      || token.intentAuthority.ruleSetHash
        !== value.sourceAuthority.semanticRuleSetHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["tokens", index, "origin"],
        message: "Every semantic token must bind the set contract and exact rule set",
      });
    }
  }
  for (let index = 0; index < value.externalRequirements.length; index += 1) {
    const requirement = value.externalRequirements[index]!;
    if (requirement.ruleSetHash !== value.sourceAuthority.semanticRuleSetHash) {
      context.addIssue({
        code: "custom",
        path: ["externalRequirements", index, "ruleSetHash"],
        message: "Every external path requirement must bind the exact rule set",
      });
    }
  }
  const exactPaths = new Map<string, SemanticSourcePathTokenV2>();
  const foldedPaths = new Map<string, string>();
  const directorySpellings = new Map<string, string>();
  value.tokens.forEach((token, index) => {
    const exactKey = `${token.physicalSpace}\u0000${token.normalizedLocator}`;
    const foldedKey =
      `${token.physicalSpace}\u0000${asciiCaseFoldPathV2(token.normalizedLocator)}`;
    const exactExisting = exactPaths.get(exactKey);
    const foldedExisting = foldedPaths.get(foldedKey);
    const sameCatalogAggregate = exactExisting !== undefined
      && exactExisting.materialization.kind === "shared_catalog_aggregate"
      && token.materialization.kind === "shared_catalog_aggregate"
      && exactExisting.materialization.aggregationRef
        === token.materialization.aggregationRef
      && exactExisting.pathToken === token.pathToken
      && canonicalJsonStringify(exactExisting.origin)
        === canonicalJsonStringify(token.origin);
    if (
      (exactExisting !== undefined && !sameCatalogAggregate)
      || (foldedExisting !== undefined && foldedExisting !== exactKey)
    ) {
      context.addIssue({
        code: "custom",
        path: ["tokens", index, "normalizedLocator"],
        message: "Semantic token locators must be collision-free or one exact catalog aggregate",
      });
    }
    if (exactExisting === undefined) exactPaths.set(exactKey, token);
    if (foldedExisting === undefined) foldedPaths.set(foldedKey, exactKey);
    const segments = token.normalizedLocator.split("/");
    for (let length = 1; length < segments.length; length += 1) {
      const exactPrefix = segments.slice(0, length).join("/");
      const directoryKey =
        `${token.physicalSpace}\u0000${asciiCaseFoldPathV2(exactPrefix)}`;
      const existing = directorySpellings.get(directoryKey);
      if (existing !== undefined && existing !== exactPrefix) {
        context.addIssue({
          code: "custom",
          path: ["tokens", index, "normalizedLocator"],
          message: "Semantic directory prefixes must have one exact ASCII casing",
        });
      }
      directorySpellings.set(directoryKey, exactPrefix);
    }
  });
  if (
    value.tokenMembershipHash
    !== hashSemanticSourcePathTokenMembershipV2(value.tokens)
  ) {
    context.addIssue({
      code: "custom",
      path: ["tokenMembershipHash"],
      message: "Token membership hash must bind the exact ordered token set",
    });
  }
  if (
    value.externalRequirementMembershipHash
    !== hashSemanticSourceExternalRequirementMembershipV2(
      value.externalRequirements,
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["externalRequirementMembershipHash"],
      message: "External membership hash must bind the exact ordered requirement set",
    });
  }
  if (value.setHash !== hashSemanticSourcePathTokenSetV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["setHash"],
      message: "Semantic path-token set hash must bind the complete canonical artifact",
    });
  }
}

const SemanticSourcePathTokenSetContentV2Schema =
  SemanticSourcePathTokenSetCandidateV2Schema.superRefine(
    addSetClosureIssues,
  );

const BoundedSemanticSourcePathTokenSetV2Schema = z.unknown()
  .superRefine((value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: SEMANTIC_SOURCE_PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2,
        maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 8,
        maxNodes:
          SEMANTIC_SOURCE_PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2 + 16_384,
        maxContainerEntries:
          DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
        maxWorkUnits:
          (SEMANTIC_SOURCE_PATH_TOKEN_SET_MAX_CANONICAL_BYTES_V2 * 8)
          + 1_048_576,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: "Semantic path-token set exceeds canonical byte or work limits",
      });
    }
  });

export const SemanticSourcePathTokenSetV2Schema =
  BoundedSemanticSourcePathTokenSetV2Schema.pipe(
    SemanticSourcePathTokenSetContentV2Schema,
  );
