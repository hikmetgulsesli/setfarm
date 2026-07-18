import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import {
  PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION,
} from "../product-delivery-profile-catalog-v2.js";
import {
  ActionIdSchema,
  CapabilityIdSchema,
  CommandIdSchema,
  EntityFieldIdSchema,
  EntityIdSchema,
  EvidenceIdSchema,
  ObservableIdSchema,
  PersistenceIdSchema,
  ProductIdSchema,
  RouteIdSchema,
  Sha256Schema,
  StableReferenceSchema,
  StateIdSchema,
  StoryIdSchema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import { ControlSlotIdSchema } from "./common-v2.js";
import {
  STACK_SEMANTIC_SOURCE_RULES_CATALOG_VERSION_V1,
  SemanticSourceAccessPolicyV1Schema,
  SemanticSourceCardinalityV1Schema,
  SemanticSourceLocatorContractV1Schema,
  SemanticSourceOutputPolicyV1Schema,
  SemanticSourceOwnerPolicyV1Schema,
  SemanticSourcePathResolutionV1Schema,
  SemanticSourceResponsibilityV1Schema,
  SemanticSourceRuleSetReadinessV1Schema,
  SemanticSourceSubjectContractResolutionV1Schema,
  SemanticSourceSubjectKindV1Schema,
} from "./stack-semantic-source-rules-v1.js";

export const SEMANTIC_SOURCE_INTENT_SET_SCHEMA_V1 =
  "setfarm.semantic-source-intent-set.v1" as const;
export const SEMANTIC_SOURCE_INTENT_SCHEMA_V1 =
  "setfarm.semantic-source-intent.v1" as const;

export const SEMANTIC_SOURCE_INTENT_BLOCKER_CODES_V1 = Object.freeze([
  "SEMANTIC_SOURCE_INTENT_DECLARATIONS_UNAVAILABLE",
  "SEMANTIC_SOURCE_INTENT_PATH_IDENTITY_V2_UNVERIFIED",
  "SEMANTIC_SOURCE_INTENT_PREDICATE_RELATIONS_UNRESOLVED",
  "SEMANTIC_SOURCE_INTENT_RELEASE_ACTIVATION_UNVERIFIED",
] as const);

const SemanticSourceIntentBlockerCodeV1Schema = z.enum(
  SEMANTIC_SOURCE_INTENT_BLOCKER_CODES_V1,
);

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalStrings(values: readonly string[]): boolean {
  return hasUniqueStrings(values)
    && values.every((value, index) =>
      index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

function canonicalReferenceArray<T extends z.ZodTypeAny>(
  schema: T,
  max: number,
  label: string,
) {
  return z.array(schema).max(max).superRefine((value, context) => {
    if (canonicalStrings(value as string[])) return;
    context.addIssue({
      code: "custom",
      message: `${label} must be unique and canonically sorted`,
    });
  });
}

function derivedStableRef(prefix: string, domain: string, identity: unknown): string {
  return `${prefix}_${hashCanonicalJson({ schema: domain, identity }).toUpperCase()}`;
}

export function deriveSemanticStoryScopeRefV1(
  productRef: string,
  componentHash: string,
): string {
  return derivedStableRef(
    "SCOPE_STORY",
    "setfarm.semantic-source-story-scope-ref.v1",
    { productRef, componentHash },
  );
}

export function deriveSemanticProductScopeRefV1(productRef: string): string {
  return derivedStableRef(
    "SCOPE_PRODUCT",
    "setfarm.semantic-source-product-scope-ref.v1",
    { productRef },
  );
}

export function deriveSemanticSetupScopeRefV1(stackPackId: string): string {
  return derivedStableRef(
    "SCOPE_SETUP",
    "setfarm.semantic-source-setup-scope-ref.v1",
    { stackPackId },
  );
}

export function deriveSemanticPlatformScopeRefV1(platformAuthorityRef: string): string {
  return derivedStableRef(
    "SCOPE_PLATFORM",
    "setfarm.semantic-source-platform-scope-ref.v1",
    { platformAuthorityRef },
  );
}

export function deriveSemanticActionInputSubjectRefV1(
  actionRef: string,
  fieldName: string,
): string {
  return derivedStableRef(
    "ACTION_INPUT",
    "setfarm.semantic-action-input-subject-ref.v1",
    { actionRef, fieldName },
  );
}

const StackPackIdSchema = z.string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

export const SemanticSourceScopeV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("story"),
    productRef: ProductIdSchema,
    storyId: StoryIdSchema,
    componentHash: Sha256Schema,
    scopeRef: StableReferenceSchema,
  }).strict().superRefine((value, context) => {
    if (
      value.scopeRef
      === deriveSemanticStoryScopeRefV1(value.productRef, value.componentHash)
    ) return;
    context.addIssue({
      code: "custom",
      path: ["scopeRef"],
      message: "Story scope ref must derive from the product-namespaced semantic component hash",
    });
  }),
  z.object({
    kind: z.literal("product"),
    productRef: ProductIdSchema,
    productSpecHash: Sha256Schema,
    scopeRef: StableReferenceSchema,
  }).strict().superRefine((value, context) => {
    if (value.scopeRef === deriveSemanticProductScopeRefV1(value.productRef)) return;
    context.addIssue({
      code: "custom",
      path: ["scopeRef"],
      message: "Product scope ref must derive from the stable product ref",
    });
  }),
  z.object({
    kind: z.literal("setup"),
    stackPackId: StackPackIdSchema,
    scopeRef: StableReferenceSchema,
  }).strict().superRefine((value, context) => {
    if (value.scopeRef === deriveSemanticSetupScopeRefV1(value.stackPackId)) return;
    context.addIssue({
      code: "custom",
      path: ["scopeRef"],
      message: "Setup scope ref must derive from the exact stack-pack ID",
    });
  }),
  z.object({
    kind: z.literal("platform"),
    platformAuthorityRef: z.enum([
      "PLATFORM_BUILD_COMMAND_V1",
      "PLATFORM_RUNTIME_REGISTRATION_V1",
    ]),
    scopeRef: StableReferenceSchema,
  }).strict().superRefine((value, context) => {
    if (
      value.scopeRef
      === deriveSemanticPlatformScopeRefV1(value.platformAuthorityRef)
    ) return;
    context.addIssue({
      code: "custom",
      path: ["scopeRef"],
      message: "Platform scope ref must derive from the exact platform authority",
    });
  }),
]);

