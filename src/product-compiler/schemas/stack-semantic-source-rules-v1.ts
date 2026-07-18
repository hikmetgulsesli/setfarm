import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { ACTION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2 } from "./action-input-transport-v2.js";
import {
  CapabilityIdSchema,
  GitCodeShaSchema,
  NormalizedRelativeLocatorSchema,
  SemanticArtifactProducerV1Schema,
  Sha256Schema,
  StableReferenceSchema,
  hasUniqueStrings,
} from "./common-v1.js";

export const STACK_SEMANTIC_SOURCE_RULES_CATALOG_ARTIFACT_TYPE_V1 =
  "setfarm.stack-semantic-source-rules-catalog.v1" as const;
export const STACK_SEMANTIC_SOURCE_RULE_SET_SCHEMA_V1 =
  "setfarm.stack-semantic-source-rule-set.v1" as const;
export const STACK_SEMANTIC_SOURCE_RULE_SCHEMA_V1 =
  "setfarm.stack-semantic-source-rule.v1" as const;
export const STACK_SEMANTIC_SOURCE_RULES_CATALOG_VERSION_V1 = "1.0.0" as const;

const VersionIdentitySchema = z.string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._+-]*$/, "Expected a bounded version identity");

const StackPackIdSchema = z.string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase stack-pack ID");

export const SemanticSourceSubjectKindV1Schema = z.enum([
  "entrypoint",
  "command",
  "route",
  "surface",
  "control_slot",
  "physical_control",
  "action",
  "action_input",
  "state",
  "persistence_policy",
  "entity",
  "observable",
  "evidence_predicate",
  "runtime_data_contract",
]);

export type SemanticSourceSubjectKindV1 = z.infer<
  typeof SemanticSourceSubjectKindV1Schema
>;

export const SemanticSourceResponsibilityV1Schema = z.enum([
  "entrypoint_registration",
  "command_registration",
  "platform_command",
  "route_registration",
  "surface_primary",
  "control_binding",
  "physical_control_binding",
  "action_handler",
  "action_input_transport",
  "state_store",
  "persistence_adapter",
  "persistence_exemption",
  "entity_model",
  "observable_projection",
  "predicate_source_binding",
  "api_response_adapter",
  "cli_output_adapter",
  "runtime_data_fixture",
  "runtime_registration",
  "platform_registration",
]);

export type SemanticSourceResponsibilityV1 = z.infer<
  typeof SemanticSourceResponsibilityV1Schema
>;

function frozenResponsibilities(
  values: readonly SemanticSourceResponsibilityV1[],
): readonly SemanticSourceResponsibilityV1[] {
  return Object.freeze([...values]);
}

export const SEMANTIC_SOURCE_RESPONSIBILITIES_BY_SUBJECT_V1 = Object.freeze({
  entrypoint: frozenResponsibilities([
    "entrypoint_registration",
    "runtime_registration",
    "platform_registration",
  ]),
  command: frozenResponsibilities(["command_registration", "platform_command"]),
  route: frozenResponsibilities(["route_registration"]),
  surface: frozenResponsibilities(["surface_primary"]),
  control_slot: frozenResponsibilities(["control_binding"]),
  physical_control: frozenResponsibilities(["physical_control_binding"]),
  action: frozenResponsibilities([
    "action_handler",
    "api_response_adapter",
    "cli_output_adapter",
  ]),
  action_input: frozenResponsibilities(["action_input_transport"]),
  state: frozenResponsibilities(["state_store"]),
  persistence_policy: frozenResponsibilities([
    "persistence_adapter",
    "persistence_exemption",
  ]),
  entity: frozenResponsibilities(["entity_model"]),
  observable: frozenResponsibilities(["observable_projection"]),
  evidence_predicate: frozenResponsibilities(["predicate_source_binding"]),
  runtime_data_contract: frozenResponsibilities([
    "runtime_data_fixture",
    "runtime_registration",
    "platform_registration",
  ]),
} satisfies Readonly<Record<
  SemanticSourceSubjectKindV1,
  readonly SemanticSourceResponsibilityV1[]
>>);

const DesignSourceKindActivationAtomV1Schema = z.object({
  kind: z.literal("design_source_kind"),
  values: z.array(z.enum(["none", "stitch"])).min(1).max(2),
}).strict();

const ActionTriggerActivationAtomV1Schema = z.object({
  kind: z.literal("action_trigger_kind"),
  values: z.array(z.enum(["user", "system", "timer", "route"])).min(1).max(4),
}).strict();

const PersistenceKindActivationAtomV1Schema = z.object({
  kind: z.literal("persistence_kind"),
  values: z.array(z.enum([
    "none",
    "memory",
    "local_storage",
    "database",
    "file",
    "remote_api",
  ])).min(1).max(6),
}).strict();

const PersistenceDurabilityActivationAtomV1Schema = z.object({
  kind: z.literal("persistence_durability"),
  values: z.array(z.enum(["none", "session", "reload", "restart", "durable"]))
    .min(1)
    .max(5),
}).strict();

const EntrypointKindActivationAtomV1Schema = z.object({
  kind: z.literal("entrypoint_kind"),
  values: z.array(z.enum(["web", "cli", "api", "worker", "native", "game"]))
    .min(1)
    .max(6),
}).strict();

const CommandKindActivationAtomV1Schema = z.object({
  kind: z.literal("command_kind"),
  values: z.array(z.enum([
    "install",
    "build",
    "test",
    "dev",
    "preview",
    "lint",
    "evidence",
    "migrate",
  ])).min(1).max(8),
}).strict();

export const SemanticSourceActivationAtomV1Schema = z.discriminatedUnion("kind", [
  DesignSourceKindActivationAtomV1Schema,
  ActionTriggerActivationAtomV1Schema,
  PersistenceKindActivationAtomV1Schema,
  PersistenceDurabilityActivationAtomV1Schema,
  EntrypointKindActivationAtomV1Schema,
  CommandKindActivationAtomV1Schema,
]);

export type SemanticSourceActivationAtomV1 = z.infer<
  typeof SemanticSourceActivationAtomV1Schema
>;

export const SemanticSourceActivationV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("always") }).strict(),
  z.object({
    kind: z.literal("all"),
    atoms: z.array(SemanticSourceActivationAtomV1Schema).min(1).max(8),
  }).strict(),
]);

export type SemanticSourceActivationV1 = z.infer<
  typeof SemanticSourceActivationV1Schema
>;

