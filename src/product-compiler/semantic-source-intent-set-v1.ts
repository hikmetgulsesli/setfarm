import { Buffer } from "node:buffer";

import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  compileInvocationInputTransportSetV2,
} from "./invocation-input-transport-v2.js";
import { verifyProductRuntimeBehaviorContractV1 } from
  "./product-runtime-behavior-contract-v1.js";
import {
  ProductDeliverySelectionV2Schema,
  ProductDeliverySelectionVerificationErrorV2,
  hashProductDeliverySelectionV2,
  verifyProductDeliverySelectionV2,
  type ProductDeliverySelectionV2,
} from "./product-delivery-profile-catalog-v2.js";
import {
  produceStoryDefinitionsV3,
  type ProductStoryDefinitionV3,
} from "./producers/story-definitions-v3.js";
import {
  DesignSourceClosureV2Schema,
} from "./schemas/design-source-closure-v2.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "./schemas/product-spec-v2.js";
import type { ProductRuntimeBehaviorContractV1 } from
  "./schemas/product-runtime-behavior-contract-v1.js";
import type { InvocationInputTransportV2 } from "./schemas/invocation-input-transport-v2.js";
import {
  SEMANTIC_SOURCE_INTENT_BLOCKER_CODES_V1,
  SEMANTIC_SOURCE_INTENT_SCHEMA_V1,
  SEMANTIC_SOURCE_INTENT_SET_SCHEMA_V1,
  SemanticSourceIntentSetV1Schema,
  SemanticSourceIntentV1Schema,
  deriveSemanticActionInputSubjectRefV1,
  deriveSemanticPlatformScopeRefV1,
  deriveSemanticSetupScopeRefV1,
  deriveSemanticSourceIntentRefV1,
  deriveSemanticStoryScopeRefV1,
  hashInvocationTransportIntentBindingsV2,
  hashSemanticSourceIntentSetV1,
  hashSemanticSourceIntentV1,
  hashSemanticSourceSubjectOriginV1,
  hashSemanticStoryPartitionV3,
  recursivelyFreezeSemanticSourceIntentV1,
  type InvocationTransportIntentBindingV2,
  type SemanticSourceIntentSetV1,
  type SemanticSourceIntentV1,
  type SemanticSourceScopeV1,
  type SemanticSourceSubjectOriginV1,
  type SemanticStoryPartitionBindingV3,
} from "./schemas/semantic-source-intent-set-v1.js";
import {
  type SemanticSourceActivationAtomV1,
  type SemanticSourceActivationV1,
  type SemanticSourceRuleV1,
  type SemanticSourceSubjectKindV1,
} from "./schemas/stack-semantic-source-rules-v1.js";
import {
  getCodeOwnedStackSemanticSourceRuleSetV1,
} from "./stack-semantic-source-rules-catalog-v1.js";
import { getStackTopologyCatalogContract } from "./stack-topology-catalog.js";

const COMPILER_INPUT_MAX_BYTES = 8 * 1024 * 1024;
const VERIFIER_INPUT_MAX_BYTES = 12 * 1024 * 1024;
const OUTPUT_MAX_BYTES = 4 * 1024 * 1024;
const MAX_SUBJECTS = 20_000;
const MAX_RULE_APPLICATIONS = 100_000;
const MAX_DIAGNOSTICS = 100;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const CompilerInputV1Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  designSourceClosure: z.unknown(),
  runtimeBehaviorProposal: z.unknown().optional(),
  runtimeBehaviorContract: z.unknown().optional(),
}).strict().superRefine((value, context) => {
  if (
    (value.runtimeBehaviorProposal === undefined)
      !== (value.runtimeBehaviorContract === undefined)
  ) {
    context.addIssue({
      code: "custom",
      path: ["runtimeBehaviorContract"],
      message: "Behavior proposal and contract must be supplied together",
    });
  }
});

const VerificationInputV1Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  designSourceClosure: z.unknown(),
  runtimeBehaviorProposal: z.unknown().optional(),
  runtimeBehaviorContract: z.unknown().optional(),
  candidate: z.unknown(),
}).strict().superRefine((value, context) => {
  if (
    (value.runtimeBehaviorProposal === undefined)
      !== (value.runtimeBehaviorContract === undefined)
  ) {
    context.addIssue({
      code: "custom",
      path: ["runtimeBehaviorContract"],
      message: "Behavior proposal and contract must be supplied together",
    });
  }
});

export type SemanticSourceIntentCompilationDiagnosticCodeV1 =
  | "SEMANTIC_SOURCE_INTENT_V1_INPUT_INVALID"
  | "SEMANTIC_SOURCE_INTENT_V1_PRODUCT_SPEC_INVALID"
  | "SEMANTIC_SOURCE_INTENT_V1_BEHAVIOR_AUTHORITY_MISMATCH"
  | "SEMANTIC_SOURCE_INTENT_V1_DELIVERY_SELECTION_INVALID"
  | "SEMANTIC_SOURCE_INTENT_V1_DELIVERY_SELECTION_AUTHORITY_MISMATCH"
  | "SEMANTIC_SOURCE_INTENT_V1_DESIGN_SOURCE_CLOSURE_INVALID"
  | "SEMANTIC_SOURCE_INTENT_V1_DESIGN_SOURCE_AUTHORITY_MISMATCH"
  | "SEMANTIC_SOURCE_INTENT_V1_RULE_SET_UNAVAILABLE"
  | "SEMANTIC_SOURCE_INTENT_V1_RULE_SET_AUTHORITY_MISMATCH"
  | "SEMANTIC_SOURCE_INTENT_V1_STORY_PARTITION_REJECTED"
  | "SEMANTIC_SOURCE_INTENT_V1_SUBJECT_OWNERSHIP_UNRESOLVED"
  | "SEMANTIC_SOURCE_INTENT_V1_SUBJECT_OWNERSHIP_AMBIGUOUS"
  | "SEMANTIC_SOURCE_INTENT_V1_SUBJECT_PROJECTION_UNSUPPORTED"
  | "SEMANTIC_SOURCE_INTENT_V1_INVOCATION_TRANSPORT_REJECTED"
  | "SEMANTIC_SOURCE_INTENT_V1_ACTIVATION_FACT_UNRESOLVED"
  | "SEMANTIC_SOURCE_INTENT_V1_CARDINALITY_VIOLATION"
  | "SEMANTIC_SOURCE_INTENT_V1_OUTPUT_LIMIT_EXCEEDED"
  | "SEMANTIC_SOURCE_INTENT_V1_CONTRACT_INVALID";

export type SemanticSourceIntentCompilationDiagnosticV1 = Readonly<{
  code: SemanticSourceIntentCompilationDiagnosticCodeV1;
  path: string;
  message: string;
}>;

export type SemanticSourceIntentCompilationResultV1 =
  | Readonly<{
      status: "shadow_compiled";
      diagnostics: readonly [];
      intentSet: Readonly<SemanticSourceIntentSetV1>;
      intentSetHash: string;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly SemanticSourceIntentCompilationDiagnosticV1[];
    }>;

