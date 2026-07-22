import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { hashCanonicalJson } from "../canonical-json.js";
import {
  OwnerIdSchema,
  PathBindingIdSchema,
  ProductIdSchema,
  Sha256Schema,
  StableReferenceSchema,
  StoryIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  BUILD_TOPOLOGY_CONTRACT_HASH_V2,
  BUILD_TOPOLOGY_V2_SCHEMA,
  BUILD_TOPOLOGY_VERSION_V2,
} from "./build-topology-v2.js";
import {
  FILE_TREE_MANIFEST_CONTRACT_HASH_V2,
  FILE_TREE_MANIFEST_V2_SCHEMA,
  FILE_TREE_MANIFEST_VERSION_V2,
} from "./file-tree-manifest-v2.js";
import {
  SEMANTIC_SOURCE_INTENT_SET_SCHEMA_V1,
} from "./semantic-source-intent-set-v1.js";
import {
  SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_VERSION_V2,
  SEMANTIC_SOURCE_PATH_TOKEN_SET_V2_SCHEMA,
} from "./semantic-source-path-token-set-v2.js";
import {
  STACK_SEMANTIC_SOURCE_RULE_SET_SCHEMA_V1,
  TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_HASH_V1,
} from "./stack-semantic-source-rules-v1.js";

export const NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_V2_SCHEMA =
  "setfarm.node-semantic-rule-generator-transition.v2" as const;
export const NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_VERSION_V2 = "2.0.0" as const;
export const NODE_ENTRYPOINT_GENERATOR_CONTRACT_V2_SCHEMA =
  "setfarm.node-entrypoint-generator-contract.v2" as const;
export const NODE_ENTRYPOINT_SOURCE_RECEIPT_V2_SCHEMA =
  "setfarm.node-entrypoint-source-receipt.v2" as const;
export const NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_CANONICAL_BYTES_V2 =
  4 * 1024 * 1024;
export const NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_ROUTE_COUNT_V2 = 500;
export const NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_COUNT_V2 =
  NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_ROUTE_COUNT_V2 + 2;
export const NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_BOUNDED_WORK_LIMITS_V2 =
  Object.freeze({
    maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 16,
    maxNodes:
      NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_CANONICAL_BYTES_V2 + 30_000,
    maxContainerEntries:
      DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
    maxWorkUnits:
      (NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_CANONICAL_BYTES_V2 * 8)
      + (2 * 1024 * 1024),
  });

export const NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_BLOCKER_CODES_V2 =
  Object.freeze([
    "NODE_ENTRYPOINT_V2_GENERATOR_IMPLEMENTATION_UNVERIFIED",
    "NODE_ENTRYPOINT_V2_RELEASE_MANIFEST_UNVERIFIED",
    "NODE_ENTRYPOINT_V2_RULE_ACTIVATION_UNVERIFIED",
    "NODE_ENTRYPOINT_V2_SEMANTIC_DECLARATIONS_UNVERIFIED",
    "NODE_ENTRYPOINT_V2_SOURCE_RECEIPT_UNVERIFIED",
  ] as const);

