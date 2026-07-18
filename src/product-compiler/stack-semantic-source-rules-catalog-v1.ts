import { z } from "zod";

import {
  SemanticArtifactEnvelopeV1Schema,
  type SemanticArtifactEnvelopeV1,
} from "./artifact-envelope.js";
import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  copyPreparedArtifactStoreBatchCanonicalItemsV1,
  prepareArtifactStoreBatchPlanV1,
} from "./artifact-store-batch-plan.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import type { SemanticArtifactProducerV1 } from "./schemas/common-v1.js";
import {
  STACK_SEMANTIC_SOURCE_RULES_CATALOG_ARTIFACT_TYPE_V1,
  STACK_SEMANTIC_SOURCE_RULES_CATALOG_VERSION_V1,
  STACK_SEMANTIC_SOURCE_RULE_SCHEMA_V1,
  STACK_SEMANTIC_SOURCE_RULE_SET_SCHEMA_V1,
  SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V1,
  GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2,
  STITCH_GENERATED_SOURCE_CONTRACT_HASH_V2,
  TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_HASH_V1,
  SemanticSourceRuleCandidateV1Schema,
  SemanticSourceRuleV1Schema,
  StackSemanticSourceRuleSetV1Schema,
  StackSemanticSourceRulesCatalogCompilerInputV1Schema,
  StackSemanticSourceRulesCatalogV1Schema,
  canonicalSemanticSourceRuleCandidateV1,
  hashSemanticSourceRuleV1,
  hashStackSemanticSourceRuleSetV1,
  hashStackSemanticSourceRulesCatalogPayloadV1,
  type SemanticSourceActivationV1,
  type SemanticSourceResponsibilityV1,
  type SemanticSourceRuleCandidateV1,
  type SemanticSourceRuleV1,
  type SemanticSourceSubjectContractResolutionV1,
  type SemanticSourceSubjectKindV1,
  type StackSemanticSourceRuleSetV1,
  type StackSemanticSourceRulesCatalogCompilerInputV1,
  type StackSemanticSourceRulesCatalogV1,
} from "./schemas/stack-semantic-source-rules-v1.js";
import { getStackTopologyCatalogContract } from "./stack-topology-catalog.js";

export const STACK_SEMANTIC_SOURCE_RULES_CATALOG_PACK_IDS_V1 = Object.freeze([
  "browser-game-canvas",
  "node-cli",
  "node-express-api",
  "vite-react-web-app",
] as const);

export type StackSemanticSourceRulesCatalogDiagnosticV1 = Readonly<{
  code:
    | "STACK_SEMANTIC_SOURCE_RULES_V1_INPUT_INVALID"
    | "STACK_SEMANTIC_SOURCE_RULES_V1_CATALOG_MISMATCH"
    | "STACK_SEMANTIC_SOURCE_RULES_V1_CONTRACT_INVALID"
    | "STACK_SEMANTIC_SOURCE_RULES_V1_PUBLICATION_INCOMPATIBLE"
    | "STACK_SEMANTIC_SOURCE_RULES_V1_VERIFICATION_INPUT_INVALID"
    | "STACK_SEMANTIC_SOURCE_RULES_V1_ENVELOPE_INVALID"
    | "STACK_SEMANTIC_SOURCE_RULES_V1_AUTHORITY_MISMATCH";
  message: string;
  reference: string;
}>;

export type StackSemanticSourceRulesCatalogCompilationResultV1 =
  | Readonly<{
      status: "compiled";
      diagnostics: readonly [];
      catalog: Readonly<StackSemanticSourceRulesCatalogV1>;
      catalogPayloadHash: string;
      catalogArtifactHash: string;
      catalogArtifactByteLength: number;
      envelope: Readonly<SemanticArtifactEnvelopeV1>;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly StackSemanticSourceRulesCatalogDiagnosticV1[];
    }>;

export type StackSemanticSourceRulesCatalogVerificationResultV1 =
  | Readonly<{
      status: "verified";
      diagnostics: readonly [];
      catalog: Readonly<StackSemanticSourceRulesCatalogV1>;
      catalogPayloadHash: string;
      catalogArtifactHash: string;
      catalogArtifactByteLength: number;
      envelope: Readonly<SemanticArtifactEnvelopeV1>;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly StackSemanticSourceRulesCatalogDiagnosticV1[];
    }>;

const MAX_DIAGNOSTICS = 100;
const CATALOG_COMPILER_INPUT_MAX_BYTES = 1024 * 1024;
const CATALOG_VERIFICATION_INPUT_MAX_BYTES = 8 * 1024 * 1024;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const CatalogVerificationOuterV1Schema = z.object({
  compilerInput: z.unknown(),
  candidateEnvelope: z.unknown(),
}).strict();

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareDiagnostics(
  left: StackSemanticSourceRulesCatalogDiagnosticV1,
  right: StackSemanticSourceRulesCatalogDiagnosticV1,
): number {
  return compareUtf16(
    `${left.code}\0${left.reference}\0${left.message}`,
    `${right.code}\0${right.reference}\0${right.message}`,
  );
}

function diagnostic(
  code: StackSemanticSourceRulesCatalogDiagnosticV1["code"],
  message: string,
  reference: string,
): StackSemanticSourceRulesCatalogDiagnosticV1 {
  return {
    code,
    message: message.slice(0, 1_000),
    reference: reference.slice(0, 500),
  };
}

function diagnosticsFromZod(
  code: StackSemanticSourceRulesCatalogDiagnosticV1["code"],
  error: z.ZodError,
): StackSemanticSourceRulesCatalogDiagnosticV1[] {
  const retainedLimit = MAX_DIAGNOSTICS - 1;
  const diagnostics = error.issues.slice(0, retainedLimit).map((issue) => diagnostic(
    code,
    issue.message,
    issue.path.length > 0 ? issue.path.join(".") : "catalog",
  ));
  if (error.issues.length > retainedLimit) {
    diagnostics.push(diagnostic(
      code,
      `Catalog validation produced ${error.issues.length} diagnostics; retained the first ${retainedLimit}`,
      "catalog",
    ));
  }
  return diagnostics.sort(compareDiagnostics);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown semantic source authority failure";
}