type ActivationFactValue =
  | "none"
  | "stitch"
  | "user"
  | "system"
  | "timer"
  | "route"
  | "memory"
  | "local_storage"
  | "database"
  | "file"
  | "remote_api"
  | "session"
  | "reload"
  | "restart"
  | "durable"
  | "web"
  | "cli"
  | "api"
  | "worker"
  | "native"
  | "game"
  | "install"
  | "build"
  | "test"
  | "dev"
  | "preview"
  | "lint"
  | "evidence"
  | "migrate";

type SubjectAuthorityV1 = Readonly<{
  subjectKind: SemanticSourceSubjectKindV1;
  subjectRef: string;
  semanticScope: SemanticSourceScopeV1;
  subjectOrigin: SemanticSourceSubjectOriginV1;
  facts: Readonly<Partial<Record<SemanticSourceActivationAtomV1["kind"], ActivationFactValue>>>;
}>;

type SourceSlotTargetV1 = Extract<
  SemanticSourceIntentV1["target"],
  { kind: "source_slot" }
>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function boundedSnapshot(value: unknown, maxBytes: number): unknown {
  const bytes = canonicalJsonBytesBounded(value, {
    maxBytes,
    ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  });
  return JSON.parse(bytes.toString("utf8"));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid bounded canonical JSON input";
}

function diagnostic(
  code: SemanticSourceIntentCompilationDiagnosticCodeV1,
  path: string,
  message: string,
): SemanticSourceIntentCompilationDiagnosticV1 {
  return Object.freeze({
    code,
    path: path.slice(0, 500),
    message: message.slice(0, 1_000),
  });
}

function rejected(
  diagnostics: readonly SemanticSourceIntentCompilationDiagnosticV1[],
): SemanticSourceIntentCompilationResultV1 {
  const sorted = [...diagnostics].sort((left, right) =>
    compareUtf16(left.code, right.code)
    || compareUtf16(left.path, right.path)
    || compareUtf16(left.message, right.message));
  const retained = sorted.length <= MAX_DIAGNOSTICS
    ? sorted
    : [
        ...sorted.slice(0, MAX_DIAGNOSTICS - 1),
        diagnostic(
          "SEMANTIC_SOURCE_INTENT_V1_CONTRACT_INVALID",
          "/diagnostics",
          `Validation produced ${sorted.length} diagnostics; retained the first ${MAX_DIAGNOSTICS - 1}`,
        ),
      ].sort((left, right) =>
        compareUtf16(left.code, right.code)
        || compareUtf16(left.path, right.path)
        || compareUtf16(left.message, right.message));
  return recursivelyFreezeSemanticSourceIntentV1({
    status: "rejected" as const,
    diagnostics: retained,
  });
}

function singleRejected(
  code: SemanticSourceIntentCompilationDiagnosticCodeV1,
  path: string,
  message: string,
): SemanticSourceIntentCompilationResultV1 {
  return rejected([diagnostic(code, path, message)]);
}

function diagnosticsFromZod(
  code: SemanticSourceIntentCompilationDiagnosticCodeV1,
  error: z.ZodError,
  pathPrefix = "",
): readonly SemanticSourceIntentCompilationDiagnosticV1[] {
  return error.issues.map((issue) => diagnostic(
    code,
    `${pathPrefix}/${issue.path.map(String).join("/")}`.replace(/\/$/u, "") || "/",
    issue.message,
  ));
}

function derivedSubjectRef(prefix: string, domain: string, identity: unknown): string {
  return `${prefix}_${hashCanonicalJson({ schema: domain, identity }).toUpperCase()}`;
}

function storyBinding(story: ProductStoryDefinitionV3): SemanticStoryPartitionBindingV3 {
  return {
    storyId: story.id,
    order: story.order,
    componentHash: story.componentHash,
    routeRefs: [...story.routeRefs],
    surfaceRefs: [...story.surfaceRefs],
    controlSlotRefs: [...story.controlSlotRefs],
    controlRefs: [...story.controlRefs],
    actionRefs: [...story.actionRefs],
    observableRefs: [...story.observableRefs],
    stateRefs: [...story.stateRefs],
    persistenceRefs: [...story.persistenceRefs],
    evidenceRefs: [...story.evidenceRefs],
    entityRefs: [...story.entityRefs],
  };
}

function storyScope(
  story: SemanticStoryPartitionBindingV3,
  productRef: string,
): SemanticSourceScopeV1 {
  return {
    kind: "story",
    productRef,
    storyId: story.storyId,
    componentHash: story.componentHash,
    scopeRef: deriveSemanticStoryScopeRefV1(productRef, story.componentHash),
  };
}

function canonicalActionEvidenceRefs(
  action: ProductSpecV2["actions"][number],
): readonly string[] {
  return [...new Set([
    ...action.evidenceRefs,
    ...action.success.evidenceRefs,
    ...action.failure.evidenceRefs,
    ...action.observableEffects.map((observable) => observable.evidenceRef),
  ])].sort(compareUtf16);
}

function subjectContractHash(kind: string, value: unknown): string {
  return hashCanonicalJson({
    schema: `setfarm.semantic-source-${kind}-contract-hash.v1`,
    value,
  });
}

function exactStoryOwnerMap(
  stories: readonly SemanticStoryPartitionBindingV3[],
  field:
    | "routeRefs"
    | "surfaceRefs"
    | "controlSlotRefs"
    | "controlRefs"
    | "actionRefs"
    | "observableRefs"
    | "stateRefs"
    | "persistenceRefs"
    | "evidenceRefs"
    | "entityRefs",
): Map<string, SemanticStoryPartitionBindingV3> | null {
  const result = new Map<string, SemanticStoryPartitionBindingV3>();
  for (const story of stories) {
    for (const reference of story[field]) {
      if (result.has(reference)) return null;
      result.set(reference, story);
    }
  }
  return result;
}

function runtimeDataContractHash(
  productSpec: ProductSpecV2,
  story: SemanticStoryPartitionBindingV3,
  authorities: Readonly<{
    actionById: ReadonlyMap<string, ProductSpecV2["actions"][number]>;
    stateById: ReadonlyMap<string, ProductSpecV2["states"][number]>;
    persistenceById: ReadonlyMap<string, ProductSpecV2["persistencePolicies"][number]>;
    evidenceById: ReadonlyMap<string, ProductSpecV2["evidencePredicates"][number]>;
    entityById: ReadonlyMap<string, ProductSpecV2["entities"][number]>;
  }>,
): string {
  return hashCanonicalJson({
    schema: "setfarm.semantic-runtime-data-contract-hash.v1",
    productRef: productSpec.product.id,
    componentHash: story.componentHash,
    states: story.stateRefs.map((reference) => authorities.stateById.get(reference)),
    persistencePolicies: story.persistenceRefs.map((reference) =>
      authorities.persistenceById.get(reference)),
    actions: story.actionRefs.map((reference) => authorities.actionById.get(reference)!).map((action) => ({
      actionRef: action.id,
      input: action.input,
      evidenceScenario: action.evidenceScenario,
      stateDeltas: action.stateDeltas,
      persistenceEffects: action.persistenceEffects,
    })),
    evidencePredicates: story.evidenceRefs.map((reference) =>
      authorities.evidenceById.get(reference)),
    entities: story.entityRefs.map((reference) =>
      authorities.entityById.get(reference)),
  });
}