export const NODE_ENTRYPOINT_GENERATOR_CONTRACT_V2 = Object.freeze({
  schema: NODE_ENTRYPOINT_GENERATOR_CONTRACT_V2_SCHEMA,
  contractVersion: NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_VERSION_V2,
  generatorRef: "NODE_ENTRYPOINT_GENERATOR_V2" as const,
  ownership: Object.freeze({
    ownerRef: "OWNER_NODE_ENTRYPOINT_GENERATOR_V2" as const,
    wholeFile: true as const,
    modelWriteAuthority: "forbidden" as const,
    outputPolicy: "deterministic_generated" as const,
  }),
  inputAuthorities: Object.freeze([
    "verified_product_spec_v2",
    "verified_product_delivery_selection_v2",
    "verified_semantic_source_intent_set_v1",
    "verified_semantic_source_path_token_set_v2",
    "verified_file_tree_manifest_v2",
    "verified_build_topology_v2",
    "verified_node_semantic_rule_generator_transition_v2",
    "verified_semantic_source_declarations_v1",
  ] as const),
  legacyTransition: Object.freeze({
    sourceRuleSchema: STACK_SEMANTIC_SOURCE_RULE_SET_SCHEMA_V1,
    eligibleResponsibilities: Object.freeze([
      "entrypoint_registration",
      "route_registration",
      "runtime_registration",
    ] as const),
    requiredRuleKind: "source_slot" as const,
    requiredTargetKind: "project_source" as const,
    requiredOwnerPolicy: "setup_owner" as const,
    requiredPathResolutionKind: "shared_structural_slot_path" as const,
    requiredPathSourceKind: "selected_entrypoint_path" as const,
    requiredLocatorKind: "versioned_ast_slot" as const,
    requiredAccessPolicy: "granted_writable" as const,
    requiredOutputPolicy: "model_writable" as const,
    responsibilityDispositions: Object.freeze({
      entrypoint_registration: "generator_owned_entrypoint_shell" as const,
      route_registration:
        "generator_owned_declaration_driven_route_registration" as const,
      runtime_registration: "generator_owned_runtime_abi_surface" as const,
    }),
    mutationPolicy: "v1_remains_historical_transition_is_new_authority" as const,
  }),
  declarationJoin: Object.freeze({
    schema: "setfarm.semantic-source-declarations.v1" as const,
    sourceModuleAuthority: "exact_versioned_export_declarations" as const,
    missingDisposition: "typed_precondition_rejection" as const,
  }),
  sourceOutput: Object.freeze({
    receiptSchema: NODE_ENTRYPOINT_SOURCE_RECEIPT_V2_SCHEMA,
    mediaType: "text/typescript" as const,
    encoding: "utf-8" as const,
    newline: "lf" as const,
    moduleSystem: "node_esm" as const,
    sourceMutationAfterReceipt: "forbidden" as const,
  }),
  profiles: Object.freeze([
    Object.freeze({
      profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2" as const,
      stackPackId: "node-cli" as const,
      entrypointKind: "cli" as const,
      sourcePathSlotRef: "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2" as const,
      buildOutputPathSlotRef: "PATH_SLOT_NODE_CLI_BUILD_OUTPUT_V2" as const,
      candidateModulePathSlotRef: "PATH_SLOT_NODE_CLI_CANDIDATE_MODULE_V2" as const,
      runtimeTarget: Object.freeze({
        kind: "cli_process_module" as const,
        entrypointAbi: "NODE_ESM_CLI_ENTRYPOINT_ABI_V2" as const,
        exportName: null,
        argvOwnership: "executable_invocation_transport_binding_v2" as const,
        transportArguments: "append_after_module" as const,
      }),
    }),
    Object.freeze({
      profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2" as const,
      stackPackId: "node-express-api" as const,
      entrypointKind: "api" as const,
      sourcePathSlotRef: "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2" as const,
      buildOutputPathSlotRef: "PATH_SLOT_NODE_API_BUILD_OUTPUT_V2" as const,
      candidateModulePathSlotRef: "PATH_SLOT_NODE_API_CANDIDATE_MODULE_V2" as const,
      runtimeTarget: Object.freeze({
        kind: "http_handler_export" as const,
        exportName: "setfarmHttpHandlerV2" as const,
        handlerAbi: "EXPRESS_REQUEST_HANDLER_ABI_V2" as const,
        serverOwnership: "platform_owned" as const,
        listenerOwnership: "platform_owned" as const,
        socketOwnership: "platform_owned" as const,
        candidateListen: "forbidden" as const,
      }),
    }),
  ] as const),
  determinism: Object.freeze({
    clock: "forbidden" as const,
    randomness: "forbidden" as const,
    network: "forbidden" as const,
    ambientEnvironment: "forbidden" as const,
    filesystemDiscovery: "forbidden" as const,
    ordering: "canonical_utf16" as const,
  }),
  hashDomains: Object.freeze({
    generatorProfile:
      "setfarm.node-entrypoint-generator-profile-hash.v2" as const,
    transitionRef:
      "setfarm.node-semantic-rule-generator-transition-ref.v2" as const,
    transitionEntry:
      "setfarm.node-semantic-rule-generator-transition-entry-hash.v2" as const,
    transitionMembership:
      "setfarm.node-semantic-rule-generator-transition-membership-hash.v2" as const,
    transition:
      "setfarm.node-semantic-rule-generator-transition-hash.v2" as const,
  }),
} as const);