export type SemanticSourceScopeV1 = z.infer<typeof SemanticSourceScopeV1Schema>;

const SubjectContractHashShape = { contractHash: Sha256Schema };

export const SemanticSourceSubjectOriginV1Schema = z.discriminatedUnion(
  "originKind",
  [
    z.object({
      originKind: z.literal("entrypoint"),
      productRef: ProductIdSchema,
      entrypointKind: z.enum(["web", "cli", "api", "worker", "native", "game"]),
      deliverySelectionHash: Sha256Schema,
    }).strict(),
    z.object({
      originKind: z.literal("command"),
      commandRef: CommandIdSchema,
      commandKind: z.enum([
        "install", "build", "test", "dev", "preview", "lint", "evidence", "migrate",
      ]),
      commandContractHash: Sha256Schema,
    }).strict(),
    z.object({
      originKind: z.literal("route"),
      routeRef: RouteIdSchema,
      ...SubjectContractHashShape,
    }).strict(),
    z.object({
      originKind: z.literal("surface"),
      surfaceRef: SurfaceIdSchema,
      ...SubjectContractHashShape,
    }).strict(),
    z.object({
      originKind: z.literal("control_slot"),
      controlSlotRef: ControlSlotIdSchema,
      actionRef: ActionIdSchema,
      ...SubjectContractHashShape,
    }).strict(),
    z.object({
      originKind: z.literal("physical_control"),
      physicalControlRef: StableReferenceSchema,
      controlSlotRef: ControlSlotIdSchema,
      actionRef: ActionIdSchema,
      ...SubjectContractHashShape,
    }).strict(),
    z.object({
      originKind: z.literal("action"),
      actionRef: ActionIdSchema,
      actionTriggerKind: z.enum(["user", "system", "timer", "route"]),
      ...SubjectContractHashShape,
    }).strict(),
    z.object({
      originKind: z.literal("action_input"),
      actionRef: ActionIdSchema,
      rawActionInputRef: z.string().min(3).max(500),
      fieldName: z.string().min(1).max(160),
      transportContractHash: Sha256Schema,
      transportFieldHash: Sha256Schema,
    }).strict(),
    z.object({
      originKind: z.literal("state"),
      stateRef: StateIdSchema,
      ...SubjectContractHashShape,
    }).strict(),
    z.object({
      originKind: z.literal("persistence_policy"),
      persistenceRef: PersistenceIdSchema,
      persistenceKind: z.enum([
        "none", "memory", "local_storage", "database", "file", "remote_api",
      ]),
      persistenceDurability: z.enum(["none", "session", "reload", "restart", "durable"]),
      ...SubjectContractHashShape,
    }).strict(),
    z.object({
      originKind: z.literal("persistence_absence"),
      persistenceRef: PersistenceIdSchema,
      productRef: ProductIdSchema,
      componentHash: Sha256Schema,
      persistenceKind: z.literal("none"),
      persistenceDurability: z.literal("none"),
      policySetHash: Sha256Schema,
    }).strict(),
    z.object({
      originKind: z.literal("entity"),
      entityRef: EntityIdSchema,
      entityContractHash: Sha256Schema,
      fieldRefs: canonicalReferenceArray(EntityFieldIdSchema, 500, "Entity field refs"),
      fieldContractHash: Sha256Schema,
    }).strict(),
    z.object({
      originKind: z.literal("observable"),
      observableRef: ObservableIdSchema,
      actionRef: ActionIdSchema,
      ...SubjectContractHashShape,
    }).strict(),
    z.object({
      originKind: z.literal("evidence_predicate"),
      evidenceRef: EvidenceIdSchema,
      predicateSubjectRef: StableReferenceSchema,
      required: z.boolean(),
      actionReferenceRefs: canonicalReferenceArray(
        ActionIdSchema,
        2_000,
        "Evidence action-reference refs",
      ),
      ...SubjectContractHashShape,
    }).strict(),
    z.object({
      originKind: z.literal("runtime_data_contract"),
      runtimeDataRef: StableReferenceSchema,
      productRef: ProductIdSchema,
      componentHash: Sha256Schema,
      runtimeDataContractHash: Sha256Schema,
    }).strict(),
  ],
);