function deriveSubjects(input: Readonly<{
  productSpec: ProductSpecV2;
  selection: ProductDeliverySelectionV2;
  stories: readonly SemanticStoryPartitionBindingV3[];
  transportContracts: readonly InvocationInputTransportV2[];
}>):
  | Readonly<{ status: "derived"; subjects: readonly SubjectAuthorityV1[] }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly SemanticSourceIntentCompilationDiagnosticV1[];
    }> {
  const { productSpec, selection, stories } = input;
  const routeOwner = exactStoryOwnerMap(stories, "routeRefs");
  const surfaceOwner = exactStoryOwnerMap(stories, "surfaceRefs");
  const controlSlotOwner = exactStoryOwnerMap(stories, "controlSlotRefs");
  const actionOwner = exactStoryOwnerMap(stories, "actionRefs");
  const observableOwner = exactStoryOwnerMap(stories, "observableRefs");
  const stateOwner = exactStoryOwnerMap(stories, "stateRefs");
  const persistenceOwner = exactStoryOwnerMap(stories, "persistenceRefs");
  const evidenceOwner = exactStoryOwnerMap(stories, "evidenceRefs");
  const entityOwner = exactStoryOwnerMap(stories, "entityRefs");
  if (
    !routeOwner || !surfaceOwner || !controlSlotOwner || !actionOwner
    || !observableOwner || !stateOwner || !persistenceOwner || !evidenceOwner
    || !entityOwner
  ) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "SEMANTIC_SOURCE_INTENT_V1_SUBJECT_OWNERSHIP_AMBIGUOUS",
        "/stories",
        "One semantic subject appears in more than one story partition",
      )],
    };
  }

  const diagnostics: SemanticSourceIntentCompilationDiagnosticV1[] = [];
  const subjects: SubjectAuthorityV1[] = [];
  const globalFacts = {
    design_source_kind: "none" as const,
    entrypoint_kind: selection.delivery.platform,
  };
  const addStorySubject = (inputSubject: Omit<SubjectAuthorityV1, "semanticScope"> & {
    story: SemanticStoryPartitionBindingV3 | undefined;
    path: string;
  }): void => {
    if (!inputSubject.story) {
      diagnostics.push(diagnostic(
        "SEMANTIC_SOURCE_INTENT_V1_SUBJECT_OWNERSHIP_UNRESOLVED",
        inputSubject.path,
        `No exact story owns ${inputSubject.subjectKind} ${inputSubject.subjectRef}`,
      ));
      return;
    }
    const { story, path: _path, ...subject } = inputSubject;
    subjects.push({
      ...subject,
      semanticScope: storyScope(story, productSpec.product.id),
    });
  };

  const entrypointKind = selection.delivery.platform;
  const entrypointRef = derivedSubjectRef(
    "ENTRY",
    "setfarm.semantic-entrypoint-subject-ref.v1",
    {
      productRef: productSpec.product.id,
      stackPackId: selection.requestedStackPackId,
      entrypointKind,
    },
  );
  subjects.push({
    subjectKind: "entrypoint",
    subjectRef: entrypointRef,
    semanticScope: {
      kind: "setup",
      stackPackId: selection.requestedStackPackId,
      scopeRef: deriveSemanticSetupScopeRefV1(selection.requestedStackPackId),
    },
    subjectOrigin: {
      originKind: "entrypoint",
      productRef: productSpec.product.id,
      entrypointKind,
      deliverySelectionHash: hashProductDeliverySelectionV2(selection),
    },
    facts: globalFacts,
  });

  const topology = getStackTopologyCatalogContract(selection.requestedStackPackId);
  if (!topology) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "SEMANTIC_SOURCE_INTENT_V1_RULE_SET_UNAVAILABLE",
        "/deliverySelection/requestedStackPackId",
        `No code-owned topology exists for ${selection.requestedStackPackId}`,
      )],
    };
  }
  topology.descriptor.commands.forEach((command) => {
    subjects.push({
      subjectKind: "command",
      subjectRef: command.id,
      semanticScope: {
        kind: "platform",
        platformAuthorityRef: "PLATFORM_BUILD_COMMAND_V1",
        scopeRef: deriveSemanticPlatformScopeRefV1("PLATFORM_BUILD_COMMAND_V1"),
      },
      subjectOrigin: {
        originKind: "command",
        commandRef: command.id,
        commandKind: command.kind,
        commandContractHash: subjectContractHash("command", command),
      },
      facts: { ...globalFacts, command_kind: command.kind },
    });
  });

  productSpec.routes.forEach((route, index) => addStorySubject({
    subjectKind: "route",
    subjectRef: route.id,
    story: routeOwner.get(route.id),
    path: `/productSpec/routes/${index}`,
    subjectOrigin: {
      originKind: "route",
      routeRef: route.id,
      contractHash: subjectContractHash("route", route),
    },
    facts: globalFacts,
  }));
  productSpec.surfaces.forEach((surface, index) => addStorySubject({
    subjectKind: "surface",
    subjectRef: surface.id,
    story: surfaceOwner.get(surface.id),
    path: `/productSpec/surfaces/${index}`,
    subjectOrigin: {
      originKind: "surface",
      surfaceRef: surface.id,
      contractHash: subjectContractHash("surface", surface),
    },
    facts: globalFacts,
  }));

  productSpec.actions.forEach((action, actionIndex) => {
    const owner = actionOwner.get(action.id);
    addStorySubject({
      subjectKind: "action",
      subjectRef: action.id,
      story: owner,
      path: `/productSpec/actions/${actionIndex}`,
      subjectOrigin: {
        originKind: "action",
        actionRef: action.id,
        actionTriggerKind: action.trigger.kind,
        contractHash: subjectContractHash("action", action),
      },
      facts: { ...globalFacts, action_trigger_kind: action.trigger.kind },
    });
    action.controlPlacements.forEach((placement, placementIndex) => addStorySubject({
      subjectKind: "control_slot",
      subjectRef: placement.id,
      story: controlSlotOwner.get(placement.id),
      path: `/productSpec/actions/${actionIndex}/controlPlacements/${placementIndex}`,
      subjectOrigin: {
        originKind: "control_slot",
        controlSlotRef: placement.id,
        actionRef: action.id,
        contractHash: subjectContractHash("control-slot", { actionRef: action.id, placement }),
      },
      facts: { ...globalFacts, action_trigger_kind: action.trigger.kind },
    }));
    action.observableEffects.forEach((observable, observableIndex) => addStorySubject({
      subjectKind: "observable",
      subjectRef: observable.id,
      story: observableOwner.get(observable.id),
      path: `/productSpec/actions/${actionIndex}/observableEffects/${observableIndex}`,
      subjectOrigin: {
        originKind: "observable",
        observableRef: observable.id,
        actionRef: action.id,
        contractHash: subjectContractHash("observable", observable),
      },
      facts: { ...globalFacts, action_trigger_kind: action.trigger.kind },
    }));
  });

  const transportByAction = new Map(
    input.transportContracts.map((contract) => [contract.actionRef, contract] as const),
  );
  productSpec.actions.forEach((action, actionIndex) => {
    const contract = transportByAction.get(action.id);
    if (!contract) {
      diagnostics.push(diagnostic(
        "SEMANTIC_SOURCE_INTENT_V1_INVOCATION_TRANSPORT_REJECTED",
        `/productSpec/actions/${actionIndex}`,
        `No fresh invocation transport exists for ${action.id}`,
      ));
      return;
    }
    contract.fields.forEach((field) => addStorySubject({
      subjectKind: "action_input",
      subjectRef: deriveSemanticActionInputSubjectRefV1(action.id, field.fieldName),
      story: actionOwner.get(action.id),
      path: `/productSpec/actions/${actionIndex}/input/fields/${field.fieldName}`,
      subjectOrigin: {
        originKind: "action_input",
        actionRef: action.id,
        rawActionInputRef: field.actionInputRef,
        fieldName: field.fieldName,
        transportContractHash: contract.contractHash,
        transportFieldHash: subjectContractHash("invocation-transport-field", field),
      },
      facts: { ...globalFacts, action_trigger_kind: action.trigger.kind },
    }));
  });

  productSpec.states.forEach((state, index) => addStorySubject({
    subjectKind: "state",
    subjectRef: state.id,
    story: stateOwner.get(state.id),
    path: `/productSpec/states/${index}`,
    subjectOrigin: {
      originKind: "state",
      stateRef: state.id,
      contractHash: subjectContractHash("state", state),
    },
    facts: globalFacts,
  }));

  productSpec.entities.forEach((entity, index) => addStorySubject({
    subjectKind: "entity",
    subjectRef: entity.id,
    story: entityOwner.get(entity.id),
    path: `/productSpec/entities/${index}`,
    subjectOrigin: {
      originKind: "entity",
      entityRef: entity.id,
      entityContractHash: subjectContractHash("entity", entity),
      fieldRefs: entity.fields.map((field) => field.id).sort(compareUtf16),
      fieldContractHash: subjectContractHash("entity-fields", entity.fields),
    },
    facts: globalFacts,
  }));

  stories.filter((story) => story.persistenceRefs.length === 0).forEach((story) => {
    const persistenceRef = derivedSubjectRef(
      "PERSIST_NONE",
      "setfarm.semantic-persistence-absence-subject-ref.v1",
      { productRef: productSpec.product.id, componentHash: story.componentHash },
    );
    subjects.push({
      subjectKind: "persistence_policy",
      subjectRef: persistenceRef,
      semanticScope: storyScope(story, productSpec.product.id),
      subjectOrigin: {
        originKind: "persistence_absence",
        persistenceRef,
        productRef: productSpec.product.id,
        componentHash: story.componentHash,
        persistenceKind: "none",
        persistenceDurability: "none",
        policySetHash: hashCanonicalJson({
          schema: "setfarm.semantic-persistence-policy-set-hash.v1",
          componentHash: story.componentHash,
          policyRefs: [],
        }),
      },
      facts: {
        ...globalFacts,
        persistence_kind: "none",
        persistence_durability: "none",
      },
    });
  });
  productSpec.persistencePolicies.forEach((policy, index) => addStorySubject({
    subjectKind: "persistence_policy",
    subjectRef: policy.id,
    story: persistenceOwner.get(policy.id),
    path: `/productSpec/persistencePolicies/${index}`,
    subjectOrigin: {
      originKind: "persistence_policy",
      persistenceRef: policy.id,
      persistenceKind: policy.kind,
      persistenceDurability: policy.durability,
      contractHash: subjectContractHash("persistence-policy", policy),
    },
    facts: {
      ...globalFacts,
      persistence_kind: policy.kind,
      persistence_durability: policy.durability,
    },
  }));

  const directSemanticOwner = new Map<string, SemanticStoryPartitionBindingV3>();
  [routeOwner, surfaceOwner, controlSlotOwner, actionOwner, observableOwner, stateOwner,
    persistenceOwner, entityOwner].forEach((owners) => owners.forEach((story, ref) => {
    const existing = directSemanticOwner.get(ref);
    if (existing && existing.storyId !== story.storyId) {
      diagnostics.push(diagnostic(
        "SEMANTIC_SOURCE_INTENT_V1_SUBJECT_OWNERSHIP_AMBIGUOUS",
        "/productSpec/evidencePredicates",
        `Predicate subject ${ref} resolves to more than one story`,
      ));
    } else {
      directSemanticOwner.set(ref, story);
    }
  }));
  const actionReferencesByEvidence = new Map<string, string[]>();
  productSpec.actions.forEach((action) => {
    canonicalActionEvidenceRefs(action).forEach((evidenceRef) => {
      const references = actionReferencesByEvidence.get(evidenceRef) ?? [];
      references.push(action.id);
      actionReferencesByEvidence.set(evidenceRef, references);
    });
  });
  productSpec.evidencePredicates.forEach((predicate, index) => {
    const declaredOwner = evidenceOwner.get(predicate.id);
    const subjectOwner = directSemanticOwner.get(predicate.subjectRef);
    const actionReferenceRefs = [...(actionReferencesByEvidence.get(predicate.id) ?? [])]
      .sort(compareUtf16);
    const actionReferenceOwners = actionReferenceRefs.map((actionRef) =>
      actionOwner.get(actionRef));
    if (actionReferenceOwners.some((owner) => !owner)) {
      diagnostics.push(diagnostic(
        "SEMANTIC_SOURCE_INTENT_V1_SUBJECT_OWNERSHIP_UNRESOLVED",
        `/productSpec/evidencePredicates/${index}`,
        `Evidence ${predicate.id} has an action reference without an exact story owner`,
      ));
      return;
    }
    const ownerCandidates = [
      declaredOwner,
      subjectOwner,
      ...actionReferenceOwners,
    ].filter((owner): owner is SemanticStoryPartitionBindingV3 => owner !== undefined);
    const ownerStoryIds = new Set(ownerCandidates.map((owner) => owner.storyId));
    if (ownerStoryIds.size > 1) {
      diagnostics.push(diagnostic(
        "SEMANTIC_SOURCE_INTENT_V1_SUBJECT_OWNERSHIP_AMBIGUOUS",
        `/productSpec/evidencePredicates/${index}`,
        `Evidence ${predicate.id} crosses story subject/action ownership; StoryPartitionV3 relation authority is required`,
      ));
      return;
    }
    const owner = ownerCandidates[0];
    addStorySubject({
      subjectKind: "evidence_predicate",
      subjectRef: predicate.id,
      story: owner,
      path: `/productSpec/evidencePredicates/${index}`,
      subjectOrigin: {
        originKind: "evidence_predicate",
        evidenceRef: predicate.id,
        predicateSubjectRef: predicate.subjectRef,
        required: predicate.required,
        actionReferenceRefs,
        contractHash: subjectContractHash("evidence-predicate", predicate),
      },
      facts: globalFacts,
    });
  });

  const runtimeAuthorities = {
    actionById: new Map(productSpec.actions.map((action) => [action.id, action] as const)),
    stateById: new Map(productSpec.states.map((state) => [state.id, state] as const)),
    persistenceById: new Map(productSpec.persistencePolicies.map((policy) =>
      [policy.id, policy] as const)),
    evidenceById: new Map(productSpec.evidencePredicates.map((predicate) =>
      [predicate.id, predicate] as const)),
    entityById: new Map(productSpec.entities.map((entity) =>
      [entity.id, entity] as const)),
  };
  stories.forEach((story) => {
    const runtimeDataRef = derivedSubjectRef(
      "RUNTIME_DATA",
      "setfarm.semantic-runtime-data-subject-ref.v1",
      { productRef: productSpec.product.id, componentHash: story.componentHash },
    );
    subjects.push({
      subjectKind: "runtime_data_contract",
      subjectRef: runtimeDataRef,
      semanticScope: storyScope(story, productSpec.product.id),
      subjectOrigin: {
        originKind: "runtime_data_contract",
        runtimeDataRef,
        productRef: productSpec.product.id,
        componentHash: story.componentHash,
        runtimeDataContractHash: runtimeDataContractHash(
          productSpec,
          story,
          runtimeAuthorities,
        ),
      },
      facts: globalFacts,
    });
  });

  if (diagnostics.length > 0) return { status: "rejected", diagnostics };
  const subjectKeys = subjects.map((subject) =>
    `${subject.subjectKind}\0${subject.subjectRef}`);
  if (new Set(subjectKeys).size !== subjectKeys.length) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "SEMANTIC_SOURCE_INTENT_V1_SUBJECT_OWNERSHIP_AMBIGUOUS",
        "/subjects",
        "Derived semantic subjects must be globally unique by kind and ref",
      )],
    };
  }
  if (subjects.length > MAX_SUBJECTS) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "SEMANTIC_SOURCE_INTENT_V1_OUTPUT_LIMIT_EXCEEDED",
        "/subjects",
        `Derived subject count ${subjects.length} exceeds ${MAX_SUBJECTS}`,
      )],
    };
  }
  return {
    status: "derived",
    subjects: subjects.sort((left, right) =>
      compareUtf16(left.subjectKind, right.subjectKind)
      || compareUtf16(left.subjectRef, right.subjectRef)),
  };
}