export const SemanticSourceCardinalityV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exactly_one_per_subject") }).strict(),
  z.object({ kind: z.literal("exactly_one_per_entrypoint") }).strict(),
  z.object({ kind: z.literal("typed_exemption_per_subject") }).strict(),
  z.object({
    kind: z.literal("catalog_bounded_aggregate"),
    maxMembers: z.number().int().positive().max(10_000),
    slotKeyDomainRef: StableReferenceSchema,
  }).strict(),
]);

export type SemanticSourceCardinalityV1 = z.infer<
  typeof SemanticSourceCardinalityV1Schema
>;

export const SemanticSourceOwnerPolicyV1Schema = z.enum([
  "subject_story_owner",
  "setup_owner",
  "generator_owner",
]);

export type SemanticSourceOwnerPolicyV1 = z.infer<
  typeof SemanticSourceOwnerPolicyV1Schema
>;

export const SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V1 = Object.freeze({
  schema: "setfarm.semantic-source-path-token-contract.v1",
  contractRef: "SEMANTIC_SOURCE_PATH_TOKEN_V1",
  contractVersion: 1,
  algorithm: "sha256",
  encoding: "canonical_json",
  inputFields: Object.freeze([
    "ruleSetHash",
    "storyId",
    "subjectKind",
    "subjectRef",
    "responsibility",
  ]),
  outputEncoding: "lowercase_hex_full_64",
  pathAssembly: "${root}/${token}${extension}",
} as const);

export const SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V1 = hashCanonicalJson(
  SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_V1,
);

export const GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2 =
  "setfarm.generated-source-receipt.v2" as const;
export const INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2 =
  "setfarm.invocation-input-transport.v2" as const;

export const STITCH_GENERATED_SOURCE_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.generated-source-contract.v2",
  contractRef: "GENERATOR_STITCH_GENERATED_SOURCE_V2",
  contractVersion: 2,
  receiptArtifactType: GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2,
  indexSchema: "setfarm.stitch-screen-index.v2",
  componentApiSchema: "setfarm.generated-screen-component-api.v1",
  receiptCardinality: "one_per_generated_source_entry",
  semanticIdentityFields: Object.freeze([
    "targetRef",
    "surfaceRefs",
    "physicalControlRefs",
    "actionRefs",
    "actionInputRefs",
    "observableRefs",
  ]),
  requiredAuthority: Object.freeze([
    "componentApiHash",
    "designSourceClosurePayloadHash",
    "generatorImplementationHash",
    "generatorPlatformBundleHash",
    "generatedSourceArtifactHash",
    "generatedSourceByteLength",
    "generatedSourceContentHash",
    "semanticIdentityClosureHash",
    "stitchScreenIndexEntryHash",
    "stitchScreenIndexPayloadHash",
  ]),
  elementKeySource: "subject_ref",
} as const);

export const STITCH_GENERATED_SOURCE_CONTRACT_HASH_V2 = hashCanonicalJson(
  STITCH_GENERATED_SOURCE_CONTRACT_V2,
);

const SemanticTokenPathResolutionV1Schema = z.object({
  kind: z.literal("compiler_semantic_token_path"),
  root: NormalizedRelativeLocatorSchema,
  tokenAlgorithm: z.literal("sha256_full"),
  tokenContractRef: z.literal("SEMANTIC_SOURCE_PATH_TOKEN_V1"),
  tokenContractHash: z.literal(SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V1),
  extension: z.enum([".ts", ".tsx", ".js", ".jsx", ".py", ".json"]),
}).strict();

const SelectedEntrypointPathResolutionV1Schema = z.object({
  kind: z.literal("selected_entrypoint_path"),
  entrypointKind: z.enum(["web", "cli", "api", "worker", "native", "game"]),
}).strict();

const GeneratedReceiptPathResolutionV1Schema = z.object({
  kind: z.literal("generated_receipt_path"),
  receiptSchema: z.literal(GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2),
}).strict();

const FixedReleasePathResolutionV1Schema = z.object({
  kind: z.literal("fixed_release_path"),
  path: NormalizedRelativeLocatorSchema,
}).strict();

const SharedStructuralSlotPathResolutionV1Schema = z.object({
  kind: z.literal("shared_structural_slot_path"),
  pathSource: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("fixed_release_path"),
      path: NormalizedRelativeLocatorSchema,
    }).strict(),
    z.object({
      kind: z.literal("selected_entrypoint_path"),
      entrypointKind: z.enum(["web", "cli", "api", "worker", "native", "game"]),
    }).strict(),
  ]),
}).strict();

export const SemanticSourcePathResolutionV1Schema = z.discriminatedUnion("kind", [
  SemanticTokenPathResolutionV1Schema,
  SelectedEntrypointPathResolutionV1Schema,
  GeneratedReceiptPathResolutionV1Schema,
  FixedReleasePathResolutionV1Schema,
  SharedStructuralSlotPathResolutionV1Schema,
]);

export type SemanticSourcePathResolutionV1 = z.infer<
  typeof SemanticSourcePathResolutionV1Schema
>;

export const SemanticSourceParserRefV1Schema = z.literal(
  "PARSER_TYPESCRIPT_SEMANTIC_SLOTS_V1",
);

export const SEMANTIC_SOURCE_AST_SLOT_KINDS_V1 = Object.freeze([
  "action_registration",
  "api_route_registration",
  "cli_command_registration",
  "control_binding",
  "entrypoint_registration",
  "observable_projection",
  "persistence_registry",
  "physical_control_binding",
  "route_registration",
  "runtime_registration",
  "state_registry",
] as const);

export const TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_V1 = Object.freeze({
  schema: "setfarm.semantic-source-parser-contract.v1",
  parserRef: "PARSER_TYPESCRIPT_SEMANTIC_SLOTS_V1",
  contractVersion: 1,
  language: "typescript",
  identitySource: "stable_semantic_subject_ref",
  collisionPolicy: "reject",
  supportedSlotKinds: SEMANTIC_SOURCE_AST_SLOT_KINDS_V1,
} as const);

export const TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_HASH_V1 =
  hashCanonicalJson(TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_V1);

const VersionedParserAuthorityShape = {
  parserRef: SemanticSourceParserRefV1Schema,
  parserContractHash: Sha256Schema,
};