export type SemanticSourceSubjectOriginV1 = z.infer<
  typeof SemanticSourceSubjectOriginV1Schema
>;

const SUBJECT_KIND_BY_ORIGIN_KIND = Object.freeze({
  entrypoint: "entrypoint",
  command: "command",
  route: "route",
  surface: "surface",
  control_slot: "control_slot",
  physical_control: "physical_control",
  action: "action",
  action_input: "action_input",
  state: "state",
  persistence_policy: "persistence_policy",
  persistence_absence: "persistence_policy",
  entity: "entity",
  observable: "observable",
  evidence_predicate: "evidence_predicate",
  runtime_data_contract: "runtime_data_contract",
} as const);

export function hashSemanticSourceSubjectOriginV1(
  origin: SemanticSourceSubjectOriginV1,
): string {
  return hashCanonicalJson({
    schema: "setfarm.semantic-source-subject-hash.v1",
    origin,
  });
}

const ActivationFactV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("design_source_kind"), value: z.enum(["none", "stitch"]) }).strict(),
  z.object({ kind: z.literal("action_trigger_kind"), value: z.enum(["user", "system", "timer", "route"]) }).strict(),
  z.object({ kind: z.literal("persistence_kind"), value: z.enum(["none", "memory", "local_storage", "database", "file", "remote_api"]) }).strict(),
  z.object({ kind: z.literal("persistence_durability"), value: z.enum(["none", "session", "reload", "restart", "durable"]) }).strict(),
  z.object({ kind: z.literal("entrypoint_kind"), value: z.enum(["web", "cli", "api", "worker", "native", "game"]) }).strict(),
  z.object({ kind: z.literal("command_kind"), value: z.enum(["install", "build", "test", "dev", "preview", "lint", "evidence", "migrate"]) }).strict(),
]);

export const SemanticSourceActivationWitnessV1Schema = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("always") }).strict(),
    z.object({
      kind: z.literal("all"),
      facts: z.array(ActivationFactV1Schema).min(1).max(8),
    }).strict(),
  ],
);