export const NODE_ENTRYPOINT_GENERATOR_CONTRACT_HASH_V2 = hashCanonicalJson(
  NODE_ENTRYPOINT_GENERATOR_CONTRACT_V2,
);

export type NodeEntrypointGeneratorProfileV2 =
  typeof NODE_ENTRYPOINT_GENERATOR_CONTRACT_V2.profiles[number];

export function hashNodeEntrypointGeneratorProfileV2(
  value: NodeEntrypointGeneratorProfileV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-entrypoint-generator-profile-hash.v2",
    profile: value,
  });
}

export const NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.node-semantic-rule-generator-transition-contract.v2" as const,
  contractVersion: NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_VERSION_V2,
  artifactSchema: NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_V2_SCHEMA,
  generatorContractSchema: NODE_ENTRYPOINT_GENERATOR_CONTRACT_V2_SCHEMA,
  generatorContractHash: NODE_ENTRYPOINT_GENERATOR_CONTRACT_HASH_V2,
  sourceSchemas: Object.freeze({
    semanticRules: STACK_SEMANTIC_SOURCE_RULE_SET_SCHEMA_V1,
    semanticIntents: SEMANTIC_SOURCE_INTENT_SET_SCHEMA_V1,
    semanticPaths: SEMANTIC_SOURCE_PATH_TOKEN_SET_V2_SCHEMA,
    fileTree: FILE_TREE_MANIFEST_V2_SCHEMA,
    buildTopology: BUILD_TOPOLOGY_V2_SCHEMA,
  }),
  completeness: Object.freeze({
    source: "every_file_tree_entrypoint_requirement_exactly_once" as const,
    entrypointRegistrationCount: 1 as const,
    minimumRouteRegistrationCount: 1 as const,
    maximumRouteRegistrationCount:
      NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_ROUTE_COUNT_V2,
    runtimeRegistrationCount: 1 as const,
    maximumTransitionCount:
      NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_COUNT_V2,
  }),
  identity: Object.freeze({
    stableHash: "transitionHash" as const,
    buildBinding: "logicalBuildHash" as const,
    excludedAttemptAuthority: Object.freeze([
      "admissionScope",
      "buildTopologyManifestHash",
      "dependencyReceiptHash",
      "privateRoot",
      "projectScopeHash",
    ] as const),
  }),
  blockerCodes: NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_BLOCKER_CODES_V2,
} as const);

export const NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_CONTRACT_HASH_V2 =
  hashCanonicalJson(NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_CONTRACT_V2);