export const SemanticSourceLocatorContractV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("exclusive_file"),
    contractVersion: z.literal(1),
  }).strict(),
  z.object({
    kind: z.literal("versioned_export"),
    contractVersion: z.literal(1),
    ...VersionedParserAuthorityShape,
    exportTokenDomainRef: StableReferenceSchema,
  }).strict(),
  z.object({
    kind: z.literal("versioned_ast_slot"),
    contractVersion: z.literal(1),
    ...VersionedParserAuthorityShape,
    slotKind: z.enum(SEMANTIC_SOURCE_AST_SLOT_KINDS_V1),
    slotTokenDomainRef: StableReferenceSchema,
  }).strict(),
  z.object({
    kind: z.literal("generated_receipt"),
    contractVersion: z.literal(1),
    receiptSchema: z.literal(GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2),
    elementKeySource: z.literal("subject_ref"),
  }).strict(),
]);

export type SemanticSourceLocatorContractV1 = z.infer<
  typeof SemanticSourceLocatorContractV1Schema
>;

export const SemanticSourceAccessPolicyV1Schema = z.enum([
  "owned_writable",
  "granted_writable",
  "generated_readonly",
  "setup_readonly",
]);

export type SemanticSourceAccessPolicyV1 = z.infer<
  typeof SemanticSourceAccessPolicyV1Schema
>;

export const SEMANTIC_SOURCE_STRUCTURAL_POSTCONDITION_BY_RESPONSIBILITY_V1 =
  Object.freeze({
    entrypoint_registration: "POSTCONDITION_ENTRYPOINT_REGISTRATION_V1",
    command_registration: "POSTCONDITION_COMMAND_REGISTRATION_V1",
    route_registration: "POSTCONDITION_ROUTE_REGISTRATION_V1",
    surface_primary: "POSTCONDITION_SURFACE_PRIMARY_V1",
    control_binding: "POSTCONDITION_CONTROL_BINDING_V1",
    physical_control_binding: "POSTCONDITION_PHYSICAL_CONTROL_BINDING_V1",
    action_handler: "POSTCONDITION_ACTION_HANDLER_V1",
    action_input_transport: "POSTCONDITION_ACTION_INPUT_TRANSPORT_V1",
    state_store: "POSTCONDITION_STATE_STORE_V1",
    persistence_adapter: "POSTCONDITION_PERSISTENCE_ADAPTER_V1",
    entity_model: "POSTCONDITION_ENTITY_MODEL_V1",
    observable_projection: "POSTCONDITION_OBSERVABLE_PROJECTION_V1",
    api_response_adapter: "POSTCONDITION_API_RESPONSE_ADAPTER_V1",
    cli_output_adapter: "POSTCONDITION_CLI_OUTPUT_ADAPTER_V1",
    runtime_data_fixture: "POSTCONDITION_RUNTIME_DATA_FIXTURE_V1",
    runtime_registration: "POSTCONDITION_RUNTIME_REGISTRATION_V1",
  } satisfies Readonly<Partial<Record<
    SemanticSourceResponsibilityV1,
    string
  >>>);

const SemanticSourceStructuralPostconditionRefV1Schema = z.enum([
  "POSTCONDITION_ACTION_HANDLER_V1",
  "POSTCONDITION_ACTION_INPUT_TRANSPORT_V1",
  "POSTCONDITION_API_RESPONSE_ADAPTER_V1",
  "POSTCONDITION_CLI_OUTPUT_ADAPTER_V1",
  "POSTCONDITION_COMMAND_REGISTRATION_V1",
  "POSTCONDITION_CONTROL_BINDING_V1",
  "POSTCONDITION_ENTITY_MODEL_V1",
  "POSTCONDITION_ENTRYPOINT_REGISTRATION_V1",
  "POSTCONDITION_OBSERVABLE_PROJECTION_V1",
  "POSTCONDITION_PERSISTENCE_ADAPTER_V1",
  "POSTCONDITION_PHYSICAL_CONTROL_BINDING_V1",
  "POSTCONDITION_ROUTE_REGISTRATION_V1",
  "POSTCONDITION_RUNTIME_DATA_FIXTURE_V1",
  "POSTCONDITION_RUNTIME_REGISTRATION_V1",
  "POSTCONDITION_STATE_STORE_V1",
  "POSTCONDITION_SURFACE_PRIMARY_V1",
]);

export const SemanticSourceOutputPolicyV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("model_writable"),
    structuralPostconditionRefs: z.array(
      SemanticSourceStructuralPostconditionRefV1Schema,
    ).min(1).max(100),
  }).strict(),
  z.object({
    kind: z.literal("deterministic_generated"),
    generatorContractRef: z.literal("GENERATOR_STITCH_GENERATED_SOURCE_V2"),
    generatorContractHash: z.literal(STITCH_GENERATED_SOURCE_CONTRACT_HASH_V2),
  }).strict(),
  z.object({
    kind: z.literal("readonly_existing"),
    authorityRef: StableReferenceSchema,
  }).strict(),
]);

export type SemanticSourceOutputPolicyV1 = z.infer<
  typeof SemanticSourceOutputPolicyV1Schema
>;

export const SemanticSourceSubjectContractResolutionV1Schema = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("none") }).strict(),
    z.object({
      kind: z.literal("dom_action_input_transport"),
      artifactType: z.literal(ACTION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2),
      contractVersion: z.literal(2),
      contractHashField: z.literal("contractHash"),
      resolutionContractRef: z.literal("ACTION_INPUT_DOM_TRANSPORT_V2"),
    }).strict(),
    z.object({
      kind: z.literal("cli_invocation_input_transport"),
      artifactType: z.literal(INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2),
      contractVersion: z.literal(2),
      contractHashField: z.literal("contractHash"),
      resolutionContractRef: z.literal("ACTION_INPUT_CLI_INVOCATION_V2"),
    }).strict(),
    z.object({
      kind: z.literal("http_invocation_input_transport"),
      artifactType: z.literal(INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2),
      contractVersion: z.literal(2),
      contractHashField: z.literal("contractHash"),
      resolutionContractRef: z.literal("ACTION_INPUT_HTTP_INVOCATION_V2"),
    }).strict(),
  ],
);

export type SemanticSourceSubjectContractResolutionV1 = z.infer<
  typeof SemanticSourceSubjectContractResolutionV1Schema
>;

const SemanticSourceRuleCommonCandidateShape = {
  ruleRef: StableReferenceSchema,
  ruleVersion: VersionIdentitySchema,
  subjectKind: SemanticSourceSubjectKindV1Schema,
  responsibility: SemanticSourceResponsibilityV1Schema,
  activation: SemanticSourceActivationV1Schema,
  cardinality: SemanticSourceCardinalityV1Schema,
};