const ResolvedSubjectContractV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({
    kind: z.literal("invocation_input_transport_v2"),
    resolutionState: z.literal("fresh_compiled_shadow"),
    artifactType: z.literal("setfarm.invocation-input-transport.v2"),
    actionRef: ActionIdSchema,
    rawActionInputRef: z.string().min(3).max(500),
    contractHash: Sha256Schema,
    transportFieldHash: Sha256Schema,
    transportKind: z.enum(["cli_command", "http_request"]),
    resolutionContractRef: z.enum([
      "ACTION_INPUT_CLI_INVOCATION_V2",
      "ACTION_INPUT_HTTP_INVOCATION_V2",
    ]),
  }).strict(),
]);

const SemanticSourceTargetV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("source_slot"),
    targetKind: z.enum(["project_source", "generated_source"]),
    ownerPolicy: SemanticSourceOwnerPolicyV1Schema,
    pathResolution: SemanticSourcePathResolutionV1Schema,
    locatorContract: SemanticSourceLocatorContractV1Schema,
    accessPolicy: SemanticSourceAccessPolicyV1Schema,
    outputPolicy: SemanticSourceOutputPolicyV1Schema,
    subjectContractResolution: SemanticSourceSubjectContractResolutionV1Schema,
    resolvedSubjectContract: ResolvedSubjectContractV1Schema,
  }).strict(),
  z.object({
    kind: z.literal("platform_contract"),
    targetKind: z.literal("platform_contract"),
    platformAuthorityRef: z.enum([
      "PLATFORM_BUILD_COMMAND_V1",
      "PLATFORM_RUNTIME_REGISTRATION_V1",
    ]),
    platformContractProjectionHash: Sha256Schema,
    capabilityRefs: canonicalReferenceArray(
      CapabilityIdSchema,
      64,
      "Platform capability refs",
    ),
  }).strict(),
  z.object({
    kind: z.literal("typed_exemption"),
    targetKind: z.literal("typed_exemption"),
    exemptionCode: z.enum([
      "PERSISTENCE_NONE_NO_SOURCE_REQUIRED",
      "PERSISTENCE_MEMORY_USES_STATE_STORE",
    ]),
    backingResponsibility: z.literal("state_store").nullable(),
    backingResolution: z.discriminatedUnion("state", [
      z.object({ state: z.literal("not_applicable") }).strict(),
      z.object({
        state: z.literal("unresolved_shadow"),
        requiredResponsibility: z.literal("state_store"),
      }).strict(),
    ]),
  }).strict(),
  z.object({
    kind: z.literal("predicate_requirement"),
    targetKind: z.literal("predicate_relation"),
    resolutionState: z.literal("unresolved_shadow"),
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
  }).strict(),
]);

const SemanticSourceIntentCandidateV1Schema = z.object({
  schema: z.literal(SEMANTIC_SOURCE_INTENT_SCHEMA_V1),
  intentRef: StableReferenceSchema,
  semanticScope: SemanticSourceScopeV1Schema,
  subjectKind: SemanticSourceSubjectKindV1Schema,
  subjectRef: StableReferenceSchema,
  subjectHash: Sha256Schema,
  subjectOrigin: SemanticSourceSubjectOriginV1Schema,
  responsibility: SemanticSourceResponsibilityV1Schema,
  ruleSetHash: Sha256Schema,
  ruleRef: StableReferenceSchema,
  ruleHash: Sha256Schema,
  activationWitness: SemanticSourceActivationWitnessV1Schema,
  cardinality: SemanticSourceCardinalityV1Schema,
  target: SemanticSourceTargetV1Schema,
  intentHash: Sha256Schema,
}).strict();

export type SemanticSourceIntentV1 = z.infer<
  typeof SemanticSourceIntentCandidateV1Schema
>;

export function deriveSemanticSourceIntentRefV1(
  value: Pick<
    SemanticSourceIntentV1,
    | "semanticScope"
    | "subjectKind"
    | "subjectRef"
    | "responsibility"
    | "ruleSetHash"
    | "ruleRef"
  >,
): string {
  return derivedStableRef(
    "INTENT",
    "setfarm.semantic-source-intent-ref.v1",
    {
      ruleSetHash: value.ruleSetHash,
      scopeRef: value.semanticScope.scopeRef,
      subjectKind: value.subjectKind,
      subjectRef: value.subjectRef,
      responsibility: value.responsibility,
      ruleRef: value.ruleRef,
    },
  );
}

export function hashSemanticSourceIntentV1(
  value: Omit<SemanticSourceIntentV1, "intentHash"> | SemanticSourceIntentV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.intentHash;
  return hashCanonicalJson({
    schema: "setfarm.semantic-source-intent-hash.v1",
    intent: payload,
  });
}