const ProfileIdV2Schema = z.enum([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);
const StackPackIdV2Schema = z.enum(["node-cli", "node-express-api"]);
const EntrypointKindV2Schema = z.enum(["cli", "api"]);
const TransitionResponsibilityV2Schema = z.enum([
  "entrypoint_registration",
  "route_registration",
  "runtime_registration",
]);
const TransitionDispositionV2Schema = z.enum([
  "generator_owned_declaration_driven_route_registration",
  "generator_owned_entrypoint_shell",
  "generator_owned_runtime_abi_surface",
]);
const BlockerCodeV2Schema = z.enum(
  NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_BLOCKER_CODES_V2,
);

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalStrings(values: readonly string[]): boolean {
  return hasUniqueStrings(values)
    && values.every((value, index) =>
      index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

export function nodeSemanticRuleGeneratorDispositionV2(
  responsibility: z.infer<typeof TransitionResponsibilityV2Schema>,
): z.infer<typeof TransitionDispositionV2Schema> {
  return NODE_ENTRYPOINT_GENERATOR_CONTRACT_V2
    .legacyTransition.responsibilityDispositions[responsibility];
}

export function deriveNodeSemanticRuleGeneratorTransitionRefV2(value: Readonly<{
  generatorContractHash: string;
  generatorProfileHash: string;
  ruleSetHash: string;
  intentRef: string;
  requirementHash: string;
  entrypointPathRef: string;
}>): string {
  return `TRANSITION_${hashCanonicalJson({
    schema: "setfarm.node-semantic-rule-generator-transition-ref.v2",
    transition: value,
  }).toUpperCase()}`;
}

const TransitionEntryIdentityV2Schema = z.object({
  transitionRef: StableReferenceSchema,
  source: z.object({
    ruleSetSchema: z.literal(STACK_SEMANTIC_SOURCE_RULE_SET_SCHEMA_V1),
    ruleSetRef: StableReferenceSchema,
    ruleSetVersion: z.literal("1.0.0"),
    ruleSetHash: Sha256Schema,
    ruleRef: StableReferenceSchema,
    ruleVersion: z.literal("1.0.0"),
    ruleHash: Sha256Schema,
    intentRef: StableReferenceSchema,
    intentHash: Sha256Schema,
    requirementHash: Sha256Schema,
    pathAuthorityProjectionHash: Sha256Schema,
    scopeRef: StableReferenceSchema,
    subjectKind: z.enum(["entrypoint", "route"]),
    subjectRef: StableReferenceSchema,
    subjectHash: Sha256Schema,
    responsibility: TransitionResponsibilityV2Schema,
    storyId: StoryIdSchema.nullable(),
    writerOwnerRef: OwnerIdSchema,
    ruleKind: z.literal("source_slot"),
    targetKind: z.literal("project_source"),
    ownerPolicy: z.literal("setup_owner"),
    pathResolution: z.literal("shared_structural_selected_entrypoint"),
    pathSourceEntrypointKind: EntrypointKindV2Schema,
    cardinality: z.object({
      kind: z.literal("catalog_bounded_aggregate"),
      maxMembers: z.union([z.literal(64), z.literal(500)]),
      slotKeyDomainRef: StableReferenceSchema,
    }).strict(),
    locatorKind: z.literal("versioned_ast_slot"),
    parserRef: z.literal("PARSER_TYPESCRIPT_SEMANTIC_SLOTS_V1"),
    parserContractHash: z.literal(
      TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_HASH_V1,
    ),
    slotKind: z.enum([
      "api_route_registration",
      "cli_command_registration",
      "entrypoint_registration",
      "runtime_registration",
    ]),
    slotTokenDomainRef: StableReferenceSchema,
    accessPolicy: z.literal("granted_writable"),
    outputPolicy: z.literal("model_writable"),
    structuralPostconditionRef: StableReferenceSchema,
    compatibilityStatus: z.literal(
      "current_v1_rule_unmigrated_v2_activation_forbidden",
    ),
  }).strict(),
  target: z.object({
    generatorRef: z.literal("NODE_ENTRYPOINT_GENERATOR_V2"),
    generatorContractHash: z.literal(NODE_ENTRYPOINT_GENERATOR_CONTRACT_HASH_V2),
    generatorProfileHash: Sha256Schema,
    ownerRef: z.literal("OWNER_NODE_ENTRYPOINT_GENERATOR_V2"),
    entrypointPathRef: PathBindingIdSchema,
    entrypointKind: EntrypointKindV2Schema,
    sourcePathSlotRef: z.enum([
      "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
      "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
    ]),
    sourcePathToken: Sha256Schema,
    sourceTokenBindingHash: Sha256Schema,
    access: z.literal("generator_whole_file_future"),
    outputPolicy: z.literal("deterministic_generated"),
    modelWriteAuthority: z.literal("forbidden"),
    sourceReceiptSchema: z.literal(NODE_ENTRYPOINT_SOURCE_RECEIPT_V2_SCHEMA),
    sourceReceiptState: z.literal("absent"),
    declarationState: z.literal("required_unverified"),
    disposition: TransitionDispositionV2Schema,
  }).strict(),
}).strict();

export type NodeSemanticRuleGeneratorTransitionEntryHashPayloadV2 = z.infer<
  typeof TransitionEntryIdentityV2Schema
>;

export function hashNodeSemanticRuleGeneratorTransitionEntryV2(
  value:
    | NodeSemanticRuleGeneratorTransitionEntryHashPayloadV2
    | NodeSemanticRuleGeneratorTransitionEntryV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.entryHash;
  return hashCanonicalJson({
    schema: "setfarm.node-semantic-rule-generator-transition-entry-hash.v2",
    entry: payload,
  });
}

export const NodeSemanticRuleGeneratorTransitionEntryV2Schema =
  TransitionEntryIdentityV2Schema.extend({
    entryHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.transitionRef !== deriveNodeSemanticRuleGeneratorTransitionRefV2({
        generatorContractHash: value.target.generatorContractHash,
        generatorProfileHash: value.target.generatorProfileHash,
        ruleSetHash: value.source.ruleSetHash,
        intentRef: value.source.intentRef,
        requirementHash: value.source.requirementHash,
        entrypointPathRef: value.target.entrypointPathRef,
      })
      || value.entryHash !== hashNodeSemanticRuleGeneratorTransitionEntryV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["entryHash"],
        message: "Node rule transition identity must bind its exact source and target",
      });
    }
    if (
      value.target.disposition
        !== nodeSemanticRuleGeneratorDispositionV2(value.source.responsibility)
    ) {
      context.addIssue({
        code: "custom",
        path: ["target", "disposition"],
        message: "Node rule transition disposition must equal its exact responsibility",
      });
    }
    const expectedSlotKind = value.source.responsibility === "route_registration"
      ? value.target.entrypointKind === "cli"
        ? "cli_command_registration"
        : "api_route_registration"
      : value.source.responsibility;
    const expectedMaxMembers = value.source.responsibility === "route_registration"
      ? 500
      : 64;
    const expectedDomain =
      `SLOT_DOMAIN_${value.source.responsibility.toUpperCase()}_V1`;
    const expectedTokenDomain =
      `SLOT_TOKEN_${value.source.responsibility.toUpperCase()}_V1`;
    const expectedPostcondition =
      `POSTCONDITION_${value.source.responsibility.toUpperCase()}_V1`;
    if (
      value.source.pathSourceEntrypointKind !== value.target.entrypointKind
      || value.source.cardinality.maxMembers !== expectedMaxMembers
      || value.source.cardinality.slotKeyDomainRef !== expectedDomain
      || value.source.slotKind !== expectedSlotKind
      || value.source.slotTokenDomainRef !== expectedTokenDomain
      || value.source.structuralPostconditionRef !== expectedPostcondition
    ) {
      context.addIssue({
        code: "custom",
        path: ["source", "locatorKind"],
        message: "Transition must bind the complete exact V1 shared-entrypoint rule ABI",
      });
    }
    const expectsEntrypoint = value.source.responsibility !== "route_registration";
    if (
      expectsEntrypoint !== (value.source.subjectKind === "entrypoint")
      || (value.source.responsibility === "route_registration")
        !== (value.source.subjectKind === "route")
      || (value.source.responsibility === "route_registration")
        !== (value.source.storyId !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["source", "subjectKind"],
        message: "Transition responsibility, subject and story scope must agree exactly",
      });
    }
  });