function activationWitness(
  activation: SemanticSourceActivationV1,
  subject: SubjectAuthorityV1,
):
  | Readonly<{ status: "active"; witness: SemanticSourceIntentV1["activationWitness"] }>
  | Readonly<{ status: "inactive" }>
  | Readonly<{ status: "unresolved"; atomKind: string }> {
  if (activation.kind === "always") {
    return { status: "active", witness: { kind: "always" } };
  }
  const facts: Array<{ kind: any; value: any }> = [];
  for (const atom of activation.atoms) {
    const value = subject.facts[atom.kind];
    if (!value) return { status: "unresolved", atomKind: atom.kind };
    if (!(atom.values as readonly string[]).includes(value)) return { status: "inactive" };
    facts.push({ kind: atom.kind, value });
  }
  return { status: "active", witness: { kind: "all", facts } };
}

function targetFromRule(
  rule: SemanticSourceRuleV1,
  subject: SubjectAuthorityV1,
  transportByAction: ReadonlyMap<string, InvocationInputTransportV2>,
): SemanticSourceIntentV1["target"] | null {
  if (rule.ruleKind === "source_slot") {
    let resolvedSubjectContract: SourceSlotTargetV1["resolvedSubjectContract"] = {
      kind: "none",
    };
    if (rule.subjectContractResolution.kind !== "none") {
      if (
        rule.subjectContractResolution.kind === "dom_action_input_transport"
        || subject.subjectOrigin.originKind !== "action_input"
      ) return null;
      const contract = transportByAction.get(subject.subjectOrigin.actionRef);
      if (!contract) return null;
      resolvedSubjectContract = {
        kind: "invocation_input_transport_v2",
        resolutionState: "fresh_compiled_shadow",
        artifactType: "setfarm.invocation-input-transport.v2",
        actionRef: subject.subjectOrigin.actionRef,
        rawActionInputRef: subject.subjectOrigin.rawActionInputRef,
        contractHash: contract.contractHash,
        transportFieldHash: subject.subjectOrigin.transportFieldHash,
        transportKind: contract.kind,
        resolutionContractRef:
          rule.subjectContractResolution.kind === "cli_invocation_input_transport"
            ? "ACTION_INPUT_CLI_INVOCATION_V2"
            : "ACTION_INPUT_HTTP_INVOCATION_V2",
      };
    }
    return {
      kind: "source_slot",
      targetKind: rule.targetKind,
      ownerPolicy: rule.ownerPolicy,
      pathResolution: structuredClone(rule.pathResolution),
      locatorContract: structuredClone(rule.locatorContract),
      accessPolicy: rule.accessPolicy,
      outputPolicy: structuredClone(rule.outputPolicy),
      subjectContractResolution: structuredClone(rule.subjectContractResolution),
      resolvedSubjectContract,
    };
  }
  if (rule.ruleKind === "platform_contract") {
    return {
      kind: "platform_contract",
      targetKind: "platform_contract",
      platformAuthorityRef: rule.platformAuthorityRef,
      platformContractProjectionHash: rule.platformContractProjectionHash,
      capabilityRefs: [...rule.capabilityRefs],
    };
  }
  if (rule.ruleKind === "typed_exemption") {
    return {
      kind: "typed_exemption",
      targetKind: "typed_exemption",
      exemptionCode: rule.exemptionCode,
      backingResponsibility: rule.backingResponsibility,
      backingResolution: rule.backingResponsibility === null
        ? { state: "not_applicable" }
        : {
            state: "unresolved_shadow",
            requiredResponsibility: "state_store",
          },
    };
  }
  return {
    kind: "predicate_requirement",
    targetKind: "predicate_relation",
    resolutionState: "unresolved_shadow",
    bindingResolution: structuredClone(rule.bindingResolution),
  };
}