export const SemanticSourceIntentV1Schema =
  SemanticSourceIntentCandidateV1Schema.superRefine((value, context) => {
    const expectedSubjectKind = SUBJECT_KIND_BY_ORIGIN_KIND[
      value.subjectOrigin.originKind
    ];
    if (value.subjectKind !== expectedSubjectKind) {
      context.addIssue({
        code: "custom",
        path: ["subjectKind"],
        message: "Subject kind must equal the exact typed subject origin",
      });
    }
    if (value.subjectHash !== hashSemanticSourceSubjectOriginV1(value.subjectOrigin)) {
      context.addIssue({
        code: "custom",
        path: ["subjectHash"],
        message: "Subject hash must bind the exact typed subject origin",
      });
    }
    if (value.intentRef !== deriveSemanticSourceIntentRefV1(value)) {
      context.addIssue({
        code: "custom",
        path: ["intentRef"],
        message: "Intent ref must bind the stable obligation tuple",
      });
    }
    if (value.intentHash !== hashSemanticSourceIntentV1(value)) {
      context.addIssue({
        code: "custom",
        path: ["intentHash"],
        message: "Intent hash must bind the complete canonical intent",
      });
    }
    if (value.target.kind !== "source_slot") return;
    const resolution = value.target.subjectContractResolution;
    const binding = value.target.resolvedSubjectContract;
    if (resolution.kind === "none" && binding.kind !== "none") {
      context.addIssue({
        code: "custom",
        path: ["target", "resolvedSubjectContract"],
        message: "A rule with no subject-contract resolution cannot carry a binding",
      });
      return;
    }
    if (resolution.kind === "none") return;
    if (
      resolution.kind === "dom_action_input_transport"
      || binding.kind !== "invocation_input_transport_v2"
    ) {
      context.addIssue({
        code: "custom",
        path: ["target", "resolvedSubjectContract"],
        message: "The first intent slice resolves only fresh CLI/HTTP invocation transports",
      });
      return;
    }
    const expectedRef = resolution.kind === "cli_invocation_input_transport"
      ? "ACTION_INPUT_CLI_INVOCATION_V2"
      : "ACTION_INPUT_HTTP_INVOCATION_V2";
    const expectedKind = resolution.kind === "cli_invocation_input_transport"
      ? "cli_command"
      : "http_request";
    if (
      binding.resolutionContractRef !== expectedRef
      || binding.transportKind !== expectedKind
    ) {
      context.addIssue({
        code: "custom",
        path: ["target", "resolvedSubjectContract"],
        message: "Resolved transport must match the exact rule-owned resolution contract",
      });
    }
    if (value.subjectOrigin.originKind !== "action_input") {
      context.addIssue({
        code: "custom",
        path: ["subjectOrigin"],
        message: "Invocation transport resolution requires an action-input subject origin",
      });
      return;
    }
    const origin = value.subjectOrigin;
    if (
      value.subjectRef
        !== deriveSemanticActionInputSubjectRefV1(origin.actionRef, origin.fieldName)
      || binding.actionRef !== origin.actionRef
      || binding.rawActionInputRef !== origin.rawActionInputRef
      || binding.contractHash !== origin.transportContractHash
      || binding.transportFieldHash !== origin.transportFieldHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["target", "resolvedSubjectContract"],
        message: "Resolved transport must bind the exact action-input subject membership",
      });
    }
  });

export const SemanticStoryPartitionBindingV2Schema = z.object({
  storyId: StoryIdSchema,
  order: z.number().int().positive().max(5_000),
  componentHash: Sha256Schema,
  routeRefs: canonicalReferenceArray(RouteIdSchema, 500, "Story route refs"),
  surfaceRefs: canonicalReferenceArray(SurfaceIdSchema, 500, "Story surface refs"),
  controlSlotRefs: canonicalReferenceArray(ControlSlotIdSchema, 1_000, "Story control-slot refs"),
  controlRefs: canonicalReferenceArray(StableReferenceSchema, 1_000, "Story physical-control refs"),
  actionRefs: canonicalReferenceArray(ActionIdSchema, 2_000, "Story action refs"),
  observableRefs: canonicalReferenceArray(ObservableIdSchema, 2_000, "Story observable refs"),
  stateRefs: canonicalReferenceArray(StateIdSchema, 500, "Story state refs"),
  persistenceRefs: canonicalReferenceArray(PersistenceIdSchema, 500, "Story persistence refs"),
  evidenceRefs: canonicalReferenceArray(EvidenceIdSchema, 4_000, "Story evidence refs"),
}).strict();