const SourceSlotRuleCandidateV1Schema = z.object({
  ...SemanticSourceRuleCommonCandidateShape,
  ruleKind: z.literal("source_slot"),
  targetKind: z.enum(["project_source", "generated_source"]),
  ownerPolicy: SemanticSourceOwnerPolicyV1Schema,
  pathResolution: SemanticSourcePathResolutionV1Schema,
  locatorContract: SemanticSourceLocatorContractV1Schema,
  accessPolicy: SemanticSourceAccessPolicyV1Schema,
  outputPolicy: SemanticSourceOutputPolicyV1Schema,
  subjectContractResolution: SemanticSourceSubjectContractResolutionV1Schema,
}).strict();

const PlatformContractRuleCandidateV1Schema = z.object({
  ...SemanticSourceRuleCommonCandidateShape,
  ruleKind: z.literal("platform_contract"),
  targetKind: z.literal("platform_contract"),
  platformAuthorityRef: z.enum([
    "PLATFORM_BUILD_COMMAND_V1",
    "PLATFORM_RUNTIME_REGISTRATION_V1",
  ]),
  platformContractProjectionHash: Sha256Schema,
  capabilityRefs: z.array(CapabilityIdSchema).max(64),
}).strict();

const TypedExemptionRuleCandidateV1Schema = z.object({
  ...SemanticSourceRuleCommonCandidateShape,
  ruleKind: z.literal("typed_exemption"),
  targetKind: z.literal("typed_exemption"),
  subjectKind: z.literal("persistence_policy"),
  responsibility: z.literal("persistence_exemption"),
  exemptionCode: z.enum([
    "PERSISTENCE_NONE_NO_SOURCE_REQUIRED",
    "PERSISTENCE_MEMORY_USES_STATE_STORE",
  ]),
  backingResponsibility: z.enum(["state_store"]).nullable(),
}).strict();

const PredicateRelationRuleCandidateV1Schema = z.object({
  ...SemanticSourceRuleCommonCandidateShape,
  ruleKind: z.literal("predicate_relation"),
  targetKind: z.literal("predicate_relation"),
  subjectKind: z.literal("evidence_predicate"),
  responsibility: z.literal("predicate_source_binding"),
  bindingResolution: z.object({
    kind: z.literal("exact_evidence_adapter_support_signature"),
    registryArtifactType: z.literal("setfarm.evidence-adapter-registry.v1"),
    supportSignatureSchema: z.literal(
      "setfarm.evidence-adapter-support-signature.v1",
    ),
    resolutionContractRef: z.literal(
      "EVIDENCE_ADAPTER_EXACT_SUPPORT_SIGNATURE_V1",
    ),
  }).strict(),
}).strict();