export type NodeSemanticRuleGeneratorTransitionEntryV2 = z.infer<
  typeof NodeSemanticRuleGeneratorTransitionEntryV2Schema
>;

export function hashNodeSemanticRuleGeneratorTransitionMembershipV2(
  entries: readonly Pick<
    NodeSemanticRuleGeneratorTransitionEntryV2,
    "transitionRef" | "entryHash"
  >[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-semantic-rule-generator-transition-membership-hash.v2",
    entries: entries.map((entry) => ({
      transitionRef: entry.transitionRef,
      entryHash: entry.entryHash,
    })),
  });
}

const TransitionIdentityV2Schema = z.object({
  schema: z.literal(NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_V2_SCHEMA),
  transitionVersion: z.literal(
    NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_VERSION_V2,
  ),
  contractHash: z.literal(
    NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_CONTRACT_HASH_V2,
  ),
  generatorContractHash: z.literal(NODE_ENTRYPOINT_GENERATOR_CONTRACT_HASH_V2),
  readiness: z.object({
    status: z.literal("shadow_blocked"),
    productionUse: z.literal("forbidden"),
    blockerCodes: z.array(BlockerCodeV2Schema)
      .length(NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_BLOCKER_CODES_V2.length),
  }).strict(),
  authority: z.object({
    productRef: ProductIdSchema,
    productSpecHash: Sha256Schema,
    deliverySelectionHash: Sha256Schema,
    profileId: ProfileIdV2Schema,
    stackPackId: StackPackIdV2Schema,
    semanticRuleSet: z.object({
      schema: z.literal(STACK_SEMANTIC_SOURCE_RULE_SET_SCHEMA_V1),
      ruleSetRef: StableReferenceSchema,
      ruleSetVersion: z.literal("1.0.0"),
      ruleSetHash: Sha256Schema,
    }).strict(),
    semanticIntentSet: z.object({
      schema: z.literal(SEMANTIC_SOURCE_INTENT_SET_SCHEMA_V1),
      intentSetHash: Sha256Schema,
    }).strict(),
    semanticPathTokenSet: z.object({
      schema: z.literal(SEMANTIC_SOURCE_PATH_TOKEN_SET_V2_SCHEMA),
      version: z.literal(SEMANTIC_SOURCE_PATH_TOKEN_SET_CONTRACT_VERSION_V2),
      setHash: Sha256Schema,
      externalRequirementMembershipHash: Sha256Schema,
    }).strict(),
    fileTree: z.object({
      schema: z.literal(FILE_TREE_MANIFEST_V2_SCHEMA),
      version: z.literal(FILE_TREE_MANIFEST_VERSION_V2),
      contractHash: z.literal(FILE_TREE_MANIFEST_CONTRACT_HASH_V2),
      manifestHash: Sha256Schema,
    }).strict(),
    buildTopology: z.object({
      schema: z.literal(BUILD_TOPOLOGY_V2_SCHEMA),
      version: z.literal(BUILD_TOPOLOGY_VERSION_V2),
      contractHash: z.literal(BUILD_TOPOLOGY_CONTRACT_HASH_V2),
      logicalBuildHash: Sha256Schema,
      operationalManifestBinding: z.literal("verified_but_excluded_from_transition_identity"),
    }).strict(),
    entrypoint: z.object({
      pathRef: PathBindingIdSchema,
      entrypointKind: EntrypointKindV2Schema,
      sourcePathSlotRef: z.enum([
        "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
        "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
      ]),
      sourcePathToken: Sha256Schema,
      sourceTokenBindingHash: Sha256Schema,
      generatorProfileHash: Sha256Schema,
      requirementCount: z.number().int().positive()
        .max(NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_COUNT_V2),
    }).strict(),
  }).strict(),
  coverage: z.object({
    sourceRequirementCount: z.number().int().positive()
      .max(NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_COUNT_V2),
    transitionCount: z.number().int().positive()
      .max(NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_COUNT_V2),
    entrypointRegistrationCount: z.literal(1),
    routeRegistrationCount: z.number().int().positive()
      .max(NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_ROUTE_COUNT_V2),
    runtimeRegistrationCount: z.literal(1),
    disposition: z.literal("every_entrypoint_requirement_transitioned_exactly_once"),
  }).strict(),
  transitionCount: z.number().int().positive()
    .max(NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_COUNT_V2),
  transitions: z.array(NodeSemanticRuleGeneratorTransitionEntryV2Schema)
    .min(1).max(NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_COUNT_V2),
  transitionMembershipHash: Sha256Schema,
}).strict();