function boundedJsonSnapshot(value: unknown, maxBytes: number): unknown {
  const bytes = canonicalJsonBytesBounded(value, {
    maxBytes,
    ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  });
  return JSON.parse(bytes.toString("utf8"));
}

function deepFreezeJson<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const stack: object[] = [value as object];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        stack.push(child);
      }
    }
    Object.freeze(current);
  }
  return value;
}

function canonicalValues<T extends string>(values: readonly T[]): T[] {
  return [...values].sort(compareUtf16);
}

function oneFactActivation(
  kind: "design_source_kind" | "action_trigger_kind" | "persistence_kind"
    | "persistence_durability" | "entrypoint_kind" | "command_kind",
  values: readonly string[],
): SemanticSourceActivationV1 {
  return {
    kind: "all",
    atoms: [{ kind, values: canonicalValues(values) }],
  } as SemanticSourceActivationV1;
}

const ALWAYS_ACTIVATION = Object.freeze({ kind: "always" } as const);

function parseCandidate(value: unknown): SemanticSourceRuleCandidateV1 {
  return canonicalSemanticSourceRuleCandidateV1(
    SemanticSourceRuleCandidateV1Schema.parse(value),
  );
}

function postconditionRef(responsibility: SemanticSourceResponsibilityV1): string {
  return `POSTCONDITION_${responsibility.toUpperCase()}_V1`;
}

function exclusiveSourceRule(input: Readonly<{
  ruleRef: string;
  subjectKind: SemanticSourceSubjectKindV1;
  responsibility: SemanticSourceResponsibilityV1;
  activation?: SemanticSourceActivationV1;
  extension?: ".ts" | ".tsx" | ".js" | ".jsx" | ".py" | ".json";
  subjectContractResolution?: SemanticSourceSubjectContractResolutionV1;
}>): SemanticSourceRuleCandidateV1 {
  return parseCandidate({
    ruleRef: input.ruleRef,
    ruleVersion: "1.0.0",
    subjectKind: input.subjectKind,
    responsibility: input.responsibility,
    activation: input.activation ?? ALWAYS_ACTIVATION,
    cardinality: { kind: "exactly_one_per_subject" },
    ruleKind: "source_slot",
    targetKind: "project_source",
    ownerPolicy: "subject_story_owner",
    pathResolution: {
      kind: "compiler_semantic_token_path",
      root: "src/setfarm/semantic",
      tokenAlgorithm: "sha256_full",
      tokenContractRef: "SEMANTIC_SOURCE_PATH_TOKEN_V1",
      tokenContractHash: SEMANTIC_SOURCE_PATH_TOKEN_CONTRACT_HASH_V1,
      extension: input.extension ?? ".ts",
    },
    locatorContract: { kind: "exclusive_file", contractVersion: 1 },
    accessPolicy: "owned_writable",
    outputPolicy: {
      kind: "model_writable",
      structuralPostconditionRefs: [postconditionRef(input.responsibility)],
    },
    subjectContractResolution: input.subjectContractResolution ?? { kind: "none" },
  });
}

function sharedEntrypointRule(input: Readonly<{
  ruleRef: string;
  subjectKind: SemanticSourceSubjectKindV1;
  responsibility: SemanticSourceResponsibilityV1;
  entrypointKind: "web" | "cli" | "api" | "worker" | "native" | "game";
  slotKind:
    | "entrypoint_registration"
    | "route_registration"
    | "action_registration"
    | "control_binding"
    | "physical_control_binding"
    | "state_registry"
    | "persistence_registry"
    | "observable_projection"
    | "cli_command_registration"
    | "api_route_registration"
    | "runtime_registration";
  maxMembers: number;
  activation?: SemanticSourceActivationV1;
}>): SemanticSourceRuleCandidateV1 {
  return parseCandidate({
    ruleRef: input.ruleRef,
    ruleVersion: "1.0.0",
    subjectKind: input.subjectKind,
    responsibility: input.responsibility,
    activation: input.activation ?? ALWAYS_ACTIVATION,
    cardinality: {
      kind: "catalog_bounded_aggregate",
      maxMembers: input.maxMembers,
      slotKeyDomainRef: `SLOT_DOMAIN_${input.responsibility.toUpperCase()}_V1`,
    },
    ruleKind: "source_slot",
    targetKind: "project_source",
    ownerPolicy: "setup_owner",
    pathResolution: {
      kind: "shared_structural_slot_path",
      pathSource: {
        kind: "selected_entrypoint_path",
        entrypointKind: input.entrypointKind,
      },
    },
    locatorContract: {
      kind: "versioned_ast_slot",
      contractVersion: 1,
      parserRef: "PARSER_TYPESCRIPT_SEMANTIC_SLOTS_V1",
      parserContractHash: TYPESCRIPT_SEMANTIC_SOURCE_PARSER_CONTRACT_HASH_V1,
      slotKind: input.slotKind,
      slotTokenDomainRef: `SLOT_TOKEN_${input.responsibility.toUpperCase()}_V1`,
    },
    accessPolicy: "granted_writable",
    outputPolicy: {
      kind: "model_writable",
      structuralPostconditionRefs: [postconditionRef(input.responsibility)],
    },
    subjectContractResolution: { kind: "none" },
  });
}