const SemanticSourceRuleCandidateUnionV1Schema = z.discriminatedUnion("ruleKind", [
  SourceSlotRuleCandidateV1Schema,
  PlatformContractRuleCandidateV1Schema,
  TypedExemptionRuleCandidateV1Schema,
  PredicateRelationRuleCandidateV1Schema,
]);

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalStrings(values: readonly string[]): boolean {
  return hasUniqueStrings(values)
    && values.every((value, index) => index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

function activationAtomKey(value: SemanticSourceActivationAtomV1): string {
  return hashCanonicalJson(value);
}

function requireCanonicalActivation(
  context: z.RefinementCtx,
  activation: SemanticSourceActivationV1,
): void {
  if (activation.kind !== "all") return;
  const atomKeys = activation.atoms.map(activationAtomKey);
  const atomKinds = activation.atoms.map((atom) => atom.kind);
  if (!canonicalStrings(atomKeys)) {
    context.addIssue({
      code: "custom",
      path: ["activation", "atoms"],
      message: "Activation atoms must be unique and canonically hash-sorted",
    });
  }
  if (!hasUniqueStrings(atomKinds)) {
    context.addIssue({
      code: "custom",
      path: ["activation", "atoms"],
      message: "Activation may constrain each fact kind at most once",
    });
  }
  activation.atoms.forEach((atom, atomIndex) => {
    if (!canonicalStrings(atom.values)) {
      context.addIssue({
        code: "custom",
        path: ["activation", "atoms", atomIndex, "values"],
        message: "Activation values must be unique and canonically UTF-16 sorted",
      });
    }
  });
}

function requireActivationSubjectCompatibility(
  context: z.RefinementCtx,
  value: z.infer<typeof SemanticSourceRuleCandidateUnionV1Schema>,
): void {
  if (value.activation.kind !== "all") return;
  for (const [atomIndex, atom] of value.activation.atoms.entries()) {
    const compatible = (atom.kind === "design_source_kind"
        && ["surface", "physical_control"].includes(value.subjectKind))
      || (atom.kind === "action_trigger_kind"
        && ["action", "action_input", "observable"].includes(value.subjectKind))
      || ((atom.kind === "persistence_kind" || atom.kind === "persistence_durability")
        && value.subjectKind === "persistence_policy")
      || (atom.kind === "entrypoint_kind" && value.subjectKind === "entrypoint")
      || (atom.kind === "command_kind" && value.subjectKind === "command");
    if (!compatible) {
      context.addIssue({
        code: "custom",
        path: ["activation", "atoms", atomIndex],
        message: "Activation atom is incompatible with the rule subject kind",
      });
    }
  }
}

function hasExactSingletonActivation(
  activation: SemanticSourceActivationV1,
  kind: SemanticSourceActivationAtomV1["kind"],
  value: string,
): boolean {
  return activation.kind === "all"
    && activation.atoms.length === 1
    && activation.atoms[0]?.kind === kind
    && activation.atoms[0].values.length === 1
    && activation.atoms[0].values[0] === value;
}

function requirePersistenceActivationSatisfiable(
  context: z.RefinementCtx,
  activation: SemanticSourceActivationV1,
): void {
  if (activation.kind !== "all") return;
  const kindAtom = activation.atoms.find((atom) => atom.kind === "persistence_kind");
  const durabilityAtom = activation.atoms.find((atom) =>
    atom.kind === "persistence_durability");
  if (!kindAtom || !durabilityAtom) return;
  const allowedDurability = Object.freeze({
    none: "none",
    memory: "session",
    local_storage: "reload",
    database: "durable",
    file: "durable",
  } as const);
  const exactReachableDurabilities = kindAtom.values.map((kind) =>
    allowedDurability[kind as keyof typeof allowedDurability]);
  const exactDurabilitySet = [...new Set(exactReachableDurabilities
    .filter((durability): durability is NonNullable<typeof durability> =>
      durability !== undefined))].sort(compareUtf16);
  if (
    exactReachableDurabilities.some((durability) => durability === undefined)
    || exactDurabilitySet.length !== durabilityAtom.values.length
    || exactDurabilitySet.some((durability, index) =>
      durability !== durabilityAtom.values[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["activation"],
      message: "Persistence kind/durability activation contains an unreachable or partial ProductSpecV2 domain",
    });
  }
}

function requireRuleCompatibility(
  value: z.infer<typeof SemanticSourceRuleCandidateUnionV1Schema>,
  context: z.RefinementCtx,
): void {
  if (!SEMANTIC_SOURCE_RESPONSIBILITIES_BY_SUBJECT_V1[value.subjectKind]
    .includes(value.responsibility)) {
    context.addIssue({
      code: "custom",
      path: ["responsibility"],
      message: "Semantic source responsibility is incompatible with its subject kind",
    });
  }
  requireCanonicalActivation(context, value.activation);
  requireActivationSubjectCompatibility(context, value);
  if (value.subjectKind === "persistence_policy") {
    requirePersistenceActivationSatisfiable(context, value.activation);
  }

  if (value.ruleKind === "source_slot") {
    const isActionInputTransport = value.subjectKind === "action_input"
      && value.responsibility === "action_input_transport";
    if (isActionInputTransport === (value.subjectContractResolution.kind === "none")) {
      context.addIssue({
        code: "custom",
        path: ["subjectContractResolution"],
        message: "Only action-input source slots require one exact transport-contract resolution",
      });
    }
    const generatedPath = value.pathResolution.kind === "generated_receipt_path";
    const generatedLocator = value.locatorContract.kind === "generated_receipt";
    const generatedAccess = value.accessPolicy === "generated_readonly";
    const generatedOutput = value.outputPolicy.kind === "deterministic_generated";
    if (
      (value.targetKind === "generated_source")
        !== (generatedPath && generatedLocator && generatedAccess && generatedOutput)
    ) {
      context.addIssue({
        code: "custom",
        path: ["targetKind"],
        message: "Generated source requires matching receipt path, locator, access, and output authority",
      });
    }
    if (
      value.pathResolution.kind === "generated_receipt_path"
      && value.locatorContract.kind === "generated_receipt"
      && value.pathResolution.receiptSchema !== value.locatorContract.receiptSchema
    ) {
      context.addIssue({
        code: "custom",
        path: ["locatorContract", "receiptSchema"],
        message: "Generated path and locator must bind the same receipt schema",
      });
    }
    const accessOwnerCompatible =
      (value.accessPolicy === "owned_writable"
        && value.ownerPolicy === "subject_story_owner")
      || (value.accessPolicy === "granted_writable"
        && value.ownerPolicy === "setup_owner")
      || (value.accessPolicy === "generated_readonly"
        && value.ownerPolicy === "generator_owner")
      || (value.accessPolicy === "setup_readonly"
        && value.ownerPolicy === "setup_owner");
    if (!accessOwnerCompatible) {
      context.addIssue({
        code: "custom",
        path: ["accessPolicy"],
        message: "Source access must agree with its physical owner policy",
      });
    }
    const accessOutputCompatible =
      (value.outputPolicy.kind === "model_writable"
        && ["owned_writable", "granted_writable"].includes(value.accessPolicy))
      || (value.outputPolicy.kind === "deterministic_generated"
        && value.accessPolicy === "generated_readonly")
      || (value.outputPolicy.kind === "readonly_existing"
        && value.accessPolicy === "setup_readonly");
    if (!accessOutputCompatible) {
      context.addIssue({
        code: "custom",
        path: ["outputPolicy"],
        message: "Source output authority must agree with its access policy",
      });
    }
    if (
      value.targetKind === "project_source"
      && (generatedPath || generatedLocator || generatedAccess || generatedOutput)
    ) {
      context.addIssue({
        code: "custom",
        path: ["targetKind"],
        message: "Project source cannot claim generated-source authority",
      });
    }
    if (
      value.pathResolution.kind === "compiler_semantic_token_path"
      && (
        value.ownerPolicy !== "subject_story_owner"
        || value.accessPolicy !== "owned_writable"
        || value.locatorContract.kind !== "exclusive_file"
        || value.outputPolicy.kind !== "model_writable"
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["pathResolution"],
        message: "Semantic-token paths require story-owned exclusive model-writable source",
      });
    }
    const expectedCardinalityKind = value.pathResolution.kind
      === "shared_structural_slot_path"
      ? "catalog_bounded_aggregate"
      : value.pathResolution.kind === "selected_entrypoint_path"
        ? "exactly_one_per_entrypoint"
        : "exactly_one_per_subject";
    if (value.cardinality.kind !== expectedCardinalityKind) {
      context.addIssue({
        code: "custom",
        path: ["cardinality"],
        message: `Source path ${value.pathResolution.kind} requires ${expectedCardinalityKind} cardinality`,
      });
    }
    if (
      value.pathResolution.kind === "shared_structural_slot_path"
      && (
        (value.locatorContract.kind !== "versioned_ast_slot"
          && value.locatorContract.kind !== "versioned_export")
        || value.cardinality.kind !== "catalog_bounded_aggregate"
        || value.accessPolicy !== "granted_writable"
        || value.outputPolicy.kind !== "model_writable"
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["pathResolution"],
        message: "Shared structural paths require bounded aggregation and a granted, versioned writable locator",
      });
    }
    if (
      (value.locatorContract.kind === "versioned_ast_slot"
        || value.locatorContract.kind === "versioned_export")
      && value.locatorContract.parserContractHash
        !== TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_HASH_V1
    ) {
      context.addIssue({
        code: "custom",
        path: ["locatorContract", "parserContractHash"],
        message: "Versioned structural locators must bind the exact code-owned parser contract",
      });
    }
    if (
      value.pathResolution.kind === "fixed_release_path"
      && (
        value.accessPolicy !== "setup_readonly"
        || value.outputPolicy.kind !== "readonly_existing"
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["pathResolution"],
        message: "Fixed release paths are setup-owned readonly authority",
      });
    }
    if (
      value.pathResolution.kind === "selected_entrypoint_path"
      && value.accessPolicy !== "setup_readonly"
    ) {
      context.addIssue({
        code: "custom",
        path: ["pathResolution"],
        message: "Writable entrypoint slots must use shared_structural_slot_path",
      });
    }
    if (
      value.cardinality.kind === "catalog_bounded_aggregate"
      && value.locatorContract.kind !== "versioned_ast_slot"
      && value.locatorContract.kind !== "versioned_export"
    ) {
      context.addIssue({
        code: "custom",
        path: ["cardinality"],
        message: "Aggregated source requires a versioned structural locator",
      });
    }
    if (value.cardinality.kind === "catalog_bounded_aggregate") {
      const expectedDomainRef = `SLOT_DOMAIN_${value.responsibility.toUpperCase()}_V1`;
      if (value.cardinality.slotKeyDomainRef !== expectedDomainRef) {
        context.addIssue({
          code: "custom",
          path: ["cardinality", "slotKeyDomainRef"],
          message: "Aggregate slot-key domain must equal its exact semantic responsibility",
        });
      }
    }
    if (value.locatorContract.kind === "versioned_ast_slot") {
      const expectedTokenDomainRef = `SLOT_TOKEN_${value.responsibility.toUpperCase()}_V1`;
      if (value.locatorContract.slotTokenDomainRef !== expectedTokenDomainRef) {
        context.addIssue({
          code: "custom",
          path: ["locatorContract", "slotTokenDomainRef"],
          message: "AST slot-token domain must equal its exact semantic responsibility",
        });
      }
    }
    if (value.outputPolicy.kind === "model_writable") {
      const expectedPostcondition =
        SEMANTIC_SOURCE_STRUCTURAL_POSTCONDITION_BY_RESPONSIBILITY_V1[
          value.responsibility as keyof typeof SEMANTIC_SOURCE_STRUCTURAL_POSTCONDITION_BY_RESPONSIBILITY_V1
        ];
      if (
        !expectedPostcondition
        || value.outputPolicy.structuralPostconditionRefs.length !== 1
        || value.outputPolicy.structuralPostconditionRefs[0] !== expectedPostcondition
      ) {
        context.addIssue({
          code: "custom",
          path: ["outputPolicy", "structuralPostconditionRefs"],
          message: "Writable source must bind its one exact code-owned structural postcondition",
        });
      }
    }
    if (value.targetKind === "generated_source") {
      const exactGeneratedSubject =
        (value.subjectKind === "surface" && value.responsibility === "surface_primary")
        || (value.subjectKind === "physical_control"
          && value.responsibility === "physical_control_binding");
      if (
        !exactGeneratedSubject
        || !hasExactSingletonActivation(
          value.activation,
          "design_source_kind",
          "stitch",
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["targetKind"],
          message: "Generated source is limited to exact Stitch surface and physical-control subjects",
        });
      }
    }
    if (
      value.subjectKind === "physical_control"
      && value.responsibility === "physical_control_binding"
      && value.targetKind !== "generated_source"
    ) {
      context.addIssue({
        code: "custom",
        path: ["targetKind"],
        message: "Physical-control source authority exists only through verified generated receipts",
      });
    }
    if (
      value.subjectKind === "surface"
      && value.responsibility === "surface_primary"
      && value.targetKind === "project_source"
      && !hasExactSingletonActivation(value.activation, "design_source_kind", "none")
    ) {
      context.addIssue({
        code: "custom",
        path: ["activation"],
        message: "Project-owned primary surfaces require exact typed design absence",
      });
    }
  }

  if (value.ruleKind === "platform_contract") {
    if (!canonicalStrings(value.capabilityRefs)) {
      context.addIssue({
        code: "custom",
        path: ["capabilityRefs"],
        message: "Platform capability refs must be unique and canonically sorted",
      });
    }
    const buildCommandAuthority = value.platformAuthorityRef === "PLATFORM_BUILD_COMMAND_V1";
    const exactSubject = buildCommandAuthority
      ? value.subjectKind === "command" && value.responsibility === "platform_command"
      : value.subjectKind === "runtime_data_contract"
        && value.responsibility === "platform_registration";
    const exactActivation = buildCommandAuthority
      ? value.activation.kind === "all"
        && value.activation.atoms.length === 1
        && value.activation.atoms[0]?.kind === "command_kind"
      : value.activation.kind === "always";
    if (
      !exactSubject
      || !exactActivation
      || value.cardinality.kind !== "exactly_one_per_subject"
    ) {
      context.addIssue({
        code: "custom",
        path: ["platformAuthorityRef"],
        message: "Platform authority requires its exact subject, activation, and per-subject cardinality",
      });
    }
  }
  if (
    value.ruleKind === "typed_exemption"
    && value.cardinality.kind !== "typed_exemption_per_subject"
  ) {
    context.addIssue({
      code: "custom",
      path: ["cardinality"],
      message: "Typed exemption rules require exemption-per-subject cardinality",
    });
  }
  if (value.ruleKind === "typed_exemption") {
    const expectedPersistenceKind = value.exemptionCode
      === "PERSISTENCE_NONE_NO_SOURCE_REQUIRED" ? "none" : "memory";
    const exactActivation = value.activation.kind === "all"
      && value.activation.atoms.length === 1
      && value.activation.atoms[0]?.kind === "persistence_kind"
      && value.activation.atoms[0].values.length === 1
      && value.activation.atoms[0].values[0] === expectedPersistenceKind;
    if (!exactActivation) {
      context.addIssue({
        code: "custom",
        path: ["activation"],
        message: "Persistence exemptions require the exact singleton persistence-kind activation",
      });
    }
  }
  if (
    value.ruleKind === "source_slot"
    && value.subjectKind === "persistence_policy"
    && value.responsibility === "persistence_adapter"
  ) {
    const persistenceAtom = value.activation.kind === "all"
      ? value.activation.atoms.find((atom) => atom.kind === "persistence_kind")
      : undefined;
    if (
      !persistenceAtom
      || persistenceAtom.values.some((kind) => kind === "none" || kind === "memory")
    ) {
      context.addIssue({
        code: "custom",
        path: ["activation"],
        message: "Persistence adapters require explicit non-exempt persistence kinds",
      });
    }
  }
  if (
    value.ruleKind === "typed_exemption"
    && value.exemptionCode === "PERSISTENCE_NONE_NO_SOURCE_REQUIRED"
    && value.backingResponsibility !== null
  ) {
    context.addIssue({
      code: "custom",
      path: ["backingResponsibility"],
      message: "Persistence-none exemption cannot claim a backing source responsibility",
    });
  }
  if (
    value.ruleKind === "typed_exemption"
    && value.exemptionCode === "PERSISTENCE_MEMORY_USES_STATE_STORE"
    && value.backingResponsibility !== "state_store"
  ) {
    context.addIssue({
      code: "custom",
      path: ["backingResponsibility"],
      message: "Memory persistence exemption must bind the state-store responsibility",
    });
  }
  if (
    value.ruleKind === "predicate_relation"
    && (
      value.cardinality.kind !== "exactly_one_per_subject"
      || value.activation.kind !== "always"
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["cardinality"],
      message: "Predicate relation rules require one always-active exact-support relation per predicate",
    });
  }
}