function intentOrderKey(intent: SemanticSourceIntentV1): string {
  return [
    intent.subjectKind,
    intent.subjectRef,
    intent.responsibility,
    intent.ruleRef,
    intent.semanticScope.scopeRef,
  ].join("\0");
}

function deriveIntents(input: Readonly<{
  subjects: readonly SubjectAuthorityV1[];
  rules: readonly SemanticSourceRuleV1[];
  ruleSetHash: string;
  transportContracts: readonly InvocationInputTransportV2[];
}>):
  | Readonly<{ status: "derived"; intents: readonly SemanticSourceIntentV1[] }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly SemanticSourceIntentCompilationDiagnosticV1[];
    }> {
  const ruleCountByKind = new Map<SemanticSourceSubjectKindV1, number>();
  input.rules.forEach((rule) => ruleCountByKind.set(
    rule.subjectKind,
    (ruleCountByKind.get(rule.subjectKind) ?? 0) + 1,
  ));
  const applicationCount = input.subjects.reduce(
    (total, subject) => total + (ruleCountByKind.get(subject.subjectKind) ?? 0),
    0,
  );
  if (applicationCount > MAX_RULE_APPLICATIONS) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "SEMANTIC_SOURCE_INTENT_V1_OUTPUT_LIMIT_EXCEEDED",
        "/rules",
        `Rule application count ${applicationCount} exceeds ${MAX_RULE_APPLICATIONS}`,
      )],
    };
  }

  const diagnostics: SemanticSourceIntentCompilationDiagnosticV1[] = [];
  const intents: SemanticSourceIntentV1[] = [];
  const coveredSubjects = new Set<string>();
  const transportByAction = new Map(
    input.transportContracts.map((contract) => [contract.actionRef, contract] as const),
  );
  for (const rule of input.rules) {
    const activeSubjects: Array<{
      subject: SubjectAuthorityV1;
      witness: SemanticSourceIntentV1["activationWitness"];
    }> = [];
    for (const subject of input.subjects.filter((candidate) =>
      candidate.subjectKind === rule.subjectKind)) {
      const activation = activationWitness(rule.activation, subject);
      if (activation.status === "inactive") continue;
      if (activation.status === "unresolved") {
        diagnostics.push(diagnostic(
          "SEMANTIC_SOURCE_INTENT_V1_ACTIVATION_FACT_UNRESOLVED",
          `/rules/${rule.ruleRef}/activation`,
          `Subject ${subject.subjectRef} has no compiler-owned ${activation.atomKind} fact`,
        ));
        continue;
      }
      activeSubjects.push({ subject, witness: activation.witness });
    }
    if (
      rule.cardinality.kind === "catalog_bounded_aggregate"
      && activeSubjects.length > rule.cardinality.maxMembers
    ) {
      diagnostics.push(diagnostic(
        "SEMANTIC_SOURCE_INTENT_V1_CARDINALITY_VIOLATION",
        `/rules/${rule.ruleRef}/cardinality`,
        `Rule ${rule.ruleRef} has ${activeSubjects.length} members, limit ${rule.cardinality.maxMembers}`,
      ));
      continue;
    }
    if (
      rule.cardinality.kind === "exactly_one_per_entrypoint"
      && activeSubjects.some(({ subject }) => subject.subjectKind !== "entrypoint")
    ) {
      diagnostics.push(diagnostic(
        "SEMANTIC_SOURCE_INTENT_V1_CARDINALITY_VIOLATION",
        `/rules/${rule.ruleRef}/cardinality`,
        "Entrypoint cardinality can apply only to entrypoint subjects",
      ));
      continue;
    }
    for (const { subject, witness } of activeSubjects) {
      const target = targetFromRule(rule, subject, transportByAction);
      if (!target) {
        diagnostics.push(diagnostic(
          "SEMANTIC_SOURCE_INTENT_V1_INVOCATION_TRANSPORT_REJECTED",
          `/rules/${rule.ruleRef}`,
          `Rule ${rule.ruleRef} cannot resolve ${subject.subjectRef}`,
        ));
        continue;
      }
      const common = {
        schema: SEMANTIC_SOURCE_INTENT_SCHEMA_V1,
        semanticScope: structuredClone(subject.semanticScope),
        subjectKind: subject.subjectKind,
        subjectRef: subject.subjectRef,
        subjectHash: hashSemanticSourceSubjectOriginV1(subject.subjectOrigin),
        subjectOrigin: structuredClone(subject.subjectOrigin),
        responsibility: rule.responsibility,
        ruleSetHash: input.ruleSetHash,
        ruleRef: rule.ruleRef,
        ruleHash: rule.ruleHash,
        activationWitness: structuredClone(witness),
        cardinality: structuredClone(rule.cardinality),
        target,
      };
      const intentRef = deriveSemanticSourceIntentRefV1(common);
      const withoutHash = { ...common, intentRef };
      const parsed = SemanticSourceIntentV1Schema.safeParse({
        ...withoutHash,
        intentHash: hashSemanticSourceIntentV1(
          withoutHash as Omit<SemanticSourceIntentV1, "intentHash">,
        ),
      });
      if (!parsed.success) {
        diagnostics.push(diagnostic(
          "SEMANTIC_SOURCE_INTENT_V1_CONTRACT_INVALID",
          `/intents/${subject.subjectRef}/${rule.responsibility}`,
          parsed.error.issues[0]?.message ?? "Derived intent is invalid",
        ));
        continue;
      }
      intents.push(parsed.data);
      coveredSubjects.add(`${subject.subjectKind}\0${subject.subjectRef}`);
    }
  }
  input.subjects.forEach((subject) => {
    const key = `${subject.subjectKind}\0${subject.subjectRef}`;
    if (coveredSubjects.has(key)) return;
    diagnostics.push(diagnostic(
      "SEMANTIC_SOURCE_INTENT_V1_CARDINALITY_VIOLATION",
      `/subjects/${subject.subjectRef}`,
      `No active code-owned rule covers ${subject.subjectKind} ${subject.subjectRef}`,
    ));
  });
  if (diagnostics.length > 0) return { status: "rejected", diagnostics };
  if (intents.length > MAX_SUBJECTS) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "SEMANTIC_SOURCE_INTENT_V1_OUTPUT_LIMIT_EXCEEDED",
        "/intents",
        `Derived intent count ${intents.length} exceeds ${MAX_SUBJECTS}`,
      )],
    };
  }
  intents.sort((left, right) => compareUtf16(intentOrderKey(left), intentOrderKey(right)));
  return { status: "derived", intents };
}