function generatedSourceRule(input: Readonly<{
  ruleRef: string;
  subjectKind: "surface" | "physical_control";
  responsibility: "surface_primary" | "physical_control_binding";
}>): SemanticSourceRuleCandidateV1 {
  return parseCandidate({
    ruleRef: input.ruleRef,
    ruleVersion: "1.0.0",
    subjectKind: input.subjectKind,
    responsibility: input.responsibility,
    activation: oneFactActivation("design_source_kind", ["stitch"]),
    cardinality: { kind: "exactly_one_per_subject" },
    ruleKind: "source_slot",
    targetKind: "generated_source",
    ownerPolicy: "generator_owner",
    pathResolution: {
      kind: "generated_receipt_path",
      receiptSchema: GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2,
    },
    locatorContract: {
      kind: "generated_receipt",
      contractVersion: 1,
      receiptSchema: GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2,
      elementKeySource: "subject_ref",
    },
    accessPolicy: "generated_readonly",
    outputPolicy: {
      kind: "deterministic_generated",
      generatorContractRef: "GENERATOR_STITCH_GENERATED_SOURCE_V2",
      generatorContractHash: STITCH_GENERATED_SOURCE_CONTRACT_HASH_V2,
    },
    subjectContractResolution: { kind: "none" },
  });
}

function platformContractProjectionHash(input: Readonly<{
  stackPackId: string;
  platformAuthorityRef: "PLATFORM_BUILD_COMMAND_V1" | "PLATFORM_RUNTIME_REGISTRATION_V1";
  commandKinds?: readonly string[];
  capabilityRefs?: readonly string[];
}>): string {
  const stack = getStackTopologyCatalogContract(input.stackPackId);
  if (!stack) throw new Error(`Missing platform projection topology ${input.stackPackId}`);
  const projection = input.platformAuthorityRef === "PLATFORM_BUILD_COMMAND_V1"
    ? {
        commands: stack.descriptor.commands
          .filter((command) => (input.commandKinds ?? []).includes(command.kind))
          .sort((left, right) => compareUtf16(left.id, right.id)),
      }
    : {
        entrypointRules: [...stack.descriptor.entrypointRules]
          .sort((left, right) => compareUtf16(left.id, right.id)),
        capabilities: stack.descriptor.capabilities
          .filter((capability) => (input.capabilityRefs ?? []).includes(capability.id))
          .sort((left, right) => compareUtf16(left.id, right.id)),
        deploymentActivation: stack.descriptor.deploymentActivation,
      };
  return hashCanonicalJson({
    schema: "setfarm.platform-source-contract-projection.v1",
    platformAuthorityRef: input.platformAuthorityRef,
    stackPackBinding: stack.identity,
    projection,
  });
}

function platformRule(input: Readonly<{
  ruleRef: string;
  subjectKind: "entrypoint" | "command" | "runtime_data_contract";
  responsibility: "platform_command" | "runtime_registration" | "platform_registration";
  platformAuthorityRef:
    | "PLATFORM_BUILD_COMMAND_V1"
    | "PLATFORM_RUNTIME_REGISTRATION_V1";
  platformContractProjectionHash: string;
  capabilityRefs?: readonly string[];
  activation?: SemanticSourceActivationV1;
}>): SemanticSourceRuleCandidateV1 {
  return parseCandidate({
    ruleRef: input.ruleRef,
    ruleVersion: "1.0.0",
    subjectKind: input.subjectKind,
    responsibility: input.responsibility,
    activation: input.activation ?? ALWAYS_ACTIVATION,
    cardinality: { kind: "exactly_one_per_subject" },
    ruleKind: "platform_contract",
    targetKind: "platform_contract",
    platformAuthorityRef: input.platformAuthorityRef,
    platformContractProjectionHash: input.platformContractProjectionHash,
    capabilityRefs: canonicalValues(input.capabilityRefs ?? []),
  });
}

function persistenceExemptionRule(
  ruleRef: string,
  kind: "none" | "memory",
): SemanticSourceRuleCandidateV1 {
  return parseCandidate({
    ruleRef,
    ruleVersion: "1.0.0",
    subjectKind: "persistence_policy",
    responsibility: "persistence_exemption",
    activation: oneFactActivation("persistence_kind", [kind]),
    cardinality: { kind: "typed_exemption_per_subject" },
    ruleKind: "typed_exemption",
    targetKind: "typed_exemption",
    exemptionCode: kind === "none"
      ? "PERSISTENCE_NONE_NO_SOURCE_REQUIRED"
      : "PERSISTENCE_MEMORY_USES_STATE_STORE",
    backingResponsibility: kind === "none" ? null : "state_store",
  });
}

function predicateRelationRule(
  ruleRef: string,
): SemanticSourceRuleCandidateV1 {
  return parseCandidate({
    ruleRef,
    ruleVersion: "1.0.0",
    subjectKind: "evidence_predicate",
    responsibility: "predicate_source_binding",
    activation: ALWAYS_ACTIVATION,
    cardinality: { kind: "exactly_one_per_subject" },
    ruleKind: "predicate_relation",
    targetKind: "predicate_relation",
    bindingResolution: {
      kind: "exact_evidence_adapter_support_signature",
      registryArtifactType: "setfarm.evidence-adapter-registry.v1",
      supportSignatureSchema: "setfarm.evidence-adapter-support-signature.v1",
      resolutionContractRef: "EVIDENCE_ADAPTER_EXACT_SUPPORT_SIGNATURE_V1",
    },
  });
}

type RawRuleSetDescriptor = Readonly<{
  ruleSetRef: string;
  stackPackId: typeof STACK_SEMANTIC_SOURCE_RULES_CATALOG_PACK_IDS_V1[number];
  prefix: string;
  entrypointKind: "web" | "game" | "cli" | "api";
  routeSlotKind: "route_registration" | "cli_command_registration" | "api_route_registration";
  stitchCapable: boolean;
  persistenceAdapterKinds: readonly ("local_storage" | "database" | "file")[];
  actionAdapterResponsibility?: "cli_output_adapter" | "api_response_adapter";
  actionInputTransportKind:
    | "dom_action_input_transport"
    | "cli_invocation_input_transport"
    | "http_invocation_input_transport";
}>;