export const SemanticSourceRuleCandidateV1Schema =
  SemanticSourceRuleCandidateUnionV1Schema.superRefine(requireRuleCompatibility);

export type SemanticSourceRuleCandidateV1 = z.infer<
  typeof SemanticSourceRuleCandidateV1Schema
>;

function canonicalActivationAtom(
  atom: SemanticSourceActivationAtomV1,
): SemanticSourceActivationAtomV1 {
  switch (atom.kind) {
    case "design_source_kind":
      return { ...atom, values: [...atom.values].sort(compareUtf16) };
    case "action_trigger_kind":
      return { ...atom, values: [...atom.values].sort(compareUtf16) };
    case "persistence_kind":
      return { ...atom, values: [...atom.values].sort(compareUtf16) };
    case "persistence_durability":
      return { ...atom, values: [...atom.values].sort(compareUtf16) };
    case "entrypoint_kind":
      return { ...atom, values: [...atom.values].sort(compareUtf16) };
    case "command_kind":
      return { ...atom, values: [...atom.values].sort(compareUtf16) };
  }
}

function canonicalActivation(
  activation: SemanticSourceActivationV1,
): SemanticSourceActivationV1 {
  if (activation.kind === "always") return activation;
  return {
    kind: "all",
    atoms: activation.atoms
      .map(canonicalActivationAtom)
      .sort((left, right) => compareUtf16(activationAtomKey(left), activationAtomKey(right))),
  };
}

