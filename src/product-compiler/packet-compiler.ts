import { z } from "zod";

import { produceRuntimeEvidenceContractV1 } from "../evidence/runtime-evidence-contract-producer-v1.js";
import { hashRuntimeEvidenceContractV1 } from "../evidence/runtime-evidence-contract-v1.js";
import {
  SemanticArtifactEnvelopeV1Schema,
  type ArtifactPutResult,
} from "./artifact-store.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  buildDesignSourceClosureV1,
  validateDesignSourceClosureInputV1,
  type DesignSourceInputV1,
  type ValidatedDesignSourceClosureInputV1,
} from "./design-source-closure-compiler.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "./diagnostics.js";
import { BuildTopologyV1Schema, type BuildTopologyV1 } from "./schemas/build-topology-v1.js";
import {
  type CompilationDiagnosticV1,
  ProductCompilationReportV1Schema,
  type ProductCompilationReportV1,
} from "./schemas/compilation-report-v1.js";
import {
  ProductCompilationReportV2Schema,
  type ProductCompilationReportV2,
} from "./schemas/compilation-report-v2.js";
import {
  ProductCompilationReportV3Schema,
  type ProductCompilationReportV3,
} from "./schemas/compilation-report-v3.js";
import {
  CompilerIdentityV1Schema,
  SemanticArtifactProducerV1Schema,
  Sha256Schema,
} from "./schemas/common-v1.js";
import {
  DesignInteractionGraphV1Schema,
  type DesignInteractionGraphV1,
} from "./schemas/design-interaction-graph-v1.js";
import {
  ProductBuildPacketV1Schema,
  type ProductBuildPacketV1,
} from "./schemas/product-build-packet-v1.js";
import {
  ProductBuildPacketV2Schema,
  type ProductBuildPacketV2,
} from "./schemas/product-build-packet-v2.js";
import {
  ProductBuildPacketV3Schema,
  type ProductBuildPacketV3,
} from "./schemas/product-build-packet-v3.js";
import {
  ProductSpecV1EnglishWriteSchema,
  type ProductActionV1,
  type ProductSpecV1,
} from "./schemas/product-spec-v1.js";
import { StoryPlanV1Schema, type StoryPlanV1 } from "./schemas/story-plan-v1.js";
import { DesignGenerationTargetsV2Schema } from "./schemas/design-generation-targets-v2.js";
import { DesignInteractionGraphV2Schema } from "./schemas/design-interaction-graph-v2.js";
import { DesignSourceClosureV2Schema } from "./schemas/design-source-closure-v2.js";
import { ProductSpecV2EnglishWriteSchema } from "./schemas/product-spec-v2.js";
import { StitchDirectResponseEvidenceV2Schema } from "./schemas/stitch-direct-response-evidence-v2.js";
import { StitchRenderedSemanticsV2Schema } from "./schemas/stitch-rendered-semantics-v2.js";
import {
  StitchTargetCandidateSelectionV2Schema,
  StitchTargetResponseBindingsV3Schema,
} from "./schemas/stitch-target-candidate-selection-v2.js";
import { StoryPlanV2Schema } from "./schemas/story-plan-v2.js";
import { validateRuntimeDataContractClosureV1 } from "./producers/runtime-data-contract.js";
import {
  produceImplementationSourceMapV1,
  type ImplementationSourceMapProducerInputV1,
} from "./producers/implementation-source-map-v1.js";
import { produceStoryPlanV2 } from "./producers/story-plan-v2.js";

const VALIDATION_IDS = [
  "VALIDATE_ACTION_REACHABILITY",
  "VALIDATE_CONTROL_DISPOSITIONS",
  "VALIDATE_EVIDENCE_COVERAGE",
  "VALIDATE_REFERENCE_COMPLETENESS",
  "VALIDATE_RUNTIME_DATA_CLOSURE",
  "VALIDATE_RUNTIME_EVIDENCE_CLOSURE",
  "VALIDATE_SCHEMA_STRICT",
  "VALIDATE_STORY_PARTITIONS",
  "VALIDATE_TOPOLOGY_CAPABILITIES",
] as const;

const VALIDATION_IDS_V2 = [
  ...VALIDATION_IDS,
  "VALIDATE_DESIGN_SOURCE_CLOSURE",
] as const;

const VALIDATION_IDS_V3 = [
  "VALIDATE_V3_AUTHORITY_HASH_CHAIN",
  "VALIDATE_V3_DESIGN_SOURCE_CLOSURE",
  "VALIDATE_V3_IMPLEMENTATION_SOURCE_MAP_AUTHORITY",
  "VALIDATE_V3_RELEASE_PIN",
  "VALIDATE_V3_RUNTIME_CONTRACT_PAIR",
  "VALIDATE_V3_SCHEMA_STRICT",
  "VALIDATE_V3_STORY_PLAN_PROJECTION",
] as const;

type ArtifactWriter = Readonly<{
  put(value: unknown): Promise<ArtifactPutResult>;
}>;

export type ProductPacketCompilerInput = Readonly<{
  productSpec: unknown;
  designGraph: unknown;
  buildTopology: unknown;
  storyPlan: unknown;
  compiler: unknown;
  producer: unknown;
  parentPacketHashes?: unknown;
  protocol?: "legacy-shadow" | "v3";
  designSource?: DesignSourceInputV1;
  artifactStore: ArtifactWriter;
}>;

export type ProductPacketCompilationResult = Readonly<{
  status: "sealed" | "rejected";
  report: ProductCompilationReportV1 | ProductCompilationReportV2;
  reportHash: string;
  artifactHashes: Readonly<Record<string, string>>;
  packet?: ProductBuildPacketV1 | ProductBuildPacketV2;
  packetHash?: string;
}>;

export type ProductPacketCompilerInputV3 = Readonly<{
  productSpecV2: unknown;
  designGraphV2: unknown | null;
  buildTopologyV1: unknown;
  storyPlanV2: unknown;
  designSourceClosureV2: unknown;
  implementationSourceInputsV1: ImplementationSourceMapProducerInputV1;
  designSourceArtifactsV2?: unknown;
  compiler: unknown;
  producer: unknown;
  parentPacketHashes?: unknown;
  artifactStore: ArtifactWriter;
}>;

export const ProductPacketDesignSourceArtifactsV2Schema = z
  .object({
    generationTargets: DesignGenerationTargetsV2Schema,
    directResponseEvidence: StitchDirectResponseEvidenceV2Schema,
    renderedSemantics: StitchRenderedSemanticsV2Schema,
    candidateSelection: StitchTargetCandidateSelectionV2Schema,
    responseBindings: StitchTargetResponseBindingsV3Schema,
  })
  .strict();

export type ProductPacketDesignSourceArtifactsV2 = z.infer<
  typeof ProductPacketDesignSourceArtifactsV2Schema
>;

export type ProductPacketCompilationResultV3 = Readonly<{
  status: "sealed" | "rejected";
  report: ProductCompilationReportV3;
  reportHash: string;
  artifactHashes: Readonly<{
    productSpecV2?: string;
    designGraphV2?: string | null;
    buildTopologyV1?: string;
    storyPlanV2?: string;
    designSourceClosureV2?: string;
    implementationSourceMapV1?: string;
  }>;
  packet?: ProductBuildPacketV3;
  packetHash?: string;
}>;

function diagnostic(input: {
  code: string;
  category?: CompilationDiagnosticV1["category"];
  severity?: CompilationDiagnosticV1["severity"];
  message: string;
  artifactHash?: string;
  reference?: string;
}): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code: input.code,
    category: input.category ?? "contract",
    severity: input.severity ?? "error",
    message: input.message,
    ...(input.artifactHash ? { artifactHash: input.artifactHash } : {}),
    ...(input.reference ? { reference: input.reference } : {}),
    provenance: [],
    suggestions: [],
  });
}