const RAW_RULE_SET_DESCRIPTORS: readonly RawRuleSetDescriptor[] = Object.freeze([
  Object.freeze({
    ruleSetRef: "RULESET_BROWSER_GAME_CANVAS_V1",
    stackPackId: "browser-game-canvas",
    prefix: "BROWSER_GAME",
    entrypointKind: "game",
    routeSlotKind: "route_registration",
    stitchCapable: true,
    persistenceAdapterKinds: Object.freeze(["local_storage"] as const),
    actionInputTransportKind: "dom_action_input_transport",
  }),
  Object.freeze({
    ruleSetRef: "RULESET_NODE_CLI_V1",
    stackPackId: "node-cli",
    prefix: "NODE_CLI",
    entrypointKind: "cli",
    routeSlotKind: "cli_command_registration",
    stitchCapable: false,
    persistenceAdapterKinds: Object.freeze([] as const),
    actionAdapterResponsibility: "cli_output_adapter",
    actionInputTransportKind: "cli_invocation_input_transport",
  }),
  Object.freeze({
    ruleSetRef: "RULESET_NODE_EXPRESS_API_V1",
    stackPackId: "node-express-api",
    prefix: "NODE_API",
    entrypointKind: "api",
    routeSlotKind: "api_route_registration",
    stitchCapable: false,
    persistenceAdapterKinds: Object.freeze(["database", "file"] as const),
    actionAdapterResponsibility: "api_response_adapter",
    actionInputTransportKind: "http_invocation_input_transport",
  }),
  Object.freeze({
    ruleSetRef: "RULESET_VITE_REACT_WEB_APP_V1",
    stackPackId: "vite-react-web-app",
    prefix: "VITE_WEB",
    entrypointKind: "web",
    routeSlotKind: "route_registration",
    stitchCapable: true,
    persistenceAdapterKinds: Object.freeze(["local_storage"] as const),
    actionInputTransportKind: "dom_action_input_transport",
  }),
]);

function rawRules(descriptor: RawRuleSetDescriptor): SemanticSourceRuleCandidateV1[] {
  const ref = (name: string): string => `RULE_${descriptor.prefix}_${name}_V1`;
  const noDesign = oneFactActivation("design_source_kind", ["none"]);
  const stack = getStackTopologyCatalogContract(descriptor.stackPackId);
  if (!stack) throw new Error(`Missing semantic source topology ${descriptor.stackPackId}`);
  const commandKinds = canonicalValues(stack.descriptor.commands.map((command) => command.kind));
  const rules: SemanticSourceRuleCandidateV1[] = [
    sharedEntrypointRule({
      ruleRef: ref("ENTRYPOINT_REGISTRATION"),
      subjectKind: "entrypoint",
      responsibility: "entrypoint_registration",
      entrypointKind: descriptor.entrypointKind,
      slotKind: "entrypoint_registration",
      maxMembers: 64,
      activation: oneFactActivation("entrypoint_kind", [descriptor.entrypointKind]),
    }),
    platformRule({
      ruleRef: ref("PLATFORM_COMMAND"),
      subjectKind: "command",
      responsibility: "platform_command",
      platformAuthorityRef: "PLATFORM_BUILD_COMMAND_V1",
      platformContractProjectionHash: platformContractProjectionHash({
        stackPackId: descriptor.stackPackId,
        platformAuthorityRef: "PLATFORM_BUILD_COMMAND_V1",
        commandKinds,
      }),
      activation: oneFactActivation("command_kind", commandKinds),
    }),
    sharedEntrypointRule({
      ruleRef: ref("ROUTE_REGISTRATION"),
      subjectKind: "route",
      responsibility: "route_registration",
      entrypointKind: descriptor.entrypointKind,
      slotKind: descriptor.routeSlotKind,
      maxMembers: 500,
    }),
    exclusiveSourceRule({
      ruleRef: ref("ACTION_HANDLER"),
      subjectKind: "action",
      responsibility: "action_handler",
    }),
    exclusiveSourceRule({
      ruleRef: ref("ACTION_INPUT_TRANSPORT"),
      subjectKind: "action_input",
      responsibility: "action_input_transport",
      subjectContractResolution: descriptor.actionInputTransportKind
        === "dom_action_input_transport"
        ? {
            kind: "dom_action_input_transport",
            artifactType: "setfarm.action-input-transport.v2",
            contractVersion: 2,
            contractHashField: "contractHash",
            resolutionContractRef: "ACTION_INPUT_DOM_TRANSPORT_V2",
          }
        : descriptor.actionInputTransportKind === "cli_invocation_input_transport"
          ? {
              kind: "cli_invocation_input_transport",
              artifactType: "setfarm.invocation-input-transport.v2",
              contractVersion: 2,
              contractHashField: "contractHash",
              resolutionContractRef: "ACTION_INPUT_CLI_INVOCATION_V2",
            }
          : {
              kind: "http_invocation_input_transport",
              artifactType: "setfarm.invocation-input-transport.v2",
              contractVersion: 2,
              contractHashField: "contractHash",
              resolutionContractRef: "ACTION_INPUT_HTTP_INVOCATION_V2",
            },
    }),
    exclusiveSourceRule({
      ruleRef: ref("STATE_STORE"),
      subjectKind: "state",
      responsibility: "state_store",
    }),
    persistenceExemptionRule(ref("PERSISTENCE_NONE_EXEMPTION"), "none"),
    persistenceExemptionRule(ref("PERSISTENCE_MEMORY_EXEMPTION"), "memory"),
    exclusiveSourceRule({
      ruleRef: ref("ENTITY_MODEL"),
      subjectKind: "entity",
      responsibility: "entity_model",
    }),
    exclusiveSourceRule({
      ruleRef: ref("OBSERVABLE_PROJECTION"),
      subjectKind: "observable",
      responsibility: "observable_projection",
    }),
    predicateRelationRule(ref("PREDICATE_SOURCE_BINDING")),
    exclusiveSourceRule({
      ruleRef: ref("RUNTIME_DATA_FIXTURE"),
      subjectKind: "runtime_data_contract",
      responsibility: "runtime_data_fixture",
      extension: ".json",
    }),
    sharedEntrypointRule({
      ruleRef: ref("RUNTIME_REGISTRATION"),
      subjectKind: "entrypoint",
      responsibility: "runtime_registration",
      entrypointKind: descriptor.entrypointKind,
      slotKind: "runtime_registration",
      maxMembers: 64,
      activation: oneFactActivation("entrypoint_kind", [descriptor.entrypointKind]),
    }),
    platformRule({
      ruleRef: ref("PLATFORM_REGISTRATION"),
      subjectKind: "runtime_data_contract",
      responsibility: "platform_registration",
      platformAuthorityRef: "PLATFORM_RUNTIME_REGISTRATION_V1",
      platformContractProjectionHash: platformContractProjectionHash({
        stackPackId: descriptor.stackPackId,
        platformAuthorityRef: "PLATFORM_RUNTIME_REGISTRATION_V1",
        capabilityRefs: ["CAP_RUNTIME_STATE"],
      }),
      capabilityRefs: ["CAP_RUNTIME_STATE"],
    }),
  ];
  if (descriptor.stitchCapable) {
    rules.push(
      generatedSourceRule({
        ruleRef: ref("SURFACE_PRIMARY_STITCH"),
        subjectKind: "surface",
        responsibility: "surface_primary",
      }),
      exclusiveSourceRule({
        ruleRef: ref("CONTROL_BINDING"),
        subjectKind: "control_slot",
        responsibility: "control_binding",
      }),
      generatedSourceRule({
        ruleRef: ref("PHYSICAL_CONTROL_STITCH"),
        subjectKind: "physical_control",
        responsibility: "physical_control_binding",
      }),
    );
  } else {
    rules.push(exclusiveSourceRule({
      ruleRef: ref("SURFACE_PRIMARY_NO_DESIGN"),
      subjectKind: "surface",
      responsibility: "surface_primary",
      activation: noDesign,
    }));
  }
  if (descriptor.persistenceAdapterKinds.length > 0) {
    rules.push(exclusiveSourceRule({
      ruleRef: ref("PERSISTENCE_ADAPTER"),
      subjectKind: "persistence_policy",
      responsibility: "persistence_adapter",
      activation: oneFactActivation(
        "persistence_kind",
        descriptor.persistenceAdapterKinds,
      ),
    }));
  }
  if (descriptor.actionAdapterResponsibility) {
    rules.push(exclusiveSourceRule({
      ruleRef: ref(descriptor.actionAdapterResponsibility.toUpperCase()),
      subjectKind: "action",
      responsibility: descriptor.actionAdapterResponsibility,
    }));
  }
  return rules.sort((left, right) => compareUtf16(left.ruleRef, right.ruleRef));
}