function activationDomains(
  activation: SemanticSourceActivationV1,
): ReadonlyMap<string, ReadonlySet<string>> {
  if (activation.kind === "always") return new Map();
  return new Map(activation.atoms.map((atom) => [
    atom.kind,
    new Set<string>(atom.values),
  ]));
}

function semanticSourceActivationsOverlap(
  left: SemanticSourceActivationV1,
  right: SemanticSourceActivationV1,
): boolean {
  const leftDomains = activationDomains(left);
  const rightDomains = activationDomains(right);
  for (const [kind, leftValues] of leftDomains) {
    const rightValues = rightDomains.get(kind);
    if (rightValues && ![...leftValues].some((value) => rightValues.has(value))) {
      return false;
    }
  }
  return true;
}

export function canonicalSemanticSourceRuleCandidateV1(
  value: SemanticSourceRuleCandidateV1,
): SemanticSourceRuleCandidateV1 {
  const candidate = {
    ...value,
    activation: canonicalActivation(value.activation),
    ...(value.ruleKind === "source_slot" && value.outputPolicy.kind === "model_writable"
      ? {
          outputPolicy: {
            ...value.outputPolicy,
            structuralPostconditionRefs: [
              ...value.outputPolicy.structuralPostconditionRefs,
            ].sort(compareUtf16),
          },
        }
      : {}),
    ...(value.ruleKind === "platform_contract"
      ? { capabilityRefs: [...value.capabilityRefs].sort(compareUtf16) }
      : {}),
  };
  return SemanticSourceRuleCandidateV1Schema.parse(candidate);
}

export function hashSemanticSourceRuleV1(
  value: SemanticSourceRuleCandidateV1,
): string {
  return hashCanonicalJson({
    schema: STACK_SEMANTIC_SOURCE_RULE_SCHEMA_V1,
    ...canonicalSemanticSourceRuleCandidateV1(value),
  });
}

const SemanticSourceFinalRuleCommonShape = {
  schema: z.literal(STACK_SEMANTIC_SOURCE_RULE_SCHEMA_V1),
  ruleHash: Sha256Schema,
};

const SemanticSourceRuleV1UnionSchema = z.discriminatedUnion("ruleKind", [
  SourceSlotRuleCandidateV1Schema.extend(SemanticSourceFinalRuleCommonShape).strict(),
  PlatformContractRuleCandidateV1Schema.extend(SemanticSourceFinalRuleCommonShape).strict(),
  TypedExemptionRuleCandidateV1Schema.extend(SemanticSourceFinalRuleCommonShape).strict(),
  PredicateRelationRuleCandidateV1Schema.extend(SemanticSourceFinalRuleCommonShape).strict(),
]);

export const SemanticSourceRuleV1Schema = SemanticSourceRuleV1UnionSchema.superRefine(
  (value, context) => {
    const { schema: _schema, ruleHash: _ruleHash, ...candidate } = value;
    const parsedCandidate = SemanticSourceRuleCandidateV1Schema.safeParse(candidate);
    if (!parsedCandidate.success) {
      for (const issue of parsedCandidate.error.issues) {
        context.addIssue({ ...issue, path: issue.path });
      }
      return;
    }
    if (value.ruleHash !== hashSemanticSourceRuleV1(parsedCandidate.data)) {
      context.addIssue({
        code: "custom",
        path: ["ruleHash"],
        message: "Rule hash must bind the exact domain-separated semantic source rule",
      });
    }
  },
);

export type SemanticSourceRuleV1 = z.infer<typeof SemanticSourceRuleV1Schema>;

export const SemanticSourceRuleSetShadowBlockerCodeV1Schema = z.enum([
  "SEMANTIC_SOURCE_GENERATED_RECEIPT_UNVERIFIED",
  "SEMANTIC_SOURCE_INVOCATION_INPUT_TRANSPORT_UNVERIFIED",
  "SEMANTIC_SOURCE_PARSER_IMPLEMENTATION_UNVERIFIED",
  "SEMANTIC_SOURCE_RELEASE_MANIFEST_UNVERIFIED",
]);

export const SemanticSourceRuleSetReadinessV1Schema = z.object({
  status: z.literal("shadow"),
  blockerCodes: z.array(SemanticSourceRuleSetShadowBlockerCodeV1Schema)
    .min(1)
    .max(16),
}).strict().superRefine((value, context) => {
  if (!canonicalStrings(value.blockerCodes)) {
    context.addIssue({
      code: "custom",
      path: ["blockerCodes"],
      message: "Shadow blocker codes must be unique and canonically sorted",
    });
  }
});