export type SemanticStoryPartitionBindingV2 = z.infer<
  typeof SemanticStoryPartitionBindingV2Schema
>;

export function hashSemanticStoryPartitionV2(
  stories: readonly SemanticStoryPartitionBindingV2[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.semantic-story-partition-hash.v2",
    stories,
  });
}

export const InvocationTransportIntentBindingV2Schema = z.object({
  actionRef: ActionIdSchema,
  transportKind: z.enum(["cli_command", "http_request"]),
  actionInvocationIntentHash: Sha256Schema,
  contractHash: Sha256Schema,
}).strict();

export type InvocationTransportIntentBindingV2 = z.infer<
  typeof InvocationTransportIntentBindingV2Schema
>;

export function hashInvocationTransportIntentBindingsV2(
  bindings: readonly InvocationTransportIntentBindingV2[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.invocation-input-transport-set-hash.v2",
    contracts: bindings.map((binding) => ({
      actionRef: binding.actionRef,
      contractHash: binding.contractHash,
    })),
  });
}

const DeliverySelectionBindingV2Schema = z.object({
  selectionHash: Sha256Schema,
  productSpecHash: Sha256Schema,
  catalogVersion: z.literal(PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION),
  catalogHash: Sha256Schema,
  profileId: z.enum([
    "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
  ]),
  profileHash: Sha256Schema,
  requestedStackPackId: z.enum(["node-cli", "node-express-api"]),
}).strict();

const StackPackBindingV2Schema = z.object({
  stackPackId: z.enum(["node-cli", "node-express-api"]),
  stackPackVersion: z.string().min(1).max(160),
  stackPackContentHash: Sha256Schema,
}).strict();

const SemanticRuleSetBindingV1Schema = z.object({
  catalogVersion: z.literal(STACK_SEMANTIC_SOURCE_RULES_CATALOG_VERSION_V1),
  ruleSetRef: StableReferenceSchema,
  ruleSetVersion: z.string().min(1).max(100),
  ruleSetHash: Sha256Schema,
  readiness: SemanticSourceRuleSetReadinessV1Schema,
}).strict();

const IntentSetAuthorityV1Schema = z.object({
  productRef: ProductIdSchema,
  productSpecHash: Sha256Schema,
  deliverySelection: DeliverySelectionBindingV2Schema,
  stackPackBinding: StackPackBindingV2Schema,
  designSourceClosure: z.object({
    schema: z.literal("setfarm.design-source-closure.v2"),
    kind: z.literal("none"),
    reason: z.literal("product_delivery_design_not_required"),
    closureHash: Sha256Schema,
  }).strict(),
  semanticRuleSet: SemanticRuleSetBindingV1Schema,
  storyPartition: z.object({
    partitionHash: Sha256Schema,
    storyCount: z.number().int().positive().max(5_000),
    stories: z.array(SemanticStoryPartitionBindingV2Schema).min(1).max(5_000),
  }).strict(),
  invocationTransportSet: z.object({
    setHash: Sha256Schema,
    bindings: z.array(InvocationTransportIntentBindingV2Schema).min(1).max(2_000),
  }).strict(),
}).strict();

const SemanticSourceIntentSetCandidateV1Schema = z.object({
  schema: z.literal(SEMANTIC_SOURCE_INTENT_SET_SCHEMA_V1),
  intentSetVersion: z.literal(1),
  authorityState: z.literal("shadow_blocked"),
  productionUse: z.literal("forbidden"),
  blockerCodes: z.array(SemanticSourceIntentBlockerCodeV1Schema)
    .length(SEMANTIC_SOURCE_INTENT_BLOCKER_CODES_V1.length),
  authority: IntentSetAuthorityV1Schema,
  intentCount: z.number().int().positive().max(20_000),
  intents: z.array(SemanticSourceIntentV1Schema).min(1).max(20_000),
  intentSetHash: Sha256Schema,
}).strict();

export type SemanticSourceIntentSetV1 = z.infer<
  typeof SemanticSourceIntentSetCandidateV1Schema
>;