function finalRule(candidate: SemanticSourceRuleCandidateV1): SemanticSourceRuleV1 {
  const canonical = canonicalSemanticSourceRuleCandidateV1(candidate);
  return SemanticSourceRuleV1Schema.parse({
    schema: STACK_SEMANTIC_SOURCE_RULE_SCHEMA_V1,
    ...canonical,
    ruleHash: hashSemanticSourceRuleV1(canonical),
  });
}

function finalRuleSet(descriptor: RawRuleSetDescriptor): StackSemanticSourceRuleSetV1 {
  const stack = getStackTopologyCatalogContract(descriptor.stackPackId);
  if (!stack) throw new Error(`Missing canonical topology ${descriptor.stackPackId}`);
  const blockerCodes = [
    ...(descriptor.stitchCapable
      ? [
          "SEMANTIC_SOURCE_GENERATED_RECEIPT_UNVERIFIED" as const,
          "SEMANTIC_SOURCE_GENERATOR_EXECUTION_UNVERIFIED" as const,
        ]
      : ["SEMANTIC_SOURCE_INVOCATION_INPUT_TRANSPORT_UNVERIFIED" as const]),
    "SEMANTIC_SOURCE_PARSER_IMPLEMENTATION_UNVERIFIED" as const,
    "SEMANTIC_SOURCE_RELEASE_MANIFEST_UNVERIFIED" as const,
  ].sort(compareUtf16);
  const withoutHash = {
    schema: STACK_SEMANTIC_SOURCE_RULE_SET_SCHEMA_V1,
    ruleSetRef: descriptor.ruleSetRef,
    ruleSetVersion: "1.0.0",
    readiness: {
      status: "shadow" as const,
      blockerCodes,
    },
    stackPackBinding: {
      stackPackId: stack.identity.id,
      stackPackVersion: stack.identity.version,
      stackPackContentHash: stack.identity.contentHash,
    },
    rules: rawRules(descriptor).map(finalRule),
  };
  return StackSemanticSourceRuleSetV1Schema.parse({
    ...withoutHash,
    ruleSetHash: hashStackSemanticSourceRuleSetV1(withoutHash),
  });
}