export const StackSemanticSourceRuleSetCandidateV1Schema = z.object({
  ruleSetRef: StableReferenceSchema,
  ruleSetVersion: VersionIdentitySchema,
  readiness: SemanticSourceRuleSetReadinessV1Schema,
  stackPackBinding: z.object({
    stackPackId: StackPackIdSchema,
    stackPackVersion: VersionIdentitySchema,
    stackPackContentHash: Sha256Schema,
  }).strict(),
  rules: z.array(SemanticSourceRuleCandidateV1Schema).min(1).max(512),
}).strict();

export type StackSemanticSourceRuleSetCandidateV1 = z.infer<
  typeof StackSemanticSourceRuleSetCandidateV1Schema
>;

export const StackSemanticSourceRuleSetV1Schema = z.object({
  schema: z.literal(STACK_SEMANTIC_SOURCE_RULE_SET_SCHEMA_V1),
  ruleSetRef: StableReferenceSchema,
  ruleSetVersion: VersionIdentitySchema,
  readiness: SemanticSourceRuleSetReadinessV1Schema,
  stackPackBinding: StackSemanticSourceRuleSetCandidateV1Schema.shape.stackPackBinding,
  rules: z.array(SemanticSourceRuleV1Schema).min(1).max(512),
  ruleSetHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const ruleRefs = value.rules.map((rule) => rule.ruleRef);
  const ruleHashes = value.rules.map((rule) => rule.ruleHash);
  if (!canonicalStrings(ruleRefs) || !hasUniqueStrings(ruleHashes)) {
    context.addIssue({
      code: "custom",
      path: ["rules"],
      message: "Rule-set rules must be canonical by ref and unique by hash",
    });
  }
  for (let leftIndex = 0; leftIndex < value.rules.length; leftIndex += 1) {
    const left = value.rules[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < value.rules.length; rightIndex += 1) {
      const right = value.rules[rightIndex]!;
      if (
        left.subjectKind === right.subjectKind
        && left.responsibility === right.responsibility
        && semanticSourceActivationsOverlap(left.activation, right.activation)
      ) {
        context.addIssue({
          code: "custom",
          path: ["rules", rightIndex, "activation"],
          message: `Rule activation overlaps ${left.ruleRef} for the same semantic responsibility`,
        });
      }
    }
  }
  if (value.ruleSetHash !== hashStackSemanticSourceRuleSetV1(value)) {
    context.addIssue({
      code: "custom",
      path: ["ruleSetHash"],
      message: "Rule-set hash must bind the exact domain-separated rule set",
    });
  }
});

export type StackSemanticSourceRuleSetV1 = z.infer<
  typeof StackSemanticSourceRuleSetV1Schema
>;

export function hashStackSemanticSourceRuleSetV1(
  value: Omit<StackSemanticSourceRuleSetV1, "ruleSetHash"> | StackSemanticSourceRuleSetV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.ruleSetHash;
  return hashCanonicalJson({
    schema: STACK_SEMANTIC_SOURCE_RULE_SET_SCHEMA_V1,
    ruleSet: payload,
  });
}

export const StackSemanticSourceRulesReleaseAuthorityV1Schema = z.object({
  codeSha: GitCodeShaSchema,
  platformBundleHash: Sha256Schema,
}).strict();

export type StackSemanticSourceRulesReleaseAuthorityV1 = z.infer<
  typeof StackSemanticSourceRulesReleaseAuthorityV1Schema
>;

export const StackSemanticSourceRulesCatalogCompilerInputV1Schema = z.object({
  producer: SemanticArtifactProducerV1Schema,
  releaseAuthority: StackSemanticSourceRulesReleaseAuthorityV1Schema,
}).strict().superRefine((value, context) => {
  if (value.producer.codeSha !== value.releaseAuthority.codeSha) {
    context.addIssue({
      code: "custom",
      path: ["releaseAuthority", "codeSha"],
      message: "Semantic source rules release SHA must equal the producer code SHA",
    });
  }
});

export type StackSemanticSourceRulesCatalogCompilerInputV1 = z.infer<
  typeof StackSemanticSourceRulesCatalogCompilerInputV1Schema
>;

export const StackSemanticSourceRulesCatalogV1Schema = z.object({
  schema: z.literal(STACK_SEMANTIC_SOURCE_RULES_CATALOG_ARTIFACT_TYPE_V1),
  catalogVersion: z.literal(STACK_SEMANTIC_SOURCE_RULES_CATALOG_VERSION_V1),
  producer: SemanticArtifactProducerV1Schema,
  releaseAuthority: StackSemanticSourceRulesReleaseAuthorityV1Schema,
  ruleSets: z.array(StackSemanticSourceRuleSetV1Schema).min(1).max(64),
  catalogPayloadHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.producer.codeSha !== value.releaseAuthority.codeSha) {
    context.addIssue({
      code: "custom",
      path: ["releaseAuthority", "codeSha"],
      message: "Semantic source rules release SHA must equal the producer code SHA",
    });
  }
  const refs = value.ruleSets.map((ruleSet) => ruleSet.ruleSetRef);
  const stackIds = value.ruleSets.map((ruleSet) => ruleSet.stackPackBinding.stackPackId);
  const ruleRefs = value.ruleSets.flatMap((ruleSet) =>
    ruleSet.rules.map((rule) => rule.ruleRef));
  if (!canonicalStrings(refs) || !hasUniqueStrings(stackIds)) {
    context.addIssue({
      code: "custom",
      path: ["ruleSets"],
      message: "Catalog rule sets must be canonical by ref and unique by stack pack",
    });
  }
  if (!hasUniqueStrings(ruleRefs)) {
    context.addIssue({
      code: "custom",
      path: ["ruleSets"],
      message: "Catalog semantic rule refs must be globally unique",
    });
  }
  if (value.catalogPayloadHash !== hashStackSemanticSourceRulesCatalogPayloadV1(value)) {
    context.addIssue({
      code: "custom",
      path: ["catalogPayloadHash"],
      message: "Catalog payload hash must bind the exact canonical rules catalog",
    });
  }
});

export type StackSemanticSourceRulesCatalogV1 = z.infer<
  typeof StackSemanticSourceRulesCatalogV1Schema
>;

export function hashStackSemanticSourceRulesCatalogPayloadV1(
  value:
    | Omit<StackSemanticSourceRulesCatalogV1, "catalogPayloadHash">
    | StackSemanticSourceRulesCatalogV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.catalogPayloadHash;
  return hashCanonicalJson({
    schema: STACK_SEMANTIC_SOURCE_RULES_CATALOG_ARTIFACT_TYPE_V1,
    catalog: payload,
  });
}
