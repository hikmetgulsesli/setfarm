import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { hashCanonicalJson } from "../canonical-json.js";
import {
  CapabilityIdSchema,
  ProductIdSchema,
  Sha256Schema,
  StableReferenceSchema,
  StoryIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  SEMANTIC_SOURCE_INTENT_SET_SCHEMA_V1,
} from "./semantic-source-intent-set-v1.js";
import {
  PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_SCHEMA_V1,
  PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_VERSION_V1,
  PRODUCT_RUNTIME_BEHAVIOR_EVALUATOR_CONTRACT_HASH_V1,
  PRODUCT_RUNTIME_BEHAVIOR_PROPOSAL_SCHEMA_V1,
} from "./product-runtime-behavior-contract-v1.js";
import {
  SemanticSourceResponsibilityV1Schema,
  SemanticSourceSubjectKindV1Schema,
} from "./stack-semantic-source-rules-v1.js";

export const SEMANTIC_REALIZATION_PLAN_V2_SCHEMA =
  "setfarm.semantic-realization-plan.v2" as const;
export const SEMANTIC_REALIZATION_PLAN_V2_VERSION = "2.0.0" as const;
export const NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2_SCHEMA =
  "setfarm.node-product-runtime-generator-contract.v2" as const;
export const NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA =
  "setfarm.node-product-runtime-source-receipt.v2" as const;
export const NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2_SCHEMA =
  "setfarm.node-product-test-generator-contract.v2" as const;
export const NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA =
  "setfarm.node-product-test-source-receipt.v2" as const;
export const SEMANTIC_REALIZATION_PLAN_V2_MAX_ENTRIES = 20_000;
export const SEMANTIC_REALIZATION_PLAN_V2_MAX_CANONICAL_BYTES = 4 * 1024 * 1024;
export const SEMANTIC_REALIZATION_PLAN_V2_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 16,
  maxNodes: SEMANTIC_REALIZATION_PLAN_V2_MAX_CANONICAL_BYTES + 40_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (SEMANTIC_REALIZATION_PLAN_V2_MAX_CANONICAL_BYTES * 8)
    + (2 * 1024 * 1024),
});

export const SEMANTIC_REALIZATION_PLAN_V2_BLOCKER_CODES = Object.freeze([
  "SEMANTIC_REALIZATION_V2_BUILD_TOPOLOGY_V3_UNVERIFIED",
  "SEMANTIC_REALIZATION_V2_EVIDENCE_REGISTRY_UNVERIFIED",
  "SEMANTIC_REALIZATION_V2_FILE_TREE_V3_UNVERIFIED",
  "SEMANTIC_REALIZATION_V2_NODE_RUNTIME_GENERATOR_UNVERIFIED",
  "SEMANTIC_REALIZATION_V2_RELEASE_MANIFEST_UNVERIFIED",
  "SEMANTIC_REALIZATION_V2_SOURCE_RECEIPT_UNVERIFIED",
  "SEMANTIC_REALIZATION_V2_TEST_GENERATOR_UNVERIFIED",
  "SEMANTIC_REALIZATION_V2_TEST_SOURCE_RECEIPT_UNVERIFIED",
] as const);