function catalogDiagnostics(
  ruleSets: readonly StackSemanticSourceRuleSetV1[],
): StackSemanticSourceRulesCatalogDiagnosticV1[] {
  const diagnostics: StackSemanticSourceRulesCatalogDiagnosticV1[] = [];
  let observed = 0;
  const retain = (value: StackSemanticSourceRulesCatalogDiagnosticV1): void => {
    observed += 1;
    const retainedLimit = MAX_DIAGNOSTICS - 1;
    if (diagnostics.length < retainedLimit) {
      diagnostics.push(value);
      diagnostics.sort(compareDiagnostics);
      return;
    }
    if (retainedLimit === 0) return;
    const largest = diagnostics[diagnostics.length - 1]!;
    if (compareDiagnostics(value, largest) < 0) {
      diagnostics[diagnostics.length - 1] = value;
      diagnostics.sort(compareDiagnostics);
    }
  };
  for (const [ruleSetIndex, ruleSet] of ruleSets.entries()) {
    const reference = `ruleSets.${ruleSetIndex}`;
    const stack = getStackTopologyCatalogContract(ruleSet.stackPackBinding.stackPackId);
    if (
      !stack
      || stack.identity.version !== ruleSet.stackPackBinding.stackPackVersion
      || stack.identity.contentHash !== ruleSet.stackPackBinding.stackPackContentHash
    ) {
      retain(diagnostic(
        "STACK_SEMANTIC_SOURCE_RULES_V1_CATALOG_MISMATCH",
        "Rule-set stack binding does not equal the canonical topology catalog",
        `${reference}.stackPackBinding`,
      ));
      continue;
    }
    const sourceDescriptor = RAW_RULE_SET_DESCRIPTORS.find((candidate) =>
      candidate.stackPackId === stack.identity.id);
    if (!sourceDescriptor) {
      retain(diagnostic(
        "STACK_SEMANTIC_SOURCE_RULES_V1_CATALOG_MISMATCH",
        "Rule set has no code-owned semantic domain descriptor",
        reference,
      ));
      continue;
    }
    const expectedBlockerCodes = [
      ...(sourceDescriptor.stitchCapable
        ? [
            "SEMANTIC_SOURCE_GENERATED_RECEIPT_UNVERIFIED" as const,
            "SEMANTIC_SOURCE_GENERATOR_EXECUTION_UNVERIFIED" as const,
          ]
        : ["SEMANTIC_SOURCE_INVOCATION_INPUT_TRANSPORT_UNVERIFIED" as const]),
      "SEMANTIC_SOURCE_PARSER_IMPLEMENTATION_UNVERIFIED" as const,
      "SEMANTIC_SOURCE_RELEASE_MANIFEST_UNVERIFIED" as const,
    ].sort(compareUtf16);
    if (canonicalJsonStringify(ruleSet.readiness.blockerCodes)
      !== canonicalJsonStringify(expectedBlockerCodes)) {
      retain(diagnostic(
        "STACK_SEMANTIC_SOURCE_RULES_V1_CATALOG_MISMATCH",
        "Rule-set shadow blockers do not equal its exact unresolved authority set",
        `${reference}.readiness.blockerCodes`,
      ));
    }
    const commonResponsibilities: SemanticSourceResponsibilityV1[] = [
      "action_handler",
      "action_input_transport",
      "entity_model",
      "entrypoint_registration",
      "observable_projection",
      "persistence_exemption",
      "platform_command",
      "platform_registration",
      "predicate_source_binding",
      "route_registration",
      "runtime_data_fixture",
      "runtime_registration",
      "state_store",
      "surface_primary",
    ];
    const expectedResponsibilities = canonicalValues([
      ...commonResponsibilities,
      ...(sourceDescriptor.stitchCapable
        ? [
            "control_binding" as const,
            "physical_control_binding" as const,
          ]
        : []),
      ...(sourceDescriptor.persistenceAdapterKinds.length > 0
        ? ["persistence_adapter" as const]
        : []),
      ...(sourceDescriptor.actionAdapterResponsibility
        ? [sourceDescriptor.actionAdapterResponsibility]
        : []),
    ]);
    const observedResponsibilities = canonicalValues([
      ...new Set(ruleSet.rules.map((rule) => rule.responsibility)),
    ]);
    if (canonicalJsonStringify(observedResponsibilities)
      !== canonicalJsonStringify(expectedResponsibilities)) {
      retain(diagnostic(
        "STACK_SEMANTIC_SOURCE_RULES_V1_CATALOG_MISMATCH",
        "Rule-set semantic responsibility domain is incomplete or excessive",
        `${reference}.rules`,
      ));
    }
    const activationValues = (
      responsibility: SemanticSourceResponsibilityV1,
      atomKind: "command_kind" | "design_source_kind" | "persistence_kind",
    ): string[] => canonicalValues(ruleSet.rules
      .filter((rule) => rule.responsibility === responsibility)
      .flatMap((rule) => rule.activation.kind === "all"
        ? rule.activation.atoms.flatMap((atom) =>
            atom.kind === atomKind ? atom.values : [])
        : []));
    const expectedDesignKinds = sourceDescriptor.stitchCapable ? ["stitch"] : ["none"];
    if (canonicalJsonStringify(activationValues("surface_primary", "design_source_kind"))
      !== canonicalJsonStringify(expectedDesignKinds)) {
      retain(diagnostic(
        "STACK_SEMANTIC_SOURCE_RULES_V1_CATALOG_MISMATCH",
        "Primary-surface rules do not exactly partition the supported design-source domain",
        `${reference}.rules`,
      ));
    }
    const expectedPersistenceKinds = canonicalValues([
      "memory",
      "none",
      ...sourceDescriptor.persistenceAdapterKinds,
    ]);
    const observedPersistenceKinds = canonicalValues([
      ...activationValues("persistence_exemption", "persistence_kind"),
      ...activationValues("persistence_adapter", "persistence_kind"),
    ]);
    if (canonicalJsonStringify(observedPersistenceKinds)
      !== canonicalJsonStringify(expectedPersistenceKinds)) {
      retain(diagnostic(
        "STACK_SEMANTIC_SOURCE_RULES_V1_CATALOG_MISMATCH",
        "Persistence rules do not exactly partition the stack-supported policy domain",
        `${reference}.rules`,
      ));
    }
    const expectedCommandKinds = canonicalValues(
      stack.descriptor.commands.map((command) => command.kind),
    );
    if (canonicalJsonStringify(activationValues("platform_command", "command_kind"))
      !== canonicalJsonStringify(expectedCommandKinds)) {
      retain(diagnostic(
        "STACK_SEMANTIC_SOURCE_RULES_V1_CATALOG_MISMATCH",
        "Platform-command rules do not exactly cover the topology command domain",
        `${reference}.rules`,
      ));
    }
    const entrypointKinds = new Set(stack.descriptor.entrypointRules.map((rule) => rule.entrypointKind));
    const commandKinds = new Set(stack.descriptor.commands.map((command) => command.kind));
    const enabledCapabilities = new Set(stack.descriptor.capabilities
      .filter((capability) => capability.enabled)
      .map((capability) => capability.id));
    for (const [ruleIndex, rule] of ruleSet.rules.entries()) {
      const ruleReference = `${reference}.rules.${ruleIndex}`;
      const selectedKind = rule.ruleKind === "source_slot"
        ? rule.pathResolution.kind === "selected_entrypoint_path"
          ? rule.pathResolution.entrypointKind
          : rule.pathResolution.kind === "shared_structural_slot_path"
            && rule.pathResolution.pathSource.kind === "selected_entrypoint_path"
            ? rule.pathResolution.pathSource.entrypointKind
            : null
        : null;
      if (selectedKind && !entrypointKinds.has(selectedKind)) {
        retain(diagnostic(
          "STACK_SEMANTIC_SOURCE_RULES_V1_CATALOG_MISMATCH",
          `Rule selects an entrypoint kind absent from ${stack.identity.id}: ${selectedKind}`,
          `${ruleReference}.pathResolution`,
        ));
      }
      if (rule.activation.kind === "all") {
        for (const atom of rule.activation.atoms) {
          if (
            atom.kind === "entrypoint_kind"
            && atom.values.some((kind) => !entrypointKinds.has(kind))
          ) {
            retain(diagnostic(
              "STACK_SEMANTIC_SOURCE_RULES_V1_CATALOG_MISMATCH",
              "Rule activation contains an unavailable entrypoint kind",
              `${ruleReference}.activation`,
            ));
          }
          if (
            atom.kind === "command_kind"
            && atom.values.some((kind) => !commandKinds.has(kind))
          ) {
            retain(diagnostic(
              "STACK_SEMANTIC_SOURCE_RULES_V1_CATALOG_MISMATCH",
              "Rule activation contains an unavailable command kind",
              `${ruleReference}.activation`,
            ));
          }
        }
      }
      const capabilityRefs = rule.ruleKind === "platform_contract"
        ? rule.capabilityRefs
        : [];
      for (const capabilityRef of capabilityRefs) {
        if (!enabledCapabilities.has(capabilityRef)) {
          retain(diagnostic(
            "STACK_SEMANTIC_SOURCE_RULES_V1_CATALOG_MISMATCH",
            `Rule capability is absent or disabled in ${stack.identity.id}: ${capabilityRef}`,
            `${ruleReference}.capabilityRefs`,
          ));
        }
      }
      if (rule.ruleKind === "platform_contract") {
        const commandKindsForProjection = rule.activation.kind === "all"
          ? rule.activation.atoms.flatMap((atom) =>
              atom.kind === "command_kind" ? atom.values : [])
          : [];
        const expectedProjectionHash = platformContractProjectionHash({
          stackPackId: stack.identity.id,
          platformAuthorityRef: rule.platformAuthorityRef,
          commandKinds: commandKindsForProjection,
          capabilityRefs: rule.capabilityRefs,
        });
        if (rule.platformContractProjectionHash !== expectedProjectionHash) {
          retain(diagnostic(
            "STACK_SEMANTIC_SOURCE_RULES_V1_CATALOG_MISMATCH",
            "Platform rule does not bind the exact canonical topology projection",
            `${ruleReference}.platformContractProjectionHash`,
          ));
        }
      }
      if (
        rule.ruleKind === "source_slot"
        && rule.responsibility === "action_input_transport"
        && rule.subjectContractResolution.kind !== sourceDescriptor.actionInputTransportKind
      ) {
        retain(diagnostic(
          "STACK_SEMANTIC_SOURCE_RULES_V1_CATALOG_MISMATCH",
          "Action-input source rule does not bind the stack's exact transport authority",
          `${ruleReference}.subjectContractResolution`,
        ));
      }
    }
  }
  if (observed > MAX_DIAGNOSTICS - 1) {
    diagnostics.push(diagnostic(
      "STACK_SEMANTIC_SOURCE_RULES_V1_CATALOG_MISMATCH",
      `Catalog authority produced ${observed} diagnostics; retained the canonical first ${MAX_DIAGNOSTICS - 1}`,
      "catalogDiagnostics",
    ));
  }
  return diagnostics.sort(compareDiagnostics);
}