function exactDeliverySelection(
  productSpec: ProductSpecV2,
  candidateInput: unknown,
):
  | Readonly<{ status: "verified"; selection: ProductDeliverySelectionV2 }>
  | Readonly<{
      status: "rejected";
      result: SemanticSourceIntentCompilationResultV1;
    }> {
  const candidate = ProductDeliverySelectionV2Schema.safeParse(candidateInput);
  if (!candidate.success) {
    return {
      status: "rejected",
      result: singleRejected(
        "SEMANTIC_SOURCE_INTENT_V1_DELIVERY_SELECTION_INVALID",
        "/deliverySelection",
        candidate.error.issues[0]?.message ?? "Delivery selection is invalid",
      ),
    };
  }
  try {
    return {
      status: "verified",
      selection: verifyProductDeliverySelectionV2({
        productSpec,
        requestedStackPackId: candidate.data.requestedStackPackId,
        candidate: candidate.data,
      }),
    };
  } catch (error) {
    const code = error instanceof ProductDeliverySelectionVerificationErrorV2
      && error.code === "PRODUCT_DELIVERY_V2_SELECTION_INVALID"
      ? "SEMANTIC_SOURCE_INTENT_V1_DELIVERY_SELECTION_INVALID"
      : "SEMANTIC_SOURCE_INTENT_V1_DELIVERY_SELECTION_AUTHORITY_MISMATCH";
    return {
      status: "rejected",
      result: singleRejected(code, "/deliverySelection", errorMessage(error)),
    };
  }
}