export const NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2 = Object.freeze({
  schema: NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2_SCHEMA,
  contractVersion: SEMANTIC_REALIZATION_PLAN_V2_VERSION,
  generatorRef: "NODE_PRODUCT_RUNTIME_GENERATOR_V2" as const,
  output: Object.freeze({
    ownership: "code_owned_whole_file" as const,
    modelWriteAuthority: "forbidden" as const,
    sourceReceiptSchema: NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
    mediaType: "text/typescript" as const,
    encoding: "utf-8" as const,
    newline: "lf" as const,
    moduleSystem: "node_esm" as const,
    semanticAuxiliarySourceFiles: "forbidden" as const,
  }),
  semanticExecution: Object.freeze({
    sourceAuthority:
      "verified_product_spec_v2_and_product_runtime_behavior_contract_v1" as const,
    actionExecution:
      "generated_product_spec_state_delta_and_behavior_reducer_v2" as const,
    inputTransport: "verified_invocation_input_transport_v2" as const,
    outputTransport: "generated_invocation_result_codec_v2" as const,
    stateRuntime: "generated_from_product_spec_state_contracts_v2" as const,
    runtimeData: "generated_from_product_spec_runtime_data_contracts_v2" as const,
    observableProjection: "generated_invocation_output_projection_v2" as const,
    runtimeBehavior:
      "generated_verified_assertions_and_pre_action_entity_snapshots_v1" as const,
    opaqueBehaviorPolicy:
      "require_fresh_verified_versioned_behavior_contract_projection" as const,
  }),
  profiles: Object.freeze([
    Object.freeze({
      profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2" as const,
      stackPackId: "node-cli" as const,
      entrypointKind: "cli" as const,
      sourcePathSlotRef: "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2" as const,
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
} as const);

export const NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2 = hashCanonicalJson(
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2,
);

export type NodeProductRuntimeGeneratorProfileV2 =
  typeof NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2.profiles[number];

export function hashNodeProductRuntimeGeneratorProfileV2(
  value: NodeProductRuntimeGeneratorProfileV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-product-runtime-generator-profile-hash.v2",
    profile: value,
  });
}

export const NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2 = Object.freeze({
  schema: NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2_SCHEMA,
  contractVersion: SEMANTIC_REALIZATION_PLAN_V2_VERSION,
  generatorRef: "NODE_PRODUCT_TEST_GENERATOR_V2" as const,
  inputAuthority: Object.freeze({
    productSpecSchema: "setfarm.product-spec.v2" as const,
    deliverySelectionSchema: "setfarm.product-delivery-selection.v2" as const,
    runtimeBehaviorProposalSchema:
      PRODUCT_RUNTIME_BEHAVIOR_PROPOSAL_SCHEMA_V1,
    runtimeBehaviorContractSchema:
      PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_SCHEMA_V1,
    realizationPlanSchema: SEMANTIC_REALIZATION_PLAN_V2_SCHEMA,
    invocationTransportSchema: "setfarm.invocation-input-transport.v2" as const,
    fileTreeSchema: "setfarm.file-tree-manifest.v3" as const,
    buildTopologySchema: "setfarm.build-topology.v3" as const,
    runtimeSourceReceiptSchema: NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
    runtimeProgramAuthority:
      "fresh_shared_node_product_runtime_program_v2" as const,
    evidenceRelationSource: "semantic_realization_plan_v2" as const,
  }),
  semanticExecution: Object.freeze({
    scenarioAuthority:
      "product_spec_v2_exact_evidence_scenario_and_invocation_transport_v2" as const,
    actionCoverage: "one_exact_success_test_per_action" as const,
    evidenceCoverage:
      "every_semantic_evidence_relation_bound_to_exact_action_test" as const,
    supportedEvidenceKinds: Object.freeze([
      "action_invocation",
      "observable_outcome",
    ] as const),
    unsupportedEvidencePolicy: "typed_rejection_before_source_bytes" as const,
    runtimeBehavior:
      "initial_and_after_action_runtime_checkpoints_exercised_per_action" as const,
    entitySnapshots:
      "exact_entity_occurrence_exercised_by_owning_action_scenario" as const,
    apiIsolation:
      "fresh_exact_runtime_module_instance_per_action_scenario" as const,
    cliPrerequisitePolicy:
      "reject_nonempty_prerequisites_without_single_process_sequence_abi" as const,
  }),
  output: Object.freeze({
    ownership: "code_owned_whole_file" as const,
    modelWriteAuthority: "forbidden" as const,
    sourceReceiptSchema: NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
    mediaType: "text/typescript" as const,
    encoding: "utf-8" as const,
    newline: "lf" as const,
    moduleSystem: "node_esm" as const,
    minimumTestCount: 1,
    zeroTestReceipt: "forbidden" as const,
    coverage:
      "every_action_evidence_relation_runtime_assertion_and_entity_binding" as const,
  }),
  profiles: Object.freeze([
    Object.freeze({
      profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2" as const,
      stackPackId: "node-cli" as const,
      sourcePathRef: "PATH_NODE_CLI_GENERATED_TEST_SOURCE_V2" as const,
      sourceNormalizedLocator: "src/cli.setfarm.test.ts" as const,
      compiledPathRef: "PATH_NODE_CLI_GENERATED_TEST_OUTPUT_V2" as const,
      compiledNormalizedLocator: "dist/cli.setfarm.test.js" as const,
      runtimeImportSpecifier: "./cli.js" as const,
      execution: Object.freeze({
        runnerAbi: "NODE_TEST_RUNNER_DIRECT_FILE_ABI_V2" as const,
        executableRef: "TOOL_NODE_RUNTIME_V2" as const,
        directArgvPrefix: Object.freeze(["node", "--test"] as const),
        subprocessPolicy: "exact_same_runtime_cli_module_only" as const,
        networkPolicy: "forbidden" as const,
      }),
    }),
    Object.freeze({
      profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2" as const,
      stackPackId: "node-express-api" as const,
      sourcePathRef: "PATH_NODE_API_GENERATED_TEST_SOURCE_V2" as const,
      sourceNormalizedLocator: "src/app.setfarm.test.ts" as const,
      compiledPathRef: "PATH_NODE_API_GENERATED_TEST_OUTPUT_V2" as const,
      compiledNormalizedLocator: "dist/app.setfarm.test.js" as const,
      runtimeImportSpecifier: "./app.js" as const,
      execution: Object.freeze({
        runnerAbi: "NODE_TEST_RUNNER_DIRECT_FILE_ABI_V2" as const,
        executableRef: "TOOL_NODE_RUNTIME_V2" as const,
        directArgvPrefix: Object.freeze(["node", "--test"] as const),
        subprocessPolicy: "forbidden" as const,
        networkPolicy: "forbidden" as const,
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
} as const);

export const NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2 = hashCanonicalJson(
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2,
);

export type NodeProductTestGeneratorProfileV2 =
  typeof NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2.profiles[number];

export function hashNodeProductTestGeneratorProfileV2(
  value: NodeProductTestGeneratorProfileV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-product-test-generator-profile-hash.v2",
    profile: value,
  });
}

export const GeneratorMemberKindV2Schema = z.enum([
  "action_reducer",
  "entity_model",
  "input_codec",
  "non_rendered_surface",
  "observable_projection",
  "output_codec",
  "route_registration",
  "runtime_data_seed",
  "runtime_registration",
  "state_runtime",
  "entrypoint_registration",
]);

export type GeneratorMemberKindV2 = z.infer<typeof GeneratorMemberKindV2Schema>;

type PolicyRuleV2 = Readonly<{
  policyRuleRef: string;
  subjectKind: z.infer<typeof SemanticSourceSubjectKindV1Schema>;
  responsibility: z.infer<typeof SemanticSourceResponsibilityV1Schema>;
  legacyIntentKind:
    | "source_slot"
    | "platform_contract"
    | "typed_exemption"
    | "predicate_requirement";
  legacyTargetKind:
    | "project_source"
    | "generated_source"
    | "platform_contract"
    | "typed_exemption"
    | "predicate_relation";
  realization:
    | Readonly<{
        kind: "node_product_runtime_generator_member";
        memberKind: GeneratorMemberKindV2;
      }>
    | Readonly<{ kind: "platform_contract_binding" }>
    | Readonly<{ kind: "typed_exemption" }>
    | Readonly<{ kind: "evidence_relation" }>;
}>;

function frozenRule(input: PolicyRuleV2): PolicyRuleV2 {
  return Object.freeze({
    ...input,
    realization: Object.freeze({ ...input.realization }),
  });
}

function sourceRule(
  prefix: "NODE_CLI" | "NODE_API",
  subjectKind: PolicyRuleV2["subjectKind"],
  responsibility: PolicyRuleV2["responsibility"],
  memberKind: GeneratorMemberKindV2,
): PolicyRuleV2 {
  return frozenRule({
    policyRuleRef: `REALIZE_${prefix}_${responsibility.toUpperCase()}_V2`,
    subjectKind,
    responsibility,
    legacyIntentKind: "source_slot",
    legacyTargetKind: "project_source",
    realization: {
      kind: "node_product_runtime_generator_member",
      memberKind,
    },
  });
}

function platformRule(
  prefix: "NODE_CLI" | "NODE_API",
  subjectKind: PolicyRuleV2["subjectKind"],
  responsibility: "platform_command" | "platform_registration",
): PolicyRuleV2 {
  return frozenRule({
    policyRuleRef: `REALIZE_${prefix}_${responsibility.toUpperCase()}_V2`,
    subjectKind,
    responsibility,
    legacyIntentKind: "platform_contract",
    legacyTargetKind: "platform_contract",
    realization: { kind: "platform_contract_binding" },
  });
}

function exemptionRule(prefix: "NODE_CLI" | "NODE_API"): PolicyRuleV2 {
  return frozenRule({
    policyRuleRef: `REALIZE_${prefix}_PERSISTENCE_EXEMPTION_V2`,
    subjectKind: "persistence_policy",
    responsibility: "persistence_exemption",
    legacyIntentKind: "typed_exemption",
    legacyTargetKind: "typed_exemption",
    realization: { kind: "typed_exemption" },
  });
}

function evidenceRule(prefix: "NODE_CLI" | "NODE_API"): PolicyRuleV2 {
  return frozenRule({
    policyRuleRef: `REALIZE_${prefix}_PREDICATE_SOURCE_BINDING_V2`,
    subjectKind: "evidence_predicate",
    responsibility: "predicate_source_binding",
    legacyIntentKind: "predicate_requirement",
    legacyTargetKind: "predicate_relation",
    realization: { kind: "evidence_relation" },
  });
}

function nodeRules(
  prefix: "NODE_CLI" | "NODE_API",
  outputResponsibility: "cli_output_adapter" | "api_response_adapter",
): readonly PolicyRuleV2[] {
  return Object.freeze([
    sourceRule(prefix, "action", "action_handler", "action_reducer"),
    sourceRule(prefix, "action_input", "action_input_transport", "input_codec"),
    sourceRule(prefix, "entity", "entity_model", "entity_model"),
    sourceRule(prefix, "entrypoint", "entrypoint_registration",
      "entrypoint_registration"),
    sourceRule(prefix, "observable", "observable_projection",
      "observable_projection"),
    sourceRule(prefix, "action", outputResponsibility, "output_codec"),
    platformRule(prefix, "command", "platform_command"),
    platformRule(prefix, "runtime_data_contract", "platform_registration"),
    evidenceRule(prefix),
    exemptionRule(prefix),
    sourceRule(prefix, "route", "route_registration", "route_registration"),
    sourceRule(prefix, "runtime_data_contract", "runtime_data_fixture",
      "runtime_data_seed"),
    sourceRule(prefix, "entrypoint", "runtime_registration", "runtime_registration"),
    sourceRule(prefix, "state", "state_store", "state_runtime"),
    sourceRule(prefix, "surface", "surface_primary", "non_rendered_surface"),
  ].sort((left, right) => left.policyRuleRef < right.policyRuleRef ? -1 : 1));
}

export const NODE_SEMANTIC_REALIZATION_POLICY_V2 = Object.freeze({
  schema: "setfarm.node-semantic-realization-policy.v2" as const,
  policyVersion: SEMANTIC_REALIZATION_PLAN_V2_VERSION,
  sourceAuthority: "semantic_obligation_not_legacy_target" as const,
  legacyTargetPolicy: "compatibility_evidence_only" as const,
  modelWritePolicy:
    "forbidden_without_versioned_product_spec_behavior_contract" as const,
  profiles: Object.freeze([
    Object.freeze({
      profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2" as const,
      stackPackId: "node-cli" as const,
      deliveryProfileHash:
        "e57f520d4bb71bfea2907f8858f6e40772c6355109d43d74d139ee1e9592ea3f" as const,
      stackPackVersion: "1.6.0" as const,
      stackPackContentHash:
        "5ad5e6bdc56a2a970c03897a4e205b75166e5edf83a5168ce6526f2f397693d3" as const,
      semanticRuleSetRef: "RULESET_NODE_CLI_V1" as const,
      semanticRuleSetHash:
        "1ad3aa4c68a939ab11273ec7538daed921eb4ea4d0f77e196080c069feff7c08" as const,
      designSourceKind: "none" as const,
      rules: nodeRules("NODE_CLI", "cli_output_adapter"),
    }),
    Object.freeze({
      profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2" as const,
      stackPackId: "node-express-api" as const,
      deliveryProfileHash:
        "b7c78f2585b22c8720c321c4c311be62f039ed6f6d6527cae139cea7a98cded1" as const,
      stackPackVersion: "1.6.0" as const,
      stackPackContentHash:
        "7dec84cecdf4f3400fa9e10559cfe7d94fe11bac81132bbfdc9158afdccdbdc4" as const,
      semanticRuleSetRef: "RULESET_NODE_EXPRESS_API_STATELESS_V1" as const,
      semanticRuleSetHash:
        "fe53d956a9af0db8c7636598d7cd8839887877fe13415907490289bb08b45528" as const,
      designSourceKind: "none" as const,
      rules: nodeRules("NODE_API", "api_response_adapter"),
    }),
  ] as const),
  completeness: Object.freeze({
    source: "every_semantic_intent_exactly_once" as const,
    policyMatch: "subject_kind_plus_responsibility_plus_legacy_shape" as const,
    duplicatePolicyRule: "forbidden" as const,
    unmatchedIntent: "typed_rejection" as const,
    unusedActiveRule: "allowed" as const,
  }),
  hashDomains: Object.freeze({
    policyRule: "setfarm.semantic-realization-policy-rule-hash.v2" as const,
    realizationRef: "setfarm.semantic-realization-ref.v2" as const,
    realization: "setfarm.semantic-realization-hash.v2" as const,
    membership: "setfarm.semantic-realization-membership-hash.v2" as const,
    plan: "setfarm.semantic-realization-plan-hash.v2" as const,
    legacyTarget: "setfarm.semantic-realization-legacy-target-hash.v2" as const,
  }),
} as const);

export const NODE_SEMANTIC_REALIZATION_POLICY_HASH_V2 = hashCanonicalJson(
  NODE_SEMANTIC_REALIZATION_POLICY_V2,
);

export const SEMANTIC_REALIZATION_PLAN_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.semantic-realization-plan-contract.v2" as const,
  contractVersion: SEMANTIC_REALIZATION_PLAN_V2_VERSION,
  artifactSchema: SEMANTIC_REALIZATION_PLAN_V2_SCHEMA,
  inputAuthority: Object.freeze({
    semanticIntentSetSchema: SEMANTIC_SOURCE_INTENT_SET_SCHEMA_V1,
    runtimeBehaviorProposalSchema:
      PRODUCT_RUNTIME_BEHAVIOR_PROPOSAL_SCHEMA_V1,
    runtimeBehaviorContractSchema:
      PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_SCHEMA_V1,
    runtimeBehaviorVerification:
      "fresh_product_spec_plus_proposal_reproduction" as const,
  }),
  policySchema: NODE_SEMANTIC_REALIZATION_POLICY_V2.schema,
  policyHash: NODE_SEMANTIC_REALIZATION_POLICY_HASH_V2,
  generatorContractSchema: NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2_SCHEMA,
  generatorContractHash: NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
  testGeneratorContractSchema: NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2_SCHEMA,
  testGeneratorContractHash: NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
  outputAuthority: Object.freeze({
    semanticIntentTarget: "compatibility_evidence_only" as const,
    realizationPlan: "only_native_implementation_authority" as const,
    fileTreeConsumer: "realization_driven_file_tree_v3" as const,
  }),
  blockerCodes: SEMANTIC_REALIZATION_PLAN_V2_BLOCKER_CODES,
} as const);

export const SEMANTIC_REALIZATION_PLAN_CONTRACT_HASH_V2 = hashCanonicalJson(
  SEMANTIC_REALIZATION_PLAN_CONTRACT_V2,
);

export function hashSemanticRealizationPolicyRuleV2(value: PolicyRuleV2): string {
  return hashCanonicalJson({
    schema: "setfarm.semantic-realization-policy-rule-hash.v2",
    policyRule: value,
  });
}

export function hashSemanticRealizationLegacyTargetV2(value: unknown): string {
  return hashCanonicalJson({
    schema: "setfarm.semantic-realization-legacy-target-hash.v2",
    legacyTarget: value,
  });
}

export function deriveSemanticRealizationRefV2(value: Readonly<{
  policyHash: string;
  policyRuleRef: string;
  intentRef: string;
}>): string {
  return `REALIZATION_${hashCanonicalJson({
    schema: "setfarm.semantic-realization-ref.v2",
    realization: value,
  }).toUpperCase()}`;
}

const ProfileIdV2Schema = z.enum([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);
const StackPackIdV2Schema = z.enum(["node-cli", "node-express-api"]);
const IntentKindV2Schema = z.enum([
  "source_slot",
  "platform_contract",
  "typed_exemption",
  "predicate_requirement",
]);
const LegacyTargetKindV2Schema = z.enum([
  "project_source",
  "generated_source",
  "platform_contract",
  "typed_exemption",
  "predicate_relation",
]);

const SourceIntentBindingV2Schema = z.object({
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
  storyId: StoryIdSchema.nullable(),
  legacyIntentKind: IntentKindV2Schema,
  legacyTargetKind: LegacyTargetKindV2Schema,
  legacyTargetHash: Sha256Schema,
  legacyTargetDisposition: z.literal("compatibility_evidence_only"),
}).strict();

const GeneratorMemberTargetV2Schema = z.object({
  kind: z.literal("node_product_runtime_generator_member"),
  policyRuleRef: StableReferenceSchema,
  policyRuleHash: Sha256Schema,
  generatorRef: z.literal("NODE_PRODUCT_RUNTIME_GENERATOR_V2"),
  generatorContractHash: z.literal(NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2),
  memberKind: GeneratorMemberKindV2Schema,
  ownerRef: z.literal("OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2"),
  modelWriteAuthority: z.literal("forbidden"),
  sourceTopology: z.literal("single_generated_entrypoint_no_semantic_leaf"),
  sourceReceiptSchema: z.literal(NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA),
  sourceReceiptState: z.literal("absent"),
}).strict();

const PlatformBindingTargetV2Schema = z.object({
  kind: z.literal("platform_contract_binding"),
  policyRuleRef: StableReferenceSchema,
  policyRuleHash: Sha256Schema,
  platformAuthorityRef: z.enum([
    "PLATFORM_BUILD_COMMAND_V1",
    "PLATFORM_RUNTIME_REGISTRATION_V1",
  ]),
  platformContractProjectionHash: Sha256Schema,
  capabilityRefs: z.array(CapabilityIdSchema).max(64),
  bindingState: z.literal("planned_unverified"),
}).strict();

const TypedExemptionTargetV2Schema = z.object({
  kind: z.literal("typed_exemption"),
  policyRuleRef: StableReferenceSchema,
  policyRuleHash: Sha256Schema,
  exemptionCode: z.enum([
    "PERSISTENCE_NONE_NO_SOURCE_REQUIRED",
    "PERSISTENCE_MEMORY_USES_STATE_STORE",
  ]),
  backingResponsibility: z.literal("state_store").nullable(),
  backingResolutionState: z.enum(["not_applicable", "generated_runtime_member"]),
  modelWriteAuthority: z.literal("forbidden"),
}).strict();

const EvidenceRelationTargetV2Schema = z.object({
  kind: z.literal("evidence_relation"),
  policyRuleRef: StableReferenceSchema,
  policyRuleHash: Sha256Schema,
  registryArtifactType: z.literal("setfarm.evidence-adapter-registry.v1"),
  supportSignatureSchema: z.literal(
    "setfarm.evidence-adapter-support-signature.v1",
  ),
  resolutionContractRef: z.literal(
    "EVIDENCE_ADAPTER_EXACT_SUPPORT_SIGNATURE_V1",
  ),
  resolutionState: z.literal("unresolved_shadow"),
  modelWriteAuthority: z.literal("forbidden"),
}).strict();

export const SemanticRealizationTargetV2Schema = z.discriminatedUnion("kind", [
  GeneratorMemberTargetV2Schema,
  PlatformBindingTargetV2Schema,
  TypedExemptionTargetV2Schema,
  EvidenceRelationTargetV2Schema,
]);

const RealizationIdentityV2Schema = z.object({
  realizationRef: StableReferenceSchema,
  sourceIntent: SourceIntentBindingV2Schema,
  target: SemanticRealizationTargetV2Schema,
}).strict();

export type SemanticRealizationHashPayloadV2 = z.infer<
  typeof RealizationIdentityV2Schema
>;

export function hashSemanticRealizationV2(
  value: SemanticRealizationHashPayloadV2 | SemanticRealizationV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.realizationHash;
  return hashCanonicalJson({
    schema: "setfarm.semantic-realization-hash.v2",
    realization: payload,
  });
}

export const SemanticRealizationV2Schema = RealizationIdentityV2Schema.extend({
  realizationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.realizationRef !== deriveSemanticRealizationRefV2({
      policyHash: NODE_SEMANTIC_REALIZATION_POLICY_HASH_V2,
      policyRuleRef: value.target.policyRuleRef,
      intentRef: value.sourceIntent.intentRef,
    })
    || value.realizationHash !== hashSemanticRealizationV2(value)
  ) {
    context.addIssue({
      code: "custom",
      path: ["realizationHash"],
      message: "Semantic realization identity must bind the exact policy and intent",
    });
  }
});

export type SemanticRealizationV2 = z.infer<typeof SemanticRealizationV2Schema>;

export function hashSemanticRealizationMembershipV2(
  values: readonly Pick<SemanticRealizationV2, "realizationRef" | "realizationHash">[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.semantic-realization-membership-hash.v2",
    realizations: values.map((value) => ({
      realizationRef: value.realizationRef,
      realizationHash: value.realizationHash,
    })),
  });
}

const PlanIdentityV2Schema = z.object({
  schema: z.literal(SEMANTIC_REALIZATION_PLAN_V2_SCHEMA),
  planVersion: z.literal(SEMANTIC_REALIZATION_PLAN_V2_VERSION),
  contractHash: z.literal(SEMANTIC_REALIZATION_PLAN_CONTRACT_HASH_V2),
  policyHash: z.literal(NODE_SEMANTIC_REALIZATION_POLICY_HASH_V2),
  generatorContractHash: z.literal(NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2),
  testGeneratorContractHash: z.literal(
    NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
  ),
  readiness: z.object({
    status: z.literal("shadow_blocked"),
    productionUse: z.literal("forbidden"),
    blockerCodes: z.array(z.enum(SEMANTIC_REALIZATION_PLAN_V2_BLOCKER_CODES))
      .length(SEMANTIC_REALIZATION_PLAN_V2_BLOCKER_CODES.length),
  }).strict(),
  authority: z.object({
    productRef: ProductIdSchema,
    productSpecHash: Sha256Schema,
    deliverySelectionHash: Sha256Schema,
    profileId: ProfileIdV2Schema,
    deliveryProfileHash: Sha256Schema,
    stackPackId: StackPackIdV2Schema,
    stackPackVersion: z.literal("1.6.0"),
    stackPackContentHash: Sha256Schema,
    semanticIntentSet: z.object({
      schema: z.literal(SEMANTIC_SOURCE_INTENT_SET_SCHEMA_V1),
      intentSetHash: Sha256Schema,
      intentCount: z.number().int().positive().max(
        SEMANTIC_REALIZATION_PLAN_V2_MAX_ENTRIES,
      ),
    }).strict(),
    semanticRuleSet: z.object({
      ruleSetRef: StableReferenceSchema,
      ruleSetVersion: z.literal("1.0.0"),
      ruleSetHash: Sha256Schema,
    }).strict(),
    runtimeBehavior: z.object({
      proposalSchema: z.literal(PRODUCT_RUNTIME_BEHAVIOR_PROPOSAL_SCHEMA_V1),
      proposalHash: Sha256Schema,
      contractSchema: z.literal(PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_SCHEMA_V1),
      contractVersion: z.literal(PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_VERSION_V1),
      contractHash: Sha256Schema,
      evaluatorContractHash: z.literal(
        PRODUCT_RUNTIME_BEHAVIOR_EVALUATOR_CONTRACT_HASH_V1,
      ),
      invariantBindingCount: z.number().int().nonnegative().max(20_000),
      entityFieldBindingCount: z.number().int().nonnegative().max(20_000),
      verification: z.literal("fresh_product_spec_plus_proposal_reproduction"),
    }).strict(),
    generatorProfile: z.object({
      generatorRef: z.literal("NODE_PRODUCT_RUNTIME_GENERATOR_V2"),
      generatorProfileHash: Sha256Schema,
      entrypointKind: z.enum(["cli", "api"]),
      sourcePathSlotRef: z.enum([
        "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
        "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
      ]),
    }).strict(),
    testGeneratorProfile: z.object({
      generatorRef: z.literal("NODE_PRODUCT_TEST_GENERATOR_V2"),
      generatorProfileHash: Sha256Schema,
      sourcePathRef: z.enum([
        "PATH_NODE_CLI_GENERATED_TEST_SOURCE_V2",
        "PATH_NODE_API_GENERATED_TEST_SOURCE_V2",
      ]),
      compiledPathRef: z.enum([
        "PATH_NODE_CLI_GENERATED_TEST_OUTPUT_V2",
        "PATH_NODE_API_GENERATED_TEST_OUTPUT_V2",
      ]),
      runnerAbi: z.literal("NODE_TEST_RUNNER_DIRECT_FILE_ABI_V2"),
    }).strict(),
  }).strict(),
  coverage: z.object({
    sourceIntentCount: z.number().int().nonnegative().max(
      SEMANTIC_REALIZATION_PLAN_V2_MAX_ENTRIES,
    ),
    generatorMemberCount: z.number().int().nonnegative().max(
      SEMANTIC_REALIZATION_PLAN_V2_MAX_ENTRIES,
    ),
    platformBindingCount: z.number().int().nonnegative().max(
      SEMANTIC_REALIZATION_PLAN_V2_MAX_ENTRIES,
    ),
    typedExemptionCount: z.number().int().nonnegative().max(
      SEMANTIC_REALIZATION_PLAN_V2_MAX_ENTRIES,
    ),
    evidenceRelationCount: z.number().int().nonnegative().max(
      SEMANTIC_REALIZATION_PLAN_V2_MAX_ENTRIES,
    ),
    supersededLegacyModelWriteCount: z.number().int().nonnegative().max(
      SEMANTIC_REALIZATION_PLAN_V2_MAX_ENTRIES,
    ),
    modelWriteGrantCount: z.literal(0),
    disposition: z.literal("every_semantic_intent_realized_exactly_once"),
  }).strict(),
  realizationCount: z.number().int().positive().max(
    SEMANTIC_REALIZATION_PLAN_V2_MAX_ENTRIES,
  ),
  realizations: z.array(SemanticRealizationV2Schema).min(1).max(
    SEMANTIC_REALIZATION_PLAN_V2_MAX_ENTRIES,
  ),
  realizationMembershipHash: Sha256Schema,
}).strict();

export type SemanticRealizationPlanHashPayloadV2 = z.infer<
  typeof PlanIdentityV2Schema
>;

export function hashSemanticRealizationPlanV2(
  value:
    | SemanticRealizationPlanHashPayloadV2
    | SemanticRealizationPlanV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.planHash;
  return hashCanonicalJson({
    schema: "setfarm.semantic-realization-plan-hash.v2",
    realizationPlan: payload,
  });
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function policyProfileForV2(profileId: string) {
  return NODE_SEMANTIC_REALIZATION_POLICY_V2.profiles.find((profile) =>
    profile.profileId === profileId);
}

function generatorProfileForV2(profileId: string) {
  return NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2.profiles.find((profile) =>
    profile.profileId === profileId);
}

function testGeneratorProfileForV2(profileId: string) {
  return NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2.profiles.find((profile) =>
    profile.profileId === profileId);
}

function addPlanClosureIssuesV2(
  value: SemanticRealizationPlanHashPayloadV2 & { planHash: string },
  context: z.RefinementCtx,
): void {
  if (
    JSON.stringify(value.readiness.blockerCodes)
      !== JSON.stringify(SEMANTIC_REALIZATION_PLAN_V2_BLOCKER_CODES)
  ) {
    context.addIssue({
      code: "custom",
      path: ["readiness", "blockerCodes"],
      message: "Semantic realization blockers must equal the exact code-owned set",
    });
  }
  const policyProfile = policyProfileForV2(value.authority.profileId);
  const generatorProfile = generatorProfileForV2(value.authority.profileId);
  const testGeneratorProfile = testGeneratorProfileForV2(
    value.authority.profileId,
  );
  if (
    !policyProfile
    || !generatorProfile
    || !testGeneratorProfile
    || policyProfile.stackPackId !== value.authority.stackPackId
    || policyProfile.deliveryProfileHash
      !== value.authority.deliveryProfileHash
    || policyProfile.stackPackVersion !== value.authority.stackPackVersion
    || policyProfile.stackPackContentHash
      !== value.authority.stackPackContentHash
    || policyProfile.semanticRuleSetRef
      !== value.authority.semanticRuleSet.ruleSetRef
    || policyProfile.semanticRuleSetHash
      !== value.authority.semanticRuleSet.ruleSetHash
    || generatorProfile.stackPackId !== value.authority.stackPackId
    || generatorProfile.entrypointKind
      !== value.authority.generatorProfile.entrypointKind
    || generatorProfile.sourcePathSlotRef
      !== value.authority.generatorProfile.sourcePathSlotRef
    || value.authority.generatorProfile.generatorProfileHash
      !== hashNodeProductRuntimeGeneratorProfileV2(generatorProfile)
    || testGeneratorProfile.stackPackId !== value.authority.stackPackId
    || testGeneratorProfile.sourcePathRef
      !== value.authority.testGeneratorProfile.sourcePathRef
    || testGeneratorProfile.compiledPathRef
      !== value.authority.testGeneratorProfile.compiledPathRef
    || testGeneratorProfile.execution.runnerAbi
      !== value.authority.testGeneratorProfile.runnerAbi
    || value.authority.testGeneratorProfile.generatorProfileHash
      !== hashNodeProductTestGeneratorProfileV2(testGeneratorProfile)
  ) {
    context.addIssue({
      code: "custom",
      path: ["authority", "profileId"],
      message:
        "Realization policy, rule set, stack, runtime and test profiles must join",
    });
  }
  const refs = value.realizations.map((entry) => entry.realizationRef);
  const intentRefs = value.realizations.map((entry) => entry.sourceIntent.intentRef);
  const generatorCount = value.realizations.filter((entry) =>
    entry.target.kind === "node_product_runtime_generator_member").length;
  const platformCount = value.realizations.filter((entry) =>
    entry.target.kind === "platform_contract_binding").length;
  const exemptionCount = value.realizations.filter((entry) =>
    entry.target.kind === "typed_exemption").length;
  const evidenceCount = value.realizations.filter((entry) =>
    entry.target.kind === "evidence_relation").length;
  if (
    value.realizationCount !== value.realizations.length
    || value.authority.semanticIntentSet.intentCount !== value.realizations.length
    || value.coverage.sourceIntentCount !== value.realizations.length
    || value.coverage.generatorMemberCount !== generatorCount
    || value.coverage.platformBindingCount !== platformCount
    || value.coverage.typedExemptionCount !== exemptionCount
    || value.coverage.evidenceRelationCount !== evidenceCount
    || value.coverage.supersededLegacyModelWriteCount !== generatorCount
    || generatorCount + platformCount + exemptionCount + evidenceCount
      !== value.realizations.length
    || !hasUniqueStrings(intentRefs)
    || !hasUniqueStrings(refs)
    || refs.some((ref, index) => index > 0 && compareUtf16(refs[index - 1]!, ref) >= 0)
    || value.realizationMembershipHash
      !== hashSemanticRealizationMembershipV2(value.realizations)
  ) {
    context.addIssue({
      code: "custom",
      path: ["realizations"],
      message: "Realization plan must cover every semantic intent exactly once",
    });
  }
  if (policyProfile) {
    value.realizations.forEach((entry, index) => {
      const matches = policyProfile.rules.filter((rule) =>
        rule.policyRuleRef === entry.target.policyRuleRef);
      const rule = matches[0];
      const realizationKind = rule?.realization.kind;
      const targetMemberKind = entry.target.kind
        === "node_product_runtime_generator_member"
        ? entry.target.memberKind
        : null;
      const ruleMemberKind = rule?.realization.kind
        === "node_product_runtime_generator_member"
        ? rule.realization.memberKind
        : null;
      if (
        matches.length !== 1
        || !rule
        || entry.sourceIntent.ruleSetHash !== value.authority.semanticRuleSet.ruleSetHash
        || entry.sourceIntent.subjectKind !== rule.subjectKind
        || entry.sourceIntent.responsibility !== rule.responsibility
        || entry.sourceIntent.legacyIntentKind !== rule.legacyIntentKind
        || entry.sourceIntent.legacyTargetKind !== rule.legacyTargetKind
        || entry.target.policyRuleHash !== hashSemanticRealizationPolicyRuleV2(rule)
        || entry.target.kind !== realizationKind
        || targetMemberKind !== ruleMemberKind
      ) {
        context.addIssue({
          code: "custom",
          path: ["realizations", index],
          message: "Every realization must equal one exact active policy rule",
        });
      }
    });
  }
  if (value.planHash !== hashSemanticRealizationPlanV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["planHash"],
      message: "Semantic realization plan hash must bind the complete artifact",
    });
  }
}

const PlanCandidateV2Schema = PlanIdentityV2Schema.extend({
  planHash: Sha256Schema,
}).strict().superRefine(addPlanClosureIssuesV2);

export const SemanticRealizationPlanV2Schema = z.unknown().superRefine(
  (value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: SEMANTIC_REALIZATION_PLAN_V2_MAX_CANONICAL_BYTES,
        ...SEMANTIC_REALIZATION_PLAN_V2_BOUNDED_WORK_LIMITS,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: "Semantic realization plan exceeds its canonical byte or work bound",
      });
    }
  },
).pipe(PlanCandidateV2Schema);

export type SemanticRealizationPlanV2 = z.infer<typeof PlanCandidateV2Schema>;

export function recursivelyFreezeSemanticRealizationPlanV2<T>(value: T): T {
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