function catalogEnvelope(
  producer: SemanticArtifactProducerV1,
  catalog: StackSemanticSourceRulesCatalogV1,
): SemanticArtifactEnvelopeV1 {
  return SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: STACK_SEMANTIC_SOURCE_RULES_CATALOG_ARTIFACT_TYPE_V1,
    producer,
    payload: catalog,
  });
}

type PublicationSnapshot = Readonly<{
  hash: string;
  byteLength: number;
  bytes: Buffer;
  envelope: SemanticArtifactEnvelopeV1;
  catalog: StackSemanticSourceRulesCatalogV1;
}>;

function publicationSnapshot(envelope: unknown): PublicationSnapshot {
  const prepared = prepareArtifactStoreBatchPlanV1({
    schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
    items: [{ durabilityTier: 0, envelope }],
  });
  const items = copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared);
  const item = items[0];
  if (!item || items.length !== 1) {
    throw new Error("Semantic source catalog preparation did not produce exactly one artifact");
  }
  const snapshot = JSON.parse(item.bytes.toString("utf8"));
  const parsedEnvelope = SemanticArtifactEnvelopeV1Schema.parse(snapshot);
  if (parsedEnvelope.artifactType !== STACK_SEMANTIC_SOURCE_RULES_CATALOG_ARTIFACT_TYPE_V1) {
    throw new Error("Semantic source catalog envelope has the wrong artifact type");
  }
  const catalog = StackSemanticSourceRulesCatalogV1Schema.parse(parsedEnvelope.payload);
  if (canonicalJsonStringify(parsedEnvelope.producer) !== canonicalJsonStringify(catalog.producer)) {
    throw new Error("Semantic source catalog envelope producer must equal the payload producer");
  }
  return {
    hash: item.identity.hash,
    byteLength: item.identity.byteLength,
    bytes: item.bytes,
    envelope: parsedEnvelope,
    catalog,
  };
}