function intentOrderKey(intent: SemanticSourceIntentV1): string {
  return [
    intent.subjectKind,
    intent.subjectRef,
    intent.responsibility,
    intent.ruleRef,
    intent.semanticScope.scopeRef,
  ].join("\0");
}

export function hashSemanticSourceIntentSetV1(
  value:
    | Omit<SemanticSourceIntentSetV1, "intentSetHash">
    | SemanticSourceIntentSetV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.intentSetHash;
  return hashCanonicalJson({
    schema: "setfarm.semantic-source-intent-set-hash.v1",
    intentSet: payload,
  });
}

export const SemanticSourceIntentSetV1Schema =
  SemanticSourceIntentSetCandidateV1Schema.superRefine((value, context) => {
    if (
      canonicalJsonStringify(value.blockerCodes)
      !== canonicalJsonStringify(SEMANTIC_SOURCE_INTENT_BLOCKER_CODES_V1)
    ) {
      context.addIssue({
        code: "custom",
        path: ["blockerCodes"],
        message: "Intent blockers must equal the exact code-owned shadow set",
      });
    }
    if (
      value.authority.productSpecHash
      !== value.authority.deliverySelection.productSpecHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["authority", "deliverySelection", "productSpecHash"],
        message: "Delivery selection must bind the exact ProductSpec hash",
      });
    }
    if (
      value.authority.stackPackBinding.stackPackId
      !== value.authority.deliverySelection.requestedStackPackId
    ) {
      context.addIssue({
        code: "custom",
        path: ["authority", "stackPackBinding", "stackPackId"],
        message: "Stack-pack binding must equal the selected stack",
      });
    }
    const stories = value.authority.storyPartition.stories;
    if (
      value.authority.storyPartition.storyCount !== stories.length
      || stories.some((story, index) => story.order !== index + 1)
      || !hasUniqueStrings(stories.map((story) => story.storyId))
      || value.authority.storyPartition.partitionHash
        !== hashSemanticStoryPartitionV2(stories)
    ) {
      context.addIssue({
        code: "custom",
        path: ["authority", "storyPartition"],
        message: "Story partition must be exact, canonical and content-bound",
      });
    }
    const transports = value.authority.invocationTransportSet.bindings;
    if (
      !canonicalStrings(transports.map((binding) => binding.actionRef))
      || value.authority.invocationTransportSet.setHash
        !== hashInvocationTransportIntentBindingsV2(transports)
    ) {
      context.addIssue({
        code: "custom",
        path: ["authority", "invocationTransportSet"],
        message: "Invocation transport bindings must be canonical and content-bound",
      });
    }
    const intentKeys = value.intents.map(intentOrderKey);
    const obligationKeys = value.intents.map((intent) => [
      intent.subjectKind,
      intent.subjectRef,
      intent.responsibility,
    ].join("\0"));
    if (
      value.intentCount !== value.intents.length
      || !canonicalStrings(intentKeys)
      || !hasUniqueStrings(value.intents.map((intent) => intent.intentRef))
      || !hasUniqueStrings(value.intents.map((intent) => intent.intentHash))
      || !hasUniqueStrings(obligationKeys)
    ) {
      context.addIssue({
        code: "custom",
        path: ["intents"],
        message: "Intent set must be canonical, every-only and identity-unique",
      });
    }
    const storyById = new Map(stories.map((story) => [story.storyId, story] as const));
    value.intents.forEach((intent, index) => {
      if (intent.ruleSetHash !== value.authority.semanticRuleSet.ruleSetHash) {
        context.addIssue({
          code: "custom",
          path: ["intents", index, "ruleSetHash"],
          message: "Intent must bind the exact authority rule set",
        });
      }
      if (intent.semanticScope.kind !== "story") return;
      const story = storyById.get(intent.semanticScope.storyId);
      if (
        intent.semanticScope.productRef !== value.authority.productRef
        || !story
        || story.componentHash !== intent.semanticScope.componentHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["intents", index, "semanticScope"],
          message: "Story-scoped intent must bind an exact semantic component",
        });
      }
    });
    if (value.intentSetHash !== hashSemanticSourceIntentSetV1(value)) {
      context.addIssue({
        code: "custom",
        path: ["intentSetHash"],
        message: "Intent-set hash must bind the complete domain-separated artifact",
      });
    }
  });

export function recursivelyFreezeSemanticSourceIntentV1<T>(value: T): T {
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