export function hashSemanticDesignSourceClosureV2(value: unknown): string {
  return hashCanonicalJson({
    schema: "setfarm.design-source-closure-payload-hash.v2",
    closure: value,
  });
}

/** Pure shadow compiler; it accepts no paths, rules, stories or transport claims. */
export function compileSemanticSourceIntentSetV1(
  input: unknown,
): SemanticSourceIntentCompilationResultV1 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(input, COMPILER_INPUT_MAX_BYTES);
  } catch (error) {
    return singleRejected(
      "SEMANTIC_SOURCE_INTENT_V1_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const outer = CompilerInputV1Schema.safeParse(snapshot);
  if (!outer.success) {
    return rejected(diagnosticsFromZod(
      "SEMANTIC_SOURCE_INTENT_V1_INPUT_INVALID",
      outer.error,
    ));
  }
  const productSpecResult = ProductSpecV2Schema.safeParse(outer.data.productSpec);
  if (!productSpecResult.success) {
    return rejected(diagnosticsFromZod(
      "SEMANTIC_SOURCE_INTENT_V1_PRODUCT_SPEC_INVALID",
      productSpecResult.error,
      "/productSpec",
    ));
  }
  const productSpec = productSpecResult.data;
  let runtimeBehavior: Readonly<ProductRuntimeBehaviorContractV1> | null = null;
  if (outer.data.runtimeBehaviorContract !== undefined) {
    try {
      runtimeBehavior = verifyProductRuntimeBehaviorContractV1({
        productSpec,
        proposal: outer.data.runtimeBehaviorProposal,
        candidate: outer.data.runtimeBehaviorContract,
      });
    } catch (error) {
      return singleRejected(
        "SEMANTIC_SOURCE_INTENT_V1_BEHAVIOR_AUTHORITY_MISMATCH",
        "/runtimeBehaviorContract",
        errorMessage(error),
      );
    }
  }
  const selectionResult = exactDeliverySelection(productSpec, outer.data.deliverySelection);
  if (selectionResult.status === "rejected") return selectionResult.result;
  const selection = selectionResult.selection;

  const closureResult = DesignSourceClosureV2Schema.safeParse(outer.data.designSourceClosure);
  if (!closureResult.success) {
    return rejected(diagnosticsFromZod(
      "SEMANTIC_SOURCE_INTENT_V1_DESIGN_SOURCE_CLOSURE_INVALID",
      closureResult.error,
      "/designSourceClosure",
    ));
  }
  if (
    closureResult.data.kind !== "none"
    || selection.designSource.kind !== "none"
    || selection.delivery.designRequired !== false
  ) {
    return singleRejected(
      "SEMANTIC_SOURCE_INTENT_V1_DESIGN_SOURCE_AUTHORITY_MISMATCH",
      "/designSourceClosure",
      "The first intent slice requires the exact no-design ProfileV2 closure",
    );
  }

  const ruleSet = getCodeOwnedStackSemanticSourceRuleSetV1(
    selection.requestedStackPackId,
  );
  if (!ruleSet) {
    return singleRejected(
      "SEMANTIC_SOURCE_INTENT_V1_RULE_SET_UNAVAILABLE",
      "/deliverySelection/requestedStackPackId",
      `No code-owned source rule set exists for ${selection.requestedStackPackId}`,
    );
  }
  const selectionRuleBinding = selection.semanticSourceRules;
  if (
    selectionRuleBinding.ruleSetRef !== ruleSet.ruleSetRef
    || selectionRuleBinding.ruleSetVersion !== ruleSet.ruleSetVersion
    || selectionRuleBinding.ruleSetHash !== ruleSet.ruleSetHash
    || canonicalJsonStringify(selectionRuleBinding.readiness)
      !== canonicalJsonStringify(ruleSet.readiness)
    || canonicalJsonStringify(selection.stackPackBinding)
      !== canonicalJsonStringify(ruleSet.stackPackBinding)
  ) {
    return singleRejected(
      "SEMANTIC_SOURCE_INTENT_V1_RULE_SET_AUTHORITY_MISMATCH",
      "/deliverySelection/semanticSourceRules",
      "Selection does not bind the freshly reproduced code-owned semantic source rules",
    );
  }

  const storyResult = produceStoryDefinitionsV3({
    productSpec,
    designGraph: null,
    ...(runtimeBehavior
      ? {
          runtimeBehaviorProposal: outer.data.runtimeBehaviorProposal,
          runtimeBehaviorContract: runtimeBehavior,
        }
      : {}),
  });
  if (storyResult.status === "rejected") {
    return singleRejected(
      "SEMANTIC_SOURCE_INTENT_V1_STORY_PARTITION_REJECTED",
      "/productSpec",
      storyResult.diagnostics[0]?.message ?? "Semantic story partition was rejected",
    );
  }
  const stories = storyResult.stories.map(storyBinding);

  const transportResult = compileInvocationInputTransportSetV2({
    productSpec,
    deliverySelection: selection,
  });
  if (transportResult.status === "rejected") {
    return singleRejected(
      "SEMANTIC_SOURCE_INTENT_V1_INVOCATION_TRANSPORT_REJECTED",
      "/productSpec/actions",
      transportResult.diagnostics[0]?.message ?? "Invocation transport set was rejected",
    );
  }
  const transportBindings: InvocationTransportIntentBindingV2[] =
    transportResult.contractSet.contracts.map((contract) => ({
      actionRef: contract.actionRef,
      transportKind: contract.kind,
      actionInvocationIntentHash: contract.actionInvocationIntentHash,
      contractHash: contract.contractHash,
    }));
  const transportSetHash = hashInvocationTransportIntentBindingsV2(transportBindings);
  if (transportSetHash !== transportResult.membershipHash) {
    return singleRejected(
      "SEMANTIC_SOURCE_INTENT_V1_INVOCATION_TRANSPORT_REJECTED",
      "/productSpec/actions",
      "Invocation transport set hash does not equal the compiler-owned projection",
    );
  }

  const subjectResult = deriveSubjects({
    productSpec,
    selection,
    stories,
    transportContracts: transportResult.contractSet.contracts,
  });
  if (subjectResult.status === "rejected") return rejected(subjectResult.diagnostics);
  const intentResult = deriveIntents({
    subjects: subjectResult.subjects,
    rules: ruleSet.rules,
    ruleSetHash: ruleSet.ruleSetHash,
    transportContracts: transportResult.contractSet.contracts,
  });
  if (intentResult.status === "rejected") return rejected(intentResult.diagnostics);

  const productSpecHash = hashCanonicalJson(productSpec);
  const withoutHash = {
    schema: SEMANTIC_SOURCE_INTENT_SET_SCHEMA_V1,
    intentSetVersion: 1 as const,
    authorityState: "shadow_blocked" as const,
    productionUse: "forbidden" as const,
    blockerCodes: [...SEMANTIC_SOURCE_INTENT_BLOCKER_CODES_V1],
    authority: {
      productRef: productSpec.product.id,
      productSpecHash,
      deliverySelection: {
        selectionHash: hashProductDeliverySelectionV2(selection),
        productSpecHash: selection.productSpecHash,
        catalogVersion: selection.catalogVersion,
        catalogHash: selection.catalogHash,
        profileId: selection.profileId,
        profileHash: selection.profileHash,
        requestedStackPackId: selection.requestedStackPackId,
      },
      stackPackBinding: structuredClone(selection.stackPackBinding),
      designSourceClosure: {
        schema: "setfarm.design-source-closure.v2" as const,
        kind: "none" as const,
        reason: "product_delivery_design_not_required" as const,
        closureHash: hashSemanticDesignSourceClosureV2(closureResult.data),
      },
      semanticRuleSet: structuredClone(selection.semanticSourceRules),
      runtimeBehavior: runtimeBehavior
        ? {
            proposalSchema: "setfarm.product-runtime-behavior-proposal.v1" as const,
            proposalHash: runtimeBehavior.authority.proposalHash,
            contractSchema: runtimeBehavior.schema,
            contractVersion: runtimeBehavior.contractVersion,
            contractHash: runtimeBehavior.contractHash,
            evaluatorContractHash:
              runtimeBehavior.authority.evaluatorContractHash,
          }
        : null,
      storyPartition: {
        schema: "setfarm.semantic-story-partition.v3" as const,
        partitionVersion: 3 as const,
        partitionHash: hashSemanticStoryPartitionV3(stories),
        storyCount: stories.length,
        stories,
      },
      invocationTransportSet: {
        setHash: transportSetHash,
        bindings: transportBindings,
      },
    },
    intentCount: intentResult.intents.length,
    intents: intentResult.intents,
  };
  const parsed = SemanticSourceIntentSetV1Schema.safeParse({
    ...withoutHash,
    intentSetHash: hashSemanticSourceIntentSetV1(withoutHash as SemanticSourceIntentSetV1),
  });
  if (!parsed.success) {
    return rejected(diagnosticsFromZod(
      "SEMANTIC_SOURCE_INTENT_V1_CONTRACT_INVALID",
      parsed.error,
      "/intentSet",
    ));
  }
  const canonicalBytes = canonicalJsonStringify(parsed.data);
  if (Buffer.byteLength(canonicalBytes, "utf8") > OUTPUT_MAX_BYTES) {
    return singleRejected(
      "SEMANTIC_SOURCE_INTENT_V1_OUTPUT_LIMIT_EXCEEDED",
      "/intentSet",
      `Intent set exceeds ${OUTPUT_MAX_BYTES} canonical bytes`,
    );
  }
  const intentSet = recursivelyFreezeSemanticSourceIntentV1(parsed.data);
  return recursivelyFreezeSemanticSourceIntentV1({
    status: "shadow_compiled" as const,
    diagnostics: EMPTY_DIAGNOSTICS,
    intentSet,
    intentSetHash: intentSet.intentSetHash,
    canonicalBytes,
  });
}

export type SemanticSourceIntentVerificationErrorCodeV1 =
  | "SEMANTIC_SOURCE_INTENT_V1_VERIFICATION_INPUT_INVALID"
  | "SEMANTIC_SOURCE_INTENT_V1_VERIFICATION_CANDIDATE_INVALID"
  | "SEMANTIC_SOURCE_INTENT_V1_VERIFICATION_REPRODUCTION_REJECTED"
  | "SEMANTIC_SOURCE_INTENT_V1_VERIFICATION_AUTHORITY_MISMATCH";

export class SemanticSourceIntentVerificationErrorV1 extends Error {
  readonly code: SemanticSourceIntentVerificationErrorCodeV1;

  constructor(code: SemanticSourceIntentVerificationErrorCodeV1, message: string) {
    super(message);
    this.name = "SemanticSourceIntentVerificationErrorV1";
    this.code = code;
  }
}

export type VerifiedShadowSemanticSourceIntentSetV1 = Readonly<{
  status: "verified_shadow";
  intentSet: Readonly<SemanticSourceIntentSetV1>;
  intentSetHash: string;
  canonicalBytes: string;
}>;

export function verifySemanticSourceIntentSetV1(
  input: unknown,
): VerifiedShadowSemanticSourceIntentSetV1 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(input, VERIFIER_INPUT_MAX_BYTES);
  } catch (error) {
    throw new SemanticSourceIntentVerificationErrorV1(
      "SEMANTIC_SOURCE_INTENT_V1_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const outer = VerificationInputV1Schema.safeParse(snapshot);
  if (!outer.success) {
    throw new SemanticSourceIntentVerificationErrorV1(
      "SEMANTIC_SOURCE_INTENT_V1_VERIFICATION_INPUT_INVALID",
      outer.error.issues[0]?.message ?? "Verification input is invalid",
    );
  }
  const candidate = SemanticSourceIntentSetV1Schema.safeParse(outer.data.candidate);
  if (!candidate.success) {
    throw new SemanticSourceIntentVerificationErrorV1(
      "SEMANTIC_SOURCE_INTENT_V1_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "Intent-set candidate is invalid",
    );
  }
  const reproduced = compileSemanticSourceIntentSetV1({
    productSpec: outer.data.productSpec,
    deliverySelection: outer.data.deliverySelection,
    designSourceClosure: outer.data.designSourceClosure,
    ...(outer.data.runtimeBehaviorContract !== undefined
      ? {
          runtimeBehaviorProposal: outer.data.runtimeBehaviorProposal,
          runtimeBehaviorContract: outer.data.runtimeBehaviorContract,
        }
      : {}),
  });
  if (reproduced.status === "rejected") {
    throw new SemanticSourceIntentVerificationErrorV1(
      "SEMANTIC_SOURCE_INTENT_V1_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message ?? "Fresh intent reproduction was rejected",
    );
  }
  if (
    canonicalJsonStringify(reproduced.intentSet)
    !== canonicalJsonStringify(candidate.data)
  ) {
    throw new SemanticSourceIntentVerificationErrorV1(
      "SEMANTIC_SOURCE_INTENT_V1_VERIFICATION_AUTHORITY_MISMATCH",
      "Intent candidate does not equal fresh ProductSpec/profile/rule/partition/transport authority",
    );
  }
  return recursivelyFreezeSemanticSourceIntentV1({
    status: "verified_shadow" as const,
    intentSet: reproduced.intentSet,
    intentSetHash: reproduced.intentSetHash,
    canonicalBytes: reproduced.canonicalBytes,
  });
}