export function compileStackSemanticSourceRulesCatalogV1(
  input: unknown,
): StackSemanticSourceRulesCatalogCompilationResultV1 {
  let snapshot: unknown;
  try {
    snapshot = boundedJsonSnapshot(input, CATALOG_COMPILER_INPUT_MAX_BYTES);
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "STACK_SEMANTIC_SOURCE_RULES_V1_INPUT_INVALID",
        errorMessage(error),
        "catalogCompilerInput",
      )],
    };
  }
  const parsed = StackSemanticSourceRulesCatalogCompilerInputV1Schema.safeParse(snapshot);
  if (!parsed.success) {
    return {
      status: "rejected",
      diagnostics: diagnosticsFromZod(
        "STACK_SEMANTIC_SOURCE_RULES_V1_INPUT_INVALID",
        parsed.error,
      ),
    };
  }

  let ruleSets: StackSemanticSourceRuleSetV1[];
  try {
    ruleSets = RAW_RULE_SET_DESCRIPTORS.map(finalRuleSet)
      .sort((left, right) => compareUtf16(left.ruleSetRef, right.ruleSetRef));
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "STACK_SEMANTIC_SOURCE_RULES_V1_CONTRACT_INVALID",
        errorMessage(error),
        "codeOwnedRuleSets",
      )],
    };
  }
  const authorityDiagnostics = catalogDiagnostics(ruleSets);
  if (authorityDiagnostics.length > 0) {
    return { status: "rejected", diagnostics: authorityDiagnostics };
  }

  const withoutHash = {
    schema: STACK_SEMANTIC_SOURCE_RULES_CATALOG_ARTIFACT_TYPE_V1,
    catalogVersion: STACK_SEMANTIC_SOURCE_RULES_CATALOG_VERSION_V1,
    producer: parsed.data.producer,
    releaseAuthority: parsed.data.releaseAuthority,
    ruleSets,
  };
  const candidate = {
    ...withoutHash,
    catalogPayloadHash: hashStackSemanticSourceRulesCatalogPayloadV1(withoutHash),
  };
  const catalog = StackSemanticSourceRulesCatalogV1Schema.safeParse(candidate);
  if (!catalog.success) {
    return {
      status: "rejected",
      diagnostics: diagnosticsFromZod(
        "STACK_SEMANTIC_SOURCE_RULES_V1_CONTRACT_INVALID",
        catalog.error,
      ),
    };
  }

  let publication: PublicationSnapshot;
  try {
    publication = publicationSnapshot(catalogEnvelope(parsed.data.producer, catalog.data));
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "STACK_SEMANTIC_SOURCE_RULES_V1_PUBLICATION_INCOMPATIBLE",
        errorMessage(error),
        "catalogEnvelope",
      )],
    };
  }
  const immutableEnvelope = deepFreezeJson(publication.envelope);
  const immutableCatalog = immutableEnvelope.payload as StackSemanticSourceRulesCatalogV1;
  const result: Extract<
    StackSemanticSourceRulesCatalogCompilationResultV1,
    { status: "compiled" }
  > = Object.freeze({
    status: "compiled",
    diagnostics: EMPTY_DIAGNOSTICS,
    catalog: immutableCatalog,
    catalogPayloadHash: immutableCatalog.catalogPayloadHash,
    catalogArtifactHash: publication.hash,
    catalogArtifactByteLength: publication.byteLength,
    envelope: immutableEnvelope,
  });
  return result;
}

export function verifyStackSemanticSourceRulesCatalogV1(
  input: unknown,
): StackSemanticSourceRulesCatalogVerificationResultV1 {
  let snapshot: unknown;
  try {
    snapshot = boundedJsonSnapshot(input, CATALOG_VERIFICATION_INPUT_MAX_BYTES);
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "STACK_SEMANTIC_SOURCE_RULES_V1_VERIFICATION_INPUT_INVALID",
        errorMessage(error),
        "catalogVerificationInput",
      )],
    };
  }
  const outer = CatalogVerificationOuterV1Schema.safeParse(snapshot);
  if (!outer.success) {
    return {
      status: "rejected",
      diagnostics: diagnosticsFromZod(
        "STACK_SEMANTIC_SOURCE_RULES_V1_VERIFICATION_INPUT_INVALID",
        outer.error,
      ),
    };
  }
  const reproduced = compileStackSemanticSourceRulesCatalogV1(outer.data.compilerInput);
  if (reproduced.status === "rejected") return reproduced;

  let candidate: PublicationSnapshot;
  try {
    candidate = publicationSnapshot(outer.data.candidateEnvelope);
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "STACK_SEMANTIC_SOURCE_RULES_V1_ENVELOPE_INVALID",
        errorMessage(error),
        "candidateEnvelope",
      )],
    };
  }
  const reproducedPublication = publicationSnapshot(reproduced.envelope);
  if (!candidate.bytes.equals(reproducedPublication.bytes)) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "STACK_SEMANTIC_SOURCE_RULES_V1_AUTHORITY_MISMATCH",
        "Semantic source catalog does not equal a fresh reproduction from code-owned release authority",
        "candidateEnvelope",
      )],
    };
  }
  const result: Extract<
    StackSemanticSourceRulesCatalogVerificationResultV1,
    { status: "verified" }
  > = Object.freeze({
    status: "verified",
    diagnostics: EMPTY_DIAGNOSTICS,
    catalog: reproduced.catalog,
    catalogPayloadHash: reproduced.catalogPayloadHash,
    catalogArtifactHash: reproduced.catalogArtifactHash,
    catalogArtifactByteLength: reproduced.catalogArtifactByteLength,
    envelope: reproduced.envelope,
  });
  return result;
}

export type { StackSemanticSourceRulesCatalogCompilerInputV1 };