function schemaDiagnostics(
  code: string,
  artifactHash: string,
  error: z.ZodError,
): CompilationDiagnosticV1[] {
  return error.issues.slice(0, 200).map((issue) => diagnostic({
    code,
    message: `Strict schema failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
    artifactHash,
    reference: issue.path.join("/") || "$",
  }));
}

function safeInputHash(value: unknown, label: string): string {
  try {
    return hashCanonicalJson(value);
  } catch (error) {
    return hashCanonicalJson({
      schema: "setfarm.unhashable-compiler-input.v1",
      label,
      error: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function requiredActionStateRefs(action: ProductActionV1): string[] {
  return uniqueSorted([
    ...action.preconditions.map((item) => item.stateRef),
    ...action.stateDeltas.map((item) => item.stateRef),
    ...action.stateDeltas.flatMap((item) =>
      item.valueFrom.kind === "state" ? [item.valueFrom.stateRef] : []),
    ...action.success.stateRefs,
    ...action.failure.stateRefs,
  ]);
}

function requiredActionPersistenceRefs(action: ProductActionV1): string[] {
  return uniqueSorted([
    ...action.persistenceEffects.map((item) => item.policyRef),
    ...(action.success.persistenceRefs ?? []),
    ...(action.failure.persistenceRefs ?? []),
  ]);
}

function validateGraph(
  product: ProductSpecV1,
  graph: DesignInteractionGraphV1,
  artifactHash: string,
): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const surfaces = new Map(product.surfaces.map((item) => [item.id, item]));
  const routes = new Set(product.routes.map((item) => item.id));
  const actions = new Map(product.actions.map((item) => [item.id, item]));
  const states = new Set(product.states.map((item) => item.id));
  const persistence = new Set(product.persistencePolicies.map((item) => item.id));
  const evidence = new Set(product.evidencePredicates.map((item) => item.id));
  const controls = new Map(graph.controls.map((item) => [item.id, item]));

  graph.surfaces.forEach((surface) => {
    if (!surfaces.has(surface.surfaceRef)) {
      diagnostics.push(diagnostic({
        code: "LINK_SURFACE_REF_UNRESOLVED",
        category: "link",
        message: `Design surface ${surface.id} references absent ProductSpec surface`,
        artifactHash,
        reference: surface.surfaceRef,
      }));
    }
  });
  graph.controls.forEach((control) => {
    if (!surfaces.has(control.surfaceRef)) {
      diagnostics.push(diagnostic({
        code: "LINK_CONTROL_SURFACE_UNRESOLVED",
        category: "link",
        message: `Control ${control.id} references absent ProductSpec surface`,
        artifactHash,
        reference: control.surfaceRef,
      }));
    }
  });
  graph.unresolvedBindings.forEach((unresolved) => diagnostics.push(diagnostic({
    code: "LINK_UNRESOLVED_CONTROL",
    category: "link",
    message: `Control ${unresolved.controlRef} remains unresolved (${unresolved.code})`,
    artifactHash,
    reference: unresolved.controlRef,
  })));

  const reachableActions = new Set<string>();
  graph.bindings.forEach((binding) => {
    if (!controls.has(binding.controlRef)) {
      diagnostics.push(diagnostic({
        code: "LINK_BINDING_CONTROL_UNRESOLVED",
        category: "link",
        message: `Binding references absent control ${binding.controlRef}`,
        artifactHash,
        reference: binding.controlRef,
      }));
      return;
    }
    if (binding.disposition !== "action") return;
    const action = actions.get(binding.actionRef);
    if (!action) {
      diagnostics.push(diagnostic({
        code: "LINK_ACTION_REF_UNRESOLVED",
        category: "link",
        message: `Binding references absent ProductSpec action ${binding.actionRef}`,
        artifactHash,
        reference: binding.actionRef,
      }));
      return;
    }
    reachableActions.add(action.id);
    const control = controls.get(binding.controlRef)!;
    const controlSurface = surfaces.get(control.surfaceRef);
    if (!action.surfaceRefs.includes(control.surfaceRef)) {
      diagnostics.push(diagnostic({
        code: "LINK_ACTION_SURFACE_MISMATCH",
        category: "link",
        message: `Action ${action.id} is not allowed on control surface ${control.surfaceRef}`,
        artifactHash,
        reference: `${action.id}->${control.surfaceRef}`,
      }));
    }
    if (!binding.routeRef || binding.routeRef !== controlSurface?.routeRef) {
      diagnostics.push(diagnostic({
        code: "LINK_BINDING_ROUTE_SURFACE_MISMATCH",
        category: "link",
        message: `Action binding route must equal control surface route ${controlSurface?.routeRef ?? "<missing>"}`,
        artifactHash,
        reference: binding.routeRef ?? binding.controlRef,
      }));
    }
    if (binding.routeRef && !routes.has(binding.routeRef)) {
      diagnostics.push(diagnostic({
        code: "LINK_ROUTE_REF_UNRESOLVED",
        category: "link",
        message: `Action binding references absent route ${binding.routeRef}`,
        artifactHash,
        reference: binding.routeRef,
      }));
    }

    const inputCounts = new Map<string, number>();
    binding.inputBindings.forEach((item) => {
      inputCounts.set(item.inputField, (inputCounts.get(item.inputField) ?? 0) + 1);
      if (item.valueFrom.kind === "control_value" && !controls.has(item.valueFrom.controlRef)) {
        diagnostics.push(diagnostic({
          code: "LINK_INPUT_CONTROL_REF_UNRESOLVED",
          category: "link",
          message: `Input ${item.inputField} references absent control ${item.valueFrom.controlRef}`,
          artifactHash,
          reference: item.valueFrom.controlRef,
        }));
      }
      if (item.valueFrom.kind === "state" && !states.has(item.valueFrom.stateRef)) {
        diagnostics.push(diagnostic({
          code: "LINK_INPUT_STATE_REF_UNRESOLVED",
          category: "link",
          message: `Input ${item.inputField} references absent state ${item.valueFrom.stateRef}`,
          artifactHash,
          reference: item.valueFrom.stateRef,
        }));
      }
    });
    action.input.fields.forEach((field) => {
      if ((inputCounts.get(field.name) ?? 0) !== 1) {
        diagnostics.push(diagnostic({
          code: "LINK_ACTION_INPUT_BINDING_MISSING",
          category: "link",
          message: `Action ${action.id} input ${field.name} requires exactly one value binding`,
          artifactHash,
          reference: `${action.id}.${field.name}`,
        }));
      }
    });
    binding.inputBindings.forEach((item) => {
      if (!action.input.fields.some((field) => field.name === item.inputField)) {
        diagnostics.push(diagnostic({
          code: "LINK_UNKNOWN_ACTION_INPUT_BINDING",
          category: "link",
          message: `Binding defines unknown input ${action.id}.${item.inputField}`,
          artifactHash,
          reference: `${action.id}.${item.inputField}`,
        }));
      }
    });

    requiredActionStateRefs(action).forEach((reference) => {
      if (!binding.stateRefs.includes(reference)) {
        diagnostics.push(diagnostic({
          code: "LINK_ACTION_STATE_REF_MISSING",
          category: "link",
          message: `Action binding omits required state ${reference}`,
          artifactHash,
          reference,
        }));
      }
    });
    binding.stateRefs.forEach((reference) => {
      if (!states.has(reference)) {
        diagnostics.push(diagnostic({
          code: "LINK_ACTION_STATE_REF_UNRESOLVED",
          category: "link",
          message: `Action binding references absent state ${reference}`,
          artifactHash,
          reference,
        }));
      }
    });
    requiredActionPersistenceRefs(action).forEach((reference) => {
      if (!binding.persistenceRefs.includes(reference)) {
        diagnostics.push(diagnostic({
          code: "LINK_ACTION_PERSISTENCE_REF_MISSING",
          category: "link",
          message: `Action binding omits required persistence ${reference}`,
          artifactHash,
          reference,
        }));
      }
    });
    binding.persistenceRefs.forEach((reference) => {
      if (!persistence.has(reference)) {
        diagnostics.push(diagnostic({
          code: "LINK_ACTION_PERSISTENCE_REF_UNRESOLVED",
          category: "link",
          message: `Action binding references absent persistence ${reference}`,
          artifactHash,
          reference,
        }));
      }
    });
    action.evidenceRefs.forEach((reference) => {
      if (!binding.evidenceRefs.includes(reference)) {
        diagnostics.push(diagnostic({
          code: "LINK_ACTION_EVIDENCE_REF_MISSING",
          category: "link",
          message: `Action binding omits required evidence ${reference}`,
          artifactHash,
          reference,
        }));
      }
    });
    binding.evidenceRefs.forEach((reference) => {
      if (!evidence.has(reference)) {
        diagnostics.push(diagnostic({
          code: "LINK_ACTION_EVIDENCE_REF_UNRESOLVED",
          category: "link",
          message: `Action binding references absent evidence ${reference}`,
          artifactHash,
          reference,
        }));
      }
    });
  });

  const declaredObservableEffects = product.actions.flatMap((action) =>
    (action.observableEffects ?? []).map((effect) => ({ action, effect })));
  const declaredObservableRefs = new Set(declaredObservableEffects.map(({ effect }) => effect.id));
  const observableBindings = graph.observableBindings ?? [];
  for (const { action, effect } of declaredObservableEffects) {
    const matches = observableBindings.filter((binding) => binding.observableRef === effect.id);
    if (matches.length !== 1) {
      diagnostics.push(diagnostic({
        code: matches.length === 0
          ? "LINK_OBSERVABLE_BINDING_MISSING"
          : "LINK_OBSERVABLE_BINDING_AMBIGUOUS",
        category: "link",
        message: `Observable ${effect.id} requires exactly one exact design binding; observed ${matches.length}`,
        artifactHash,
        reference: effect.id,
      }));
      continue;
    }
    const binding = matches[0]!;
    if (binding.actionRef !== action.id || binding.evidenceRef !== effect.evidenceRef) {
      diagnostics.push(diagnostic({
        code: "LINK_OBSERVABLE_CONTRACT_MISMATCH",
        category: "link",
        message: `Observable ${effect.id} binding action/evidence identity differs from ProductSpec`,
        artifactHash,
        reference: effect.id,
      }));
    }
    const target = binding.target;
    if (effect.selector.kind === "control") {
      const actionControlRefs = graph.bindings.flatMap((candidate) =>
        candidate.disposition === "action" && candidate.actionRef === action.id
          ? [candidate.controlRef]
          : []);
      if (
        target.kind !== "control"
        || actionControlRefs.length !== 1
        || target.controlRef !== actionControlRefs[0]
      ) {
        diagnostics.push(diagnostic({
          code: "LINK_OBSERVABLE_CONTROL_MISMATCH",
          category: "link",
          message: `Observable ${effect.id} does not bind the exact ${action.id} control`,
          artifactHash,
          reference: effect.id,
        }));
      }
    } else if (effect.selector.kind === "surface") {
      const surfaceRef = effect.selector.surfaceRef;
      const designSurfaces = graph.surfaces.filter((surface) =>
        surface.surfaceRef === surfaceRef);
      if (
        target.kind !== "surface"
        || designSurfaces.length !== 1
        || target.designSurfaceRef !== designSurfaces[0]!.id
      ) {
        diagnostics.push(diagnostic({
          code: "LINK_OBSERVABLE_SURFACE_MISMATCH",
          category: "link",
          message: `Observable ${effect.id} does not bind the exact ${surfaceRef} design surface`,
          artifactHash,
          reference: effect.id,
        }));
      }
    } else if (
      target.kind !== "accessibility"
      || target.surfaceRef !== effect.selector.surfaceRef
      || target.role !== effect.selector.role
      || target.name !== effect.selector.name
      || target.source.selector !== `[data-observable-refs~="${effect.id}"]`
    ) {
      diagnostics.push(diagnostic({
        code: "LINK_OBSERVABLE_ACCESSIBILITY_MISMATCH",
        category: "link",
        message: `Observable ${effect.id} does not bind its exact accessibility source marker`,
        artifactHash,
        reference: effect.id,
      }));
    }
  }
  observableBindings
    .filter((binding) => !declaredObservableRefs.has(binding.observableRef))
    .forEach((binding) => diagnostics.push(diagnostic({
      code: "LINK_OBSERVABLE_BINDING_UNEXPECTED",
      category: "link",
      message: `Design graph contains undeclared observable binding ${binding.observableRef}`,
      artifactHash,
      reference: binding.observableRef,
    })));

  product.actions
    .filter((action) => action.trigger.kind === "user" || action.trigger.kind === "route")
    .forEach((action) => {
      if (!reachableActions.has(action.id)) {
        diagnostics.push(diagnostic({
          code: "LINK_REQUIRED_ACTION_UNREACHABLE",
          category: "link",
          message: `Required action ${action.id} is not reachable from an exact control`,
          artifactHash,
          reference: action.id,
        }));
      }
    });
  return diagnostics;
}

function validateStories(
  product: ProductSpecV1,
  graph: DesignInteractionGraphV1,
  topology: BuildTopologyV1,
  stories: StoryPlanV1,
  artifactHash: string,
): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const surfaceIds = new Set(product.surfaces.map((item) => item.id));
  const controlIds = new Set(graph.controls.map((item) => item.id));
  const actionIds = new Set(product.actions.map((item) => item.id));
  const stateIds = new Set(product.states.map((item) => item.id));
  const persistenceIds = new Set(product.persistencePolicies.map((item) => item.id));
  const evidenceIds = new Set(product.evidencePredicates.map((item) => item.id));
  const pathById = new Map(topology.pathBindings.map((item) => [item.id, item]));
  const grantIds = new Set(topology.sharedGrants.map((item) => item.id));
  const ownerByStory = new Map(
    topology.owners.filter((item) => item.kind === "story").map((item) => [item.storyRef, item]),
  );

  const refSets = {
    surfaceRefs: surfaceIds,
    controlRefs: controlIds,
    actionRefs: actionIds,
    stateRefs: stateIds,
    persistenceRefs: persistenceIds,
    evidenceRefs: evidenceIds,
  } as const;
  const refCodes = {
    surfaceRefs: "CONTRACT_STORY_SURFACE_REF_UNRESOLVED",
    controlRefs: "CONTRACT_STORY_CONTROL_REF_UNRESOLVED",
    actionRefs: "CONTRACT_STORY_ACTION_REF_UNRESOLVED",
    stateRefs: "CONTRACT_STORY_STATE_REF_UNRESOLVED",
    persistenceRefs: "CONTRACT_STORY_PERSISTENCE_REF_UNRESOLVED",
    evidenceRefs: "CONTRACT_STORY_EVIDENCE_REF_UNRESOLVED",
  } as const;

  stories.stories.forEach((story) => {
    (Object.keys(refSets) as Array<keyof typeof refSets>).forEach((field) => {
      story[field].forEach((reference) => {
        if (!refSets[field].has(reference)) {
          diagnostics.push(diagnostic({
            code: refCodes[field],
            message: `Story ${story.id} has unresolved ${field} value ${reference}`,
            artifactHash,
            reference,
          }));
        }
      });
    });
    const owner = ownerByStory.get(story.id);
    if (!owner || owner.id !== story.ownerRef) {
      diagnostics.push(diagnostic({
        code: "CONTRACT_STORY_OWNER_MISMATCH",
        message: `Story ${story.id} owner ${story.ownerRef} does not match topology`,
        artifactHash,
        reference: story.ownerRef,
      }));
    }
    story.ownedPathRefs.forEach((pathRef) => {
      const binding = pathById.get(pathRef);
      if (!binding) {
        diagnostics.push(diagnostic({
          code: "CONTRACT_STORY_PATH_REF_UNRESOLVED",
          message: `Story ${story.id} references absent path ${pathRef}`,
          artifactHash,
          reference: pathRef,
        }));
      } else if (binding.ownerRef !== story.ownerRef) {
        diagnostics.push(diagnostic({
          code: "CONTRACT_STORY_PATH_OWNER_MISMATCH",
          message: `Story ${story.id} does not own path ${pathRef}`,
          artifactHash,
          reference: pathRef,
        }));
      }
    });
    story.sharedGrantRefs.forEach((grantRef) => {
      if (!grantIds.has(grantRef)) {
        diagnostics.push(diagnostic({
          code: "CONTRACT_STORY_GRANT_REF_UNRESOLVED",
          message: `Story ${story.id} references absent shared grant ${grantRef}`,
          artifactHash,
          reference: grantRef,
        }));
      }
    });
    story.evidenceRefs.forEach((evidenceRef) => {
      const predicate = product.evidencePredicates.find((item) => item.id === evidenceRef);
      if (predicate && !predicate.required) {
        diagnostics.push(diagnostic({
          code: "CONTRACT_STORY_EVIDENCE_NOT_REQUIRED",
          message: `Story ${story.id} completion evidence ${evidenceRef} is not required`,
          artifactHash,
          reference: evidenceRef,
        }));
      }
    });
    story.actionRefs.forEach((actionRef) => {
      const action = product.actions.find((item) => item.id === actionRef);
      action?.surfaceRefs.forEach((surfaceRef) => {
        if (!story.surfaceRefs.includes(surfaceRef)) {
          diagnostics.push(diagnostic({
            code: "CONTRACT_STORY_ACTION_SURFACE_MISSING",
            message: `Story ${story.id} owns ${actionRef} but omits its surface ${surfaceRef}`,
            artifactHash,
            reference: `${actionRef}->${surfaceRef}`,
          }));
        }
      });
    });
  });

  const exactPartition = (
    references: readonly string[],
    field: "actionRefs" | "controlRefs" | "surfaceRefs" | "evidenceRefs",
    unownedCode: string,
    multipleCode: string,
  ) => {
    references.forEach((reference) => {
      const owners = stories.stories.filter((story) => story[field].includes(reference));
      if (owners.length === 0) {
        diagnostics.push(diagnostic({
          code: unownedCode,
          message: `${reference} has no story owner`,
          artifactHash,
          reference,
        }));
      } else if (owners.length > 1) {
        diagnostics.push(diagnostic({
          code: multipleCode,
          message: `${reference} is owned by multiple stories`,
          artifactHash,
          reference,
        }));
      }
    });
  };
  exactPartition([...actionIds], "actionRefs", "CONTRACT_ACTION_UNOWNED", "CONTRACT_ACTION_MULTIPLE_STORIES");
  exactPartition([...controlIds], "controlRefs", "CONTRACT_CONTROL_UNOWNED", "CONTRACT_CONTROL_MULTIPLE_STORIES");
  exactPartition(
    product.surfaces.filter((surface) => surface.required).map((surface) => surface.id),
    "surfaceRefs",
    "CONTRACT_REQUIRED_SURFACE_UNOWNED",
    "CONTRACT_REQUIRED_SURFACE_MULTIPLE_STORIES",
  );
  exactPartition(
    product.evidencePredicates.filter((predicate) => predicate.required).map((predicate) => predicate.id),
    "evidenceRefs",
    "CONTRACT_REQUIRED_EVIDENCE_UNOWNED",
    "CONTRACT_REQUIRED_EVIDENCE_MULTIPLE_STORIES",
  );
  const requireSomeOwner = (
    references: readonly string[],
    field: "stateRefs" | "persistenceRefs",
    code: string,
  ) => {
    references.forEach((reference) => {
      if (!stories.stories.some((story) => story[field].includes(reference))) {
        diagnostics.push(diagnostic({
          code,
          message: `${reference} has no story owner`,
          artifactHash,
          reference,
        }));
      }
    });
  };
  requireSomeOwner([...stateIds], "stateRefs", "CONTRACT_STATE_UNOWNED");
  requireSomeOwner([...persistenceIds], "persistenceRefs", "CONTRACT_PERSISTENCE_UNOWNED");
  return diagnostics;
}

function validateTopologyAndEvidence(
  product: ProductSpecV1,
  topology: BuildTopologyV1,
  artifactHash: string,
): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const routeIds = new Set(product.routes.map((item) => item.id));
  const capabilities = new Map(topology.capabilities.map((item) => [item.id, item]));
  topology.entrypoints.forEach((entrypoint) => {
    entrypoint.routeRefs.forEach((routeRef) => {
      if (!routeIds.has(routeRef)) {
        diagnostics.push(diagnostic({
          code: "CONTRACT_ENTRYPOINT_ROUTE_REF_UNRESOLVED",
          message: `Entrypoint ${entrypoint.id} references absent route ${routeRef}`,
          artifactHash,
          reference: routeRef,
        }));
      }
    });
  });
  product.evidencePredicates.filter((item) => item.required).forEach((predicate) => {
    predicate.capabilityRefs.forEach((capabilityRef) => {
      const capability = capabilities.get(capabilityRef);
      if (!capability?.enabled) {
        diagnostics.push(diagnostic({
          code: "CONTRACT_EVIDENCE_CAPABILITY_UNAVAILABLE",
          message: `Required evidence ${predicate.id} needs unavailable capability ${capabilityRef}`,
          artifactHash,
          reference: capabilityRef,
        }));
      }
    });
  });
  return diagnostics;
}

function validateRuntimeDataClosure(
  product: ProductSpecV1,
  topology: BuildTopologyV1,
  artifactHash: string,
  requireV3: boolean,
): CompilationDiagnosticV1[] {
  const hasContract = Boolean(topology.runtimeDataContract);
  const hasHash = Boolean(topology.runtimeDataContractHash);
  if (requireV3 && !product.delivery) {
    return [diagnostic({
      code: "CONTRACT_V3_PRODUCT_DELIVERY_MISSING",
      message: "V3 packet compilation requires ProductSpec delivery authority; historical ProductSpec cannot be upgraded by inference",
      artifactHash,
      reference: "delivery",
    })];
  }
  if (product.delivery && (!hasContract || !hasHash)) {
    return [diagnostic({
      code: "CONTRACT_RUNTIME_DATA_MISSING",
      message: "V3 ProductSpec delivery requires an exact runtime-data contract and canonical hash before implementation",
      artifactHash,
      reference: "runtimeDataContract",
    })];
  }
  if (!product.delivery && (hasContract || hasHash)) {
    return [diagnostic({
      code: "CONTRACT_RUNTIME_DATA_PROTOCOL_AUTHORITY_MISSING",
      message: "Historical ProductSpec without v3 delivery cannot be reinterpreted as runtime-data authority",
      artifactHash,
      reference: "delivery",
    })];
  }
  if (!product.delivery) return [];
  return validateRuntimeDataContractClosureV1({
    productSpec: product,
    commands: topology.commands,
    contract: topology.runtimeDataContract,
    contractHash: topology.runtimeDataContractHash,
  }).map((item) => ({ ...item, artifactHash }));
}

function validateRuntimeEvidenceClosure(
  product: ProductSpecV1,
  topology: BuildTopologyV1,
  artifactHash: string,
  requireV3: boolean,
): CompilationDiagnosticV1[] {
  const hasContract = Boolean(topology.runtimeEvidenceContract);
  const hasHash = Boolean(topology.runtimeEvidenceContractHash);
  if (requireV3 && !product.delivery) {
    return [];
  }
  if (product.delivery && (!hasContract || !hasHash)) {
    return [diagnostic({
      code: "CONTRACT_RUNTIME_EVIDENCE_MISSING",
      message: "V3 ProductSpec delivery requires an exact runtime-evidence contract and canonical hash before implementation",
      artifactHash,
      reference: "runtimeEvidenceContract",
    })];
  }
  if (!product.delivery && (hasContract || hasHash)) {
    return [diagnostic({
      code: "CONTRACT_RUNTIME_EVIDENCE_PROTOCOL_AUTHORITY_MISSING",
      message: "Historical ProductSpec without v3 delivery cannot be reinterpreted as runtime-evidence authority",
      artifactHash,
      reference: "delivery",
    })];
  }
  if (!product.delivery) return [];
  const produced = produceRuntimeEvidenceContractV1({ productSpec: product, buildTopology: topology });
  if (produced.status === "unsupported") {
    return [diagnostic({
      code: "CONTRACT_RUNTIME_EVIDENCE_STACK_UNSUPPORTED",
      message: `Stack ${produced.stackPackId} has no authoritative runtime-evidence producer`,
      artifactHash,
      reference: produced.stackPackId,
    })];
  }
  if (produced.status === "rejected") {
    return [diagnostic({
      code: `CONTRACT_${produced.rejectionCode}`,
      message: `BuildTopology cannot produce an exact runtime-evidence contract: ${produced.rejectionCode}`,
      artifactHash,
      reference: produced.rejectionCode,
    })];
  }
  const expectedHash = hashRuntimeEvidenceContractV1(produced.contract);
  if (expectedHash !== topology.runtimeEvidenceContractHash) {
    return [diagnostic({
      code: "CONTRACT_RUNTIME_EVIDENCE_PROJECTION_MISMATCH",
      message: "Embedded runtime-evidence contract is not the exact ProductSpec/BuildTopology projection",
      artifactHash,
      reference: "runtimeEvidenceContractHash",
    })];
  }
  return [];
}

async function storeChild(
  store: ArtifactWriter,
  artifactType: string,
  producer: z.infer<typeof SemanticArtifactProducerV1Schema>,
  payload: unknown,
): Promise<string> {
  const envelope = SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType,
    producer,
    payload,
  });
  return (await store.put(envelope)).hash;
}

export async function compileProductBuildPacket(
  input: ProductPacketCompilerInput,
): Promise<ProductPacketCompilationResult> {
  if (!input.artifactStore || typeof input.artifactStore.put !== "function") {
    throw new TypeError("Product packet compiler requires an injected artifact writer");
  }
  const compiler = CompilerIdentityV1Schema.parse(input.compiler);
  const producer = SemanticArtifactProducerV1Schema.parse(input.producer);
  const parentPacketHashes = z.array(Sha256Schema).max(100).parse(input.parentPacketHashes ?? []);
  const usePacketV2 = input.designSource !== undefined;
  if (usePacketV2 && input.protocol !== "v3") {
    throw new TypeError("A typed design-source closure is only valid for Product Compiler v3 packets");
  }
  const rawHashes = {
    productSpec: safeInputHash(input.productSpec, "productSpec"),
    designGraph: safeInputHash(input.designGraph, "designGraph"),
    buildTopology: safeInputHash(input.buildTopology, "buildTopology"),
    storyPlan: safeInputHash(input.storyPlan, "storyPlan"),
    ...(input.designSource?.kind === "stitch" ? {
      designGenerationTargets: safeInputHash(input.designSource.generationTargets, "designGenerationTargets"),
      stitchDirectResponseEvidence: safeInputHash(input.designSource.directResponseEvidence, "stitchDirectResponseEvidence"),
      stitchRenderedSemantics: safeInputHash(input.designSource.renderedSemantics, "stitchRenderedSemantics"),
      stitchTargetCandidateSelection: safeInputHash(input.designSource.candidateSelection, "stitchTargetCandidateSelection"),
      stitchTargetResponseBindings: safeInputHash(input.designSource.responseBindings, "stitchTargetResponseBindings"),
    } : input.designSource?.kind === "none" ? {
      designSourceNone: safeInputHash(input.designSource, "designSourceNone"),
    } : {}),
  };
  const diagnostics: CompilationDiagnosticV1[] = [];
  if (compiler.codeSha !== producer.codeSha) {
    diagnostics.push(diagnostic({
      code: "CONTRACT_COMPILER_PRODUCER_REVISION_MISMATCH",
      message: `Compiler ${compiler.codeSha} and producer ${producer.codeSha} revisions disagree`,
      reference: `${compiler.codeSha}->${producer.codeSha}`,
    }));
  }

  const productResult = ProductSpecV1EnglishWriteSchema.safeParse(input.productSpec);
  const graphResult = DesignInteractionGraphV1Schema.safeParse(input.designGraph);
  const topologyResult = BuildTopologyV1Schema.safeParse(input.buildTopology);
  const storiesResult = StoryPlanV1Schema.safeParse(input.storyPlan);
  if (!productResult.success) diagnostics.push(...schemaDiagnostics("CONTRACT_PRODUCT_SPEC_SCHEMA_INVALID", rawHashes.productSpec, productResult.error));
  if (!graphResult.success) diagnostics.push(...schemaDiagnostics("CONTRACT_DESIGN_GRAPH_SCHEMA_INVALID", rawHashes.designGraph, graphResult.error));
  if (!topologyResult.success) diagnostics.push(...schemaDiagnostics("CONTRACT_BUILD_TOPOLOGY_SCHEMA_INVALID", rawHashes.buildTopology, topologyResult.error));
  if (!storiesResult.success) diagnostics.push(...schemaDiagnostics("CONTRACT_STORY_PLAN_SCHEMA_INVALID", rawHashes.storyPlan, storiesResult.error));

  const artifactHashes: Record<string, string> = {};
  if (productResult.success) {
    artifactHashes.productSpec = await storeChild(input.artifactStore, "setfarm.product-spec.v1", producer, productResult.data);
  }
  if (graphResult.success) {
    artifactHashes.designGraph = await storeChild(input.artifactStore, "setfarm.design-interaction-graph.v1", producer, graphResult.data);
  }
  if (topologyResult.success) {
    artifactHashes.buildTopology = await storeChild(input.artifactStore, "setfarm.build-topology.v1", producer, topologyResult.data);
  }
  if (storiesResult.success) {
    artifactHashes.storyPlan = await storeChild(input.artifactStore, "setfarm.story-plan.v1", producer, storiesResult.data);
  }

  if (productResult.success && graphResult.success && topologyResult.success && storiesResult.success) {
    diagnostics.push(...validateGraph(productResult.data, graphResult.data, rawHashes.designGraph));
    diagnostics.push(...validateStories(
      productResult.data,
      graphResult.data,
      topologyResult.data,
      storiesResult.data,
      rawHashes.storyPlan,
    ));
    diagnostics.push(...validateTopologyAndEvidence(
      productResult.data,
      topologyResult.data,
      rawHashes.buildTopology,
    ));
    diagnostics.push(...validateRuntimeDataClosure(
      productResult.data,
      topologyResult.data,
      rawHashes.buildTopology,
      input.protocol === "v3",
    ));
    diagnostics.push(...validateRuntimeEvidenceClosure(
      productResult.data,
      topologyResult.data,
      rawHashes.buildTopology,
      input.protocol === "v3",
    ));
  }

  let validatedDesignSource: ValidatedDesignSourceClosureInputV1 | undefined;
  if (input.designSource && productResult.success && graphResult.success) {
    const validated = validateDesignSourceClosureInputV1({
      productSpec: productResult.data,
      designGraph: graphResult.data,
      designSource: input.designSource,
    });
    if (validated.status === "rejected") {
      diagnostics.push(...validated.issues.map((entry) => diagnostic({
        code: entry.code,
        message: entry.message,
        reference: entry.reference,
      })));
    } else {
      validatedDesignSource = validated.value;
    }
  }

  if (validatedDesignSource) {
    let envelopeHashes: {
      generationTargets: string;
      directResponseEvidence: string;
      renderedSemantics: string;
      candidateSelection: string;
      responseBindings: string;
    } | undefined;
    if (validatedDesignSource.kind === "stitch") {
      envelopeHashes = {
        generationTargets: await storeChild(
          input.artifactStore,
          "setfarm.design-generation-targets.v1",
          producer,
          validatedDesignSource.generationTargets,
        ),
        directResponseEvidence: await storeChild(
          input.artifactStore,
          "setfarm.stitch-direct-response-evidence.v2",
          producer,
          validatedDesignSource.directResponseEvidence,
        ),
        renderedSemantics: await storeChild(
          input.artifactStore,
          "setfarm.stitch-rendered-semantics.v1",
          producer,
          validatedDesignSource.renderedSemantics,
        ),
        candidateSelection: await storeChild(
          input.artifactStore,
          "setfarm.stitch-target-candidate-selection.v1",
          producer,
          validatedDesignSource.candidateSelection,
        ),
        responseBindings: await storeChild(
          input.artifactStore,
          "setfarm.stitch-target-response-bindings.v2",
          producer,
          validatedDesignSource.responseBindings,
        ),
      };
      artifactHashes.designGenerationTargets = envelopeHashes.generationTargets;
      artifactHashes.stitchDirectResponseEvidence = envelopeHashes.directResponseEvidence;
      artifactHashes.stitchRenderedSemantics = envelopeHashes.renderedSemantics;
      artifactHashes.stitchTargetCandidateSelection = envelopeHashes.candidateSelection;
      artifactHashes.stitchTargetResponseBindings = envelopeHashes.responseBindings;
    }
    const closure = buildDesignSourceClosureV1({
      validated: validatedDesignSource,
      ...(envelopeHashes ? { envelopeHashes } : {}),
    });
    artifactHashes.designSourceClosure = await storeChild(
      input.artifactStore,
      "setfarm.design-source-closure.v1",
      producer,
      closure,
    );
  }

  const sortedDiagnostics = sortCompilationDiagnostics(diagnostics);
  const rejectionCodes = uniqueSorted(
    sortedDiagnostics.filter((item) => item.severity === "error").map((item) => item.code),
  );
  const inputHashes = uniqueSorted(Object.values(rawHashes));
  let packet: ProductBuildPacketV1 | ProductBuildPacketV2 | undefined;
  let packetHash: string | undefined;
  const runtimeDataContractHash = topologyResult.success
    ? topologyResult.data.runtimeDataContractHash
    : undefined;
  const runtimeEvidenceContractHash = topologyResult.success
    ? topologyResult.data.runtimeEvidenceContractHash
    : undefined;

  if (rejectionCodes.length === 0) {
    packet = usePacketV2
      ? ProductBuildPacketV2Schema.parse({
          schema: "setfarm.product-build-packet.v2",
          packetVersion: 2,
          parentPacketHashes: uniqueSorted(parentPacketHashes),
          productSpecHash: artifactHashes.productSpec,
          designGraphHash: artifactHashes.designGraph,
          buildTopologyHash: artifactHashes.buildTopology,
          storyPlanHash: artifactHashes.storyPlan,
          ...(runtimeDataContractHash ? { runtimeDataContractHash } : {}),
          ...(runtimeEvidenceContractHash ? { runtimeEvidenceContractHash } : {}),
          designSourceClosureHash: artifactHashes.designSourceClosure,
          compiler,
          validationIds: [...VALIDATION_IDS_V2],
        })
      : ProductBuildPacketV1Schema.parse({
          schema: "setfarm.product-build-packet.v1",
          packetVersion: 1,
          parentPacketHashes: uniqueSorted(parentPacketHashes),
          productSpecHash: artifactHashes.productSpec,
          designGraphHash: artifactHashes.designGraph,
          buildTopologyHash: artifactHashes.buildTopology,
          storyPlanHash: artifactHashes.storyPlan,
          ...(runtimeDataContractHash ? { runtimeDataContractHash } : {}),
          ...(runtimeEvidenceContractHash ? { runtimeEvidenceContractHash } : {}),
          compiler,
          validationIds: [...VALIDATION_IDS],
        });
    packetHash = await storeChild(
      input.artifactStore,
      usePacketV2 ? "setfarm.product-build-packet.v2" : "setfarm.product-build-packet.v1",
      producer,
      packet,
    );
  }

  const reportArtifactHashes = {
    ...(artifactHashes.productSpec ? { productSpec: artifactHashes.productSpec } : {}),
    ...(artifactHashes.designGraph ? { designGraph: artifactHashes.designGraph } : {}),
    ...(artifactHashes.buildTopology ? { buildTopology: artifactHashes.buildTopology } : {}),
    ...(artifactHashes.storyPlan ? { storyPlan: artifactHashes.storyPlan } : {}),
    ...(usePacketV2 && artifactHashes.designSourceClosure
      ? { designSourceClosure: artifactHashes.designSourceClosure }
      : {}),
  };
  const report = usePacketV2
    ? ProductCompilationReportV2Schema.parse(rejectionCodes.length > 0 ? {
        schema: "setfarm.product-compilation-report.v2",
        status: "rejected",
        compiler,
        inputHashes,
        artifactHashes: reportArtifactHashes,
        diagnostics: sortedDiagnostics,
        validationIds: [...VALIDATION_IDS_V2],
        rejectionCodes,
      } : {
        schema: "setfarm.product-compilation-report.v2",
        status: "sealed",
        compiler,
        inputHashes,
        artifactHashes: reportArtifactHashes,
        diagnostics: sortedDiagnostics,
        validationIds: [...VALIDATION_IDS_V2],
        packetHash,
      })
    : ProductCompilationReportV1Schema.parse(rejectionCodes.length > 0 ? {
        schema: "setfarm.product-compilation-report.v1",
        status: "rejected",
        compiler,
        inputHashes,
        artifactHashes: reportArtifactHashes,
        diagnostics: sortedDiagnostics,
        validationIds: [...VALIDATION_IDS],
        rejectionCodes,
      } : {
        schema: "setfarm.product-compilation-report.v1",
        status: "sealed",
        compiler,
        inputHashes,
        artifactHashes: reportArtifactHashes,
        diagnostics: sortedDiagnostics,
        validationIds: [...VALIDATION_IDS],
        packetHash,
      });
  const reportHash = await storeChild(
    input.artifactStore,
    usePacketV2 ? "setfarm.product-compilation-report.v2" : "setfarm.product-compilation-report.v1",
    producer,
    report,
  );

  return {
    status: report.status,
    report,
    reportHash,
    artifactHashes,
    ...(packet ? { packet } : {}),
    ...(packetHash ? { packetHash } : {}),
  };
}

/**
 * Native Product Semantics Authority v2 packet compiler.
 *
 * This entry point deliberately has no ProductSpecV1, DesignGraphV1,
 * StoryPlanV1, or ProductBuildPacketV1/V2 adapter. Missing native inputs are
 * reported as v3 compilation failures; historical artifacts remain readable
 * through their historical compiler/reader branches only.
 */
export async function compileProductBuildPacketV3(
  input: ProductPacketCompilerInputV3,
): Promise<ProductPacketCompilationResultV3> {
  if (!input.artifactStore || typeof input.artifactStore.put !== "function") {
    throw new TypeError("Product packet compiler v3 requires an injected artifact writer");
  }
  const compiler = CompilerIdentityV1Schema.parse(input.compiler);
  const producer = SemanticArtifactProducerV1Schema.parse(input.producer);
  const parentPacketHashes = z.array(Sha256Schema).max(100).parse(input.parentPacketHashes ?? []);
  const rawHashes = {
    productSpecV2: safeInputHash(input.productSpecV2, "productSpecV2"),
    designGraphV2: safeInputHash(input.designGraphV2, "designGraphV2"),
    buildTopologyV1: safeInputHash(input.buildTopologyV1, "buildTopologyV1"),
    storyPlanV2: safeInputHash(input.storyPlanV2, "storyPlanV2"),
    designSourceClosureV2: safeInputHash(input.designSourceClosureV2, "designSourceClosureV2"),
    implementationSourceInputsV1: safeInputHash(
      input.implementationSourceInputsV1,
      "implementationSourceInputsV1",
    ),
    ...(input.designSourceArtifactsV2 === undefined ? {} : {
      designSourceArtifactsV2: safeInputHash(
        input.designSourceArtifactsV2,
        "designSourceArtifactsV2",
      ),
    }),
  };
  const diagnostics: CompilationDiagnosticV1[] = [];
  if (compiler.codeSha !== producer.codeSha) {
    diagnostics.push(diagnostic({
      code: "CONTRACT_V3_COMPILER_PRODUCER_REVISION_MISMATCH",
      message: `Compiler ${compiler.codeSha} and producer ${producer.codeSha} revisions disagree`,
      reference: `${compiler.codeSha}->${producer.codeSha}`,
    }));
  }

  const productResult = ProductSpecV2EnglishWriteSchema.safeParse(input.productSpecV2);
  const graphResult = input.designGraphV2 === null
    ? { success: true as const, data: null }
    : DesignInteractionGraphV2Schema.safeParse(input.designGraphV2);
  const topologyResult = BuildTopologyV1Schema.safeParse(input.buildTopologyV1);
  const storiesResult = StoryPlanV2Schema.safeParse(input.storyPlanV2);
  const closureResult = DesignSourceClosureV2Schema.safeParse(input.designSourceClosureV2);
  const sourceMapResult = produceImplementationSourceMapV1(
    input.implementationSourceInputsV1,
  );
  const designSourceArtifactsResult = input.designSourceArtifactsV2 === undefined
    ? undefined
    : ProductPacketDesignSourceArtifactsV2Schema.safeParse(input.designSourceArtifactsV2);
  if (!productResult.success) {
    diagnostics.push(...schemaDiagnostics(
      "CONTRACT_V3_PRODUCT_SPEC_SCHEMA_INVALID",
      rawHashes.productSpecV2,
      productResult.error,
    ));
  }
  if (!graphResult.success) {
    diagnostics.push(...schemaDiagnostics(
      "CONTRACT_V3_DESIGN_GRAPH_SCHEMA_INVALID",
      rawHashes.designGraphV2,
      graphResult.error,
    ));
  }
  if (!topologyResult.success) {
    diagnostics.push(...schemaDiagnostics(
      "CONTRACT_V3_BUILD_TOPOLOGY_SCHEMA_INVALID",
      rawHashes.buildTopologyV1,
      topologyResult.error,
    ));
  }
  if (!storiesResult.success) {
    diagnostics.push(...schemaDiagnostics(
      "CONTRACT_V3_STORY_PLAN_SCHEMA_INVALID",
      rawHashes.storyPlanV2,
      storiesResult.error,
    ));
  }
  if (!closureResult.success) {
    diagnostics.push(...schemaDiagnostics(
      "CONTRACT_V3_DESIGN_SOURCE_CLOSURE_SCHEMA_INVALID",
      rawHashes.designSourceClosureV2,
      closureResult.error,
    ));
  } else if (closureResult.data.kind === "stitch") {
    if (!designSourceArtifactsResult) {
      diagnostics.push(diagnostic({
        code: "CONTRACT_V3_DESIGN_SOURCE_ARTIFACTS_REQUIRED",
        message: "A Stitch DesignSourceClosureV2 requires the exact five native design-source payloads",
        reference: "designSourceArtifactsV2",
      }));
    } else if (!designSourceArtifactsResult.success) {
      diagnostics.push(...schemaDiagnostics(
        "CONTRACT_V3_DESIGN_SOURCE_ARTIFACTS_SCHEMA_INVALID",
        rawHashes.designSourceArtifactsV2!,
        designSourceArtifactsResult.error,
      ));
    }
  } else if (input.designSourceArtifactsV2 !== undefined) {
    diagnostics.push(diagnostic({
      code: "CONTRACT_V3_DESIGN_SOURCE_ARTIFACTS_FORBIDDEN",
      message: "A no-design DesignSourceClosureV2 must not carry Stitch design-source payloads",
      reference: "designSourceArtifactsV2",
    }));
  }
  if (sourceMapResult.status === "rejected") {
    diagnostics.push(...sourceMapResult.diagnostics);
  }

  const artifactHashes: {
    productSpecV2?: string;
    designGraphV2?: string | null;
    buildTopologyV1?: string;
    storyPlanV2?: string;
    designSourceClosureV2?: string;
    implementationSourceMapV1?: string;
  } = {};
  if (productResult.success) {
    artifactHashes.productSpecV2 = await storeChild(
      input.artifactStore,
      "setfarm.product-spec.v2",
      producer,
      productResult.data,
    );
  }
  if (graphResult.success) {
    artifactHashes.designGraphV2 = graphResult.data === null
      ? null
      : await storeChild(
          input.artifactStore,
          "setfarm.design-interaction-graph.v2",
          producer,
          graphResult.data,
        );
  }
  if (topologyResult.success) {
    artifactHashes.buildTopologyV1 = await storeChild(
      input.artifactStore,
      "setfarm.build-topology.v1",
      producer,
      topologyResult.data,
    );
  }
  if (storiesResult.success) {
    artifactHashes.storyPlanV2 = await storeChild(
      input.artifactStore,
      "setfarm.story-plan.v2",
      producer,
      storiesResult.data,
    );
  }
  if (sourceMapResult.status === "produced") {
    artifactHashes.implementationSourceMapV1 = await storeChild(
      input.artifactStore,
      "setfarm.implementation-source-map.v1",
      producer,
      sourceMapResult.sourceMap,
    );
  }
  let designSourceArtifactsVerified = closureResult.success
    && closureResult.data.kind === "none"
    && input.designSourceArtifactsV2 === undefined;
  if (
    closureResult.success
    && closureResult.data.kind === "stitch"
    && designSourceArtifactsResult?.success
  ) {
    const nestedArtifacts = [
      ["generationTargets", "setfarm.design-generation-targets.v2"],
      ["directResponseEvidence", "setfarm.stitch-direct-response-evidence.v2"],
      ["renderedSemantics", "setfarm.stitch-rendered-semantics.v2"],
      ["candidateSelection", "setfarm.stitch-target-candidate-selection.v2"],
      ["responseBindings", "setfarm.stitch-target-response-bindings.v3"],
    ] as const;
    let exactReferences = true;
    for (const [field, artifactType] of nestedArtifacts) {
      const payload = designSourceArtifactsResult.data[field];
      const reference = closureResult.data[field];
      const payloadHash = hashCanonicalJson(payload);
      const envelopeHash = hashCanonicalJson(SemanticArtifactEnvelopeV1Schema.parse({
        schema: "setfarm.semantic-artifact-envelope.v1",
        artifactType,
        producer,
        payload,
      }));
      if (
        reference.artifactType !== artifactType
        || reference.payloadHash !== payloadHash
        || reference.envelopeHash !== envelopeHash
      ) {
        exactReferences = false;
        diagnostics.push(diagnostic({
          code: "CONTRACT_V3_DESIGN_SOURCE_ARTIFACT_HASH_MISMATCH",
          message: `DesignSourceClosureV2 ${field} does not bind the exact strict payload and producer envelope`,
          artifactHash: envelopeHash,
          reference: field,
        }));
      }
    }
    if (exactReferences) {
      for (const [field, artifactType] of nestedArtifacts) {
        const storedHash = await storeChild(
          input.artifactStore,
          artifactType,
          producer,
          designSourceArtifactsResult.data[field],
        );
        if (storedHash !== closureResult.data[field].envelopeHash) {
          throw new TypeError(
            `Artifact writer returned ${storedHash} for exact ${field} envelope ${closureResult.data[field].envelopeHash}`,
          );
        }
      }
      designSourceArtifactsVerified = true;
    }
  }
  if (closureResult.success && designSourceArtifactsVerified) {
    artifactHashes.designSourceClosureV2 = await storeChild(
      input.artifactStore,
      "setfarm.design-source-closure.v2",
      producer,
      closureResult.data,
    );
  }

  if (
    productResult.success
    && graphResult.success
    && topologyResult.success
    && storiesResult.success
    && closureResult.success
    && sourceMapResult.status === "produced"
  ) {
    const productSpecHash = hashCanonicalJson(productResult.data);
    const designGraphHash = graphResult.data === null ? null : hashCanonicalJson(graphResult.data);
    const buildTopologyHash = hashCanonicalJson(topologyResult.data);
    const storyPlanHash = hashCanonicalJson(storiesResult.data);
    const designSourceClosureHash = hashCanonicalJson(closureResult.data);
    const expectedDesignKind = productResult.data.delivery.designRequired ? "stitch" : "none";
    if (
      storiesResult.data.productSpecHash !== productSpecHash
      || storiesResult.data.designGraphHash !== designGraphHash
      || storiesResult.data.buildTopologyHash !== buildTopologyHash
    ) {
      diagnostics.push(diagnostic({
        code: "CONTRACT_V3_STORY_PLAN_AUTHORITY_HASH_MISMATCH",
        message: "StoryPlanV2 does not bind the exact ProductSpecV2, DesignInteractionGraphV2, and BuildTopologyV1 payload hashes",
        reference: "storyPlanV2",
      }));
    }
    if (
      storiesResult.data.designSourceKind !== expectedDesignKind
      || closureResult.data.kind !== expectedDesignKind
      || (graphResult.data !== null) !== (expectedDesignKind === "stitch")
    ) {
      diagnostics.push(diagnostic({
        code: "CONTRACT_V3_DESIGN_SOURCE_KIND_MISMATCH",
        message: "ProductSpecV2 delivery, graph presence, StoryPlanV2, and DesignSourceClosureV2 must declare one exact design-source kind",
        reference: "designSourceKind",
      }));
    }
    if (
      sourceMapResult.sourceMap.designSourceKind !== expectedDesignKind
      || sourceMapResult.sourceMap.designSourceKind !== storiesResult.data.designSourceKind
      || sourceMapResult.sourceMap.designSourceKind !== closureResult.data.kind
      || sourceMapResult.sourceMap.productSpecV2PayloadHash !== productSpecHash
      || sourceMapResult.sourceMap.designGraphV2PayloadHash !== designGraphHash
      || sourceMapResult.sourceMap.buildTopologyV1PayloadHash !== buildTopologyHash
      || sourceMapResult.sourceMap.storyPlanV2PayloadHash !== storyPlanHash
      || sourceMapResult.sourceMap.designSourceClosureV2PayloadHash !== designSourceClosureHash
    ) {
      diagnostics.push(diagnostic({
        code: "CONTRACT_V3_IMPLEMENTATION_SOURCE_MAP_AUTHORITY_MISMATCH",
        message: "ImplementationSourceMapV1 does not bind the exact ProductSpecV2, DesignInteractionGraphV2, BuildTopologyV1, StoryPlanV2, DesignSourceClosureV2, and design-source kind authorities",
        reference: "implementationSourceMapV1",
      }));
    }
    if (
      sourceMapResult.sourceMap.designSourceKind === "stitch"
      && designSourceArtifactsResult?.success
    ) {
      const targetByRef = new Map(
        designSourceArtifactsResult.data.generationTargets.targets.map((target) =>
          [target.targetId, target] as const),
      );
      const responseByTarget = new Map(
        designSourceArtifactsResult.data.responseBindings.bindings.map((binding) =>
          [binding.targetRef, binding] as const),
      );
      let exactScreenAuthorities =
        sourceMapResult.sourceMap.screens.length === targetByRef.size
        && sourceMapResult.sourceMap.screens.length === responseByTarget.size;
      for (const screen of sourceMapResult.sourceMap.screens) {
        const target = targetByRef.get(screen.targetRef);
        const response = responseByTarget.get(screen.targetRef);
        if (
          !target
          || !response
          || screen.responseScreenId !== response.responseScreenId
          || screen.targetHash !== hashCanonicalJson(target)
          || screen.targetHash !== response.targetHash
          || screen.responseBindingHash !== hashCanonicalJson(response)
        ) {
          exactScreenAuthorities = false;
        }
      }
      if (!exactScreenAuthorities) {
        diagnostics.push(diagnostic({
          code: "CONTRACT_V3_IMPLEMENTATION_SOURCE_MAP_SCREEN_AUTHORITY_MISMATCH",
          message: "ImplementationSourceMapV1 must bind every and only exact DesignGenerationTargetV2 and StitchTargetResponseBindingV3 payload",
          reference: "implementationSourceMapV1.screens",
        }));
      }
    }
    if (graphResult.data !== null) {
      if (
        graphResult.data.productSpecHash !== productSpecHash
        || closureResult.data.kind !== "stitch"
        || closureResult.data.designGraph.payloadHash !== designGraphHash
        || closureResult.data.designGraph.envelopeHash !== artifactHashes.designGraphV2
      ) {
        diagnostics.push(diagnostic({
          code: "CONTRACT_V3_DESIGN_GRAPH_AUTHORITY_MISMATCH",
          message: "DesignInteractionGraphV2 and DesignSourceClosureV2 do not bind the exact ProductSpecV2 payload and graph CAS envelope",
          reference: "designGraphV2",
        }));
      }
    }

    const reproducedStories = produceStoryPlanV2({
      productSpec: productResult.data,
      designGraph: graphResult.data,
      buildTopology: topologyResult.data,
    });
    if (reproducedStories.status === "rejected") {
      diagnostics.push(...reproducedStories.diagnostics);
    } else if (
      canonicalJsonStringify(reproducedStories.storyPlan)
      !== canonicalJsonStringify(storiesResult.data)
    ) {
      diagnostics.push(diagnostic({
        code: "CONTRACT_V3_STORY_PLAN_PROJECTION_MISMATCH",
        message: "StoryPlanV2 is not the exact deterministic partition of the supplied product, design, and topology authorities",
        reference: "storyPlanV2",
      }));
    }

    const runtimeDataHash = topologyResult.data.runtimeDataContractHash;
    const runtimeEvidenceHash = topologyResult.data.runtimeEvidenceContractHash;
    if ((runtimeDataHash === undefined) !== (runtimeEvidenceHash === undefined)) {
      diagnostics.push(diagnostic({
        code: "CONTRACT_V3_RUNTIME_CONTRACT_PAIR_MISMATCH",
        message: "BuildTopologyV1 must provide runtime-data and runtime-evidence contract hashes together",
        reference: runtimeDataHash === undefined
          ? "runtimeDataContractHash"
          : "runtimeEvidenceContractHash",
      }));
    }
  }

  const sortedDiagnostics = sortCompilationDiagnostics(diagnostics);
  const rejectionCodes = uniqueSorted(
    sortedDiagnostics.filter((item) => item.severity === "error").map((item) => item.code),
  );
  const inputHashes = uniqueSorted(Object.values(rawHashes));
  let packet: ProductBuildPacketV3 | undefined;
  let packetHash: string | undefined;
  if (
    rejectionCodes.length === 0
    && productResult.success
    && graphResult.success
    && topologyResult.success
    && storiesResult.success
    && closureResult.success
    && sourceMapResult.status === "produced"
  ) {
    packet = ProductBuildPacketV3Schema.parse({
      schema: "setfarm.product-build-packet.v3",
      packetVersion: 3,
      parentPacketHashes: uniqueSorted(parentPacketHashes),
      designSourceKind: closureResult.data.kind,
      productSpecV2Hash: artifactHashes.productSpecV2,
      designGraphV2Hash: artifactHashes.designGraphV2,
      buildTopologyV1Hash: artifactHashes.buildTopologyV1,
      storyPlanV2Hash: artifactHashes.storyPlanV2,
      ...(topologyResult.data.runtimeDataContractHash
        ? { runtimeDataContractHash: topologyResult.data.runtimeDataContractHash }
        : {}),
      ...(topologyResult.data.runtimeEvidenceContractHash
        ? { runtimeEvidenceContractHash: topologyResult.data.runtimeEvidenceContractHash }
        : {}),
      designSourceClosureV2Hash: artifactHashes.designSourceClosureV2,
      implementationSourceMapV1Hash: artifactHashes.implementationSourceMapV1,
      compiler,
      validationIds: [...VALIDATION_IDS_V3],
    });
    packetHash = await storeChild(
      input.artifactStore,
      "setfarm.product-build-packet.v3",
      producer,
      packet,
    );
  }

  const reportArtifactHashes = {
    ...(artifactHashes.productSpecV2
      ? { productSpecV2: artifactHashes.productSpecV2 }
      : {}),
    ...(artifactHashes.designGraphV2 !== undefined
      ? { designGraphV2: artifactHashes.designGraphV2 }
      : {}),
    ...(artifactHashes.buildTopologyV1
      ? { buildTopologyV1: artifactHashes.buildTopologyV1 }
      : {}),
    ...(artifactHashes.storyPlanV2
      ? { storyPlanV2: artifactHashes.storyPlanV2 }
      : {}),
    ...(artifactHashes.designSourceClosureV2
      ? { designSourceClosureV2: artifactHashes.designSourceClosureV2 }
      : {}),
    ...(artifactHashes.implementationSourceMapV1
      ? { implementationSourceMapV1: artifactHashes.implementationSourceMapV1 }
      : {}),
  };
  const report = ProductCompilationReportV3Schema.parse(rejectionCodes.length > 0 ? {
    schema: "setfarm.product-compilation-report.v3",
    status: "rejected",
    compiler,
    inputHashes,
    artifactHashes: reportArtifactHashes,
    diagnostics: sortedDiagnostics,
    validationIds: [...VALIDATION_IDS_V3],
    rejectionCodes,
  } : {
    schema: "setfarm.product-compilation-report.v3",
    status: "sealed",
    compiler,
    inputHashes,
    artifactHashes: reportArtifactHashes,
    diagnostics: sortedDiagnostics,
    validationIds: [...VALIDATION_IDS_V3],
    packetHash,
  });
  const reportHash = await storeChild(
    input.artifactStore,
    "setfarm.product-compilation-report.v3",
    producer,
    report,
  );
  return {
    status: report.status,
    report,
    reportHash,
    artifactHashes,
    ...(packet ? { packet } : {}),
    ...(packetHash ? { packetHash } : {}),
  };
}