export type NodeSemanticRuleGeneratorTransitionHashPayloadV2 = z.infer<
  typeof TransitionIdentityV2Schema
>;

export function hashNodeSemanticRuleGeneratorTransitionV2(
  value:
    | NodeSemanticRuleGeneratorTransitionHashPayloadV2
    | NodeSemanticRuleGeneratorTransitionV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.transitionHash;
  return hashCanonicalJson({
    schema: "setfarm.node-semantic-rule-generator-transition-hash.v2",
    transition: payload,
  });
}

function addTransitionClosureIssuesV2(
  value: NodeSemanticRuleGeneratorTransitionHashPayloadV2 & {
    transitionHash: string;
  },
  context: z.RefinementCtx,
): void {
  if (
    JSON.stringify(value.readiness.blockerCodes)
      !== JSON.stringify(NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_BLOCKER_CODES_V2)
  ) {
    context.addIssue({
      code: "custom",
      path: ["readiness", "blockerCodes"],
      message: "Node rule transition blockers must equal the exact code-owned set",
    });
  }
  const refs = value.transitions.map((entry) => entry.transitionRef);
  const intentRefs = value.transitions.map((entry) => entry.source.intentRef);
  const requirementHashes = value.transitions.map((entry) =>
    entry.source.requirementHash);
  const entrypointCount = value.transitions.filter((entry) =>
    entry.source.responsibility === "entrypoint_registration").length;
  const routeCount = value.transitions.filter((entry) =>
    entry.source.responsibility === "route_registration").length;
  const runtimeCount = value.transitions.filter((entry) =>
    entry.source.responsibility === "runtime_registration").length;
  if (
    value.transitionCount !== value.transitions.length
    || value.coverage.transitionCount !== value.transitions.length
    || value.coverage.sourceRequirementCount !== value.transitions.length
    || value.authority.entrypoint.requirementCount !== value.transitions.length
    || !canonicalStrings(refs)
    || !hasUniqueStrings(intentRefs)
    || !hasUniqueStrings(requirementHashes)
    || entrypointCount !== 1
    || routeCount < 1
    || runtimeCount !== 1
    || value.coverage.entrypointRegistrationCount !== entrypointCount
    || value.coverage.routeRegistrationCount !== routeCount
    || value.coverage.runtimeRegistrationCount !== runtimeCount
    || value.transitionMembershipHash
      !== hashNodeSemanticRuleGeneratorTransitionMembershipV2(value.transitions)
  ) {
    context.addIssue({
      code: "custom",
      path: ["transitions"],
      message: "Node rule transitions must close every unique entrypoint requirement exactly once",
    });
  }
  if (value.transitions.some((entry) =>
    entry.source.ruleSetHash !== value.authority.semanticRuleSet.ruleSetHash
    || entry.source.ruleSetRef !== value.authority.semanticRuleSet.ruleSetRef
    || entry.source.ruleSetVersion
      !== value.authority.semanticRuleSet.ruleSetVersion
    || entry.target.entrypointPathRef !== value.authority.entrypoint.pathRef
    || entry.target.entrypointKind !== value.authority.entrypoint.entrypointKind
    || entry.target.sourcePathSlotRef
      !== value.authority.entrypoint.sourcePathSlotRef
    || entry.target.sourcePathToken !== value.authority.entrypoint.sourcePathToken
    || entry.target.sourceTokenBindingHash
      !== value.authority.entrypoint.sourceTokenBindingHash
    || entry.target.generatorProfileHash
      !== value.authority.entrypoint.generatorProfileHash)) {
    context.addIssue({
      code: "custom",
      path: ["authority", "entrypoint"],
      message: "Every transition must target the one exact generator-owned entrypoint",
    });
  }
  const expectedProfile = value.authority.stackPackId === "node-cli"
    ? NODE_ENTRYPOINT_GENERATOR_CONTRACT_V2.profiles[0]
    : NODE_ENTRYPOINT_GENERATOR_CONTRACT_V2.profiles[1];
  if (
    value.authority.profileId !== expectedProfile.profileId
    || value.authority.entrypoint.entrypointKind !== expectedProfile.entrypointKind
    || value.authority.entrypoint.sourcePathSlotRef
      !== expectedProfile.sourcePathSlotRef
    || value.authority.entrypoint.generatorProfileHash
      !== hashNodeEntrypointGeneratorProfileV2(expectedProfile)
  ) {
    context.addIssue({
      code: "custom",
      path: ["authority", "profileId"],
      message: "Node transition profile, stack and entrypoint ABI must agree",
    });
  }
  if (value.transitionHash !== hashNodeSemanticRuleGeneratorTransitionV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["transitionHash"],
      message: "Node rule transition hash must bind the complete canonical artifact",
    });
  }
}

const TransitionCandidateV2Schema = TransitionIdentityV2Schema.extend({
  transitionHash: Sha256Schema,
}).strict().superRefine(addTransitionClosureIssuesV2);

export const NodeSemanticRuleGeneratorTransitionV2Schema = z.unknown()
  .superRefine((value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_MAX_CANONICAL_BYTES_V2,
        ...NODE_SEMANTIC_RULE_GENERATOR_TRANSITION_BOUNDED_WORK_LIMITS_V2,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: "Node rule transition exceeds its canonical byte or work bound",
      });
    }
  }).pipe(TransitionCandidateV2Schema);

export type NodeSemanticRuleGeneratorTransitionV2 = z.infer<
  typeof TransitionCandidateV2Schema
>;

export function recursivelyFreezeNodeSemanticRuleGeneratorTransitionV2<T>(
  value: T,
): T {
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
