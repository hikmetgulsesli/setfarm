import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import {
  DesignInteractionGraphV2Schema,
  type DesignInteractionGraphV2,
} from "../schemas/design-interaction-graph-v2.js";
import {
  ProductSpecV2Schema,
  type ProductActionV2,
  type ProductSpecV2,
} from "../schemas/product-spec-v2.js";

const StoryPartitionInputV2Schema = z.object({
  productSpec: ProductSpecV2Schema,
  designGraph: DesignInteractionGraphV2Schema.nullable().optional(),
}).strict();

export type ProductStoryPartitionV2 = Readonly<{
  componentHash: string;
  routeRefs: string[];
  surfaceRefs: string[];
  controlSlotRefs: string[];
  controlRefs: string[];
  actionRefs: string[];
  observableRefs: string[];
  stateRefs: string[];
  persistenceRefs: string[];
  evidenceRefs: string[];
}>;

export type StoryPartitionResultV2 =
  | Readonly<{
      status: "produced";
      productSpec: ProductSpecV2;
      designGraph: DesignInteractionGraphV2 | null;
      components: ProductStoryPartitionV2[];
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
    }>;

type SemanticKind =
  | "route"
  | "surface"
  | "control_slot"
  | "control"
  | "action"
  | "observable"
  | "state"
  | "persistence"
  | "evidence";

class DisjointSemanticSet {
  private readonly parent = new Map<string, string>();

  add(value: string): void {
    if (!this.parent.has(value)) this.parent.set(value, value);
  }

  find(value: string): string {
    const parent = this.parent.get(value);
    if (!parent) throw new Error(`Unknown v2 semantic partition node ${value}`);
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent.set(value, root);
    return root;
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot === rightRoot) return;
    const [root, child] = leftRoot < rightRoot
      ? [leftRoot, rightRoot]
      : [rightRoot, leftRoot];
    this.parent.set(child, root);
  }

  unionAll(values: readonly string[]): void {
    const first = values[0];
    if (!first) return;
    values.slice(1).forEach((value) => this.union(first, value));
  }
}

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function node(kind: SemanticKind, reference: string): string {
  return `${kind}\0${reference}`;
}

function diagnostic(input: {
  code: string;
  message: string;
  reference?: string;
  category?: CompilationDiagnosticV1["category"];
}): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code: input.code,
    category: input.category ?? "contract",
    severity: "error",
    message: input.message.slice(0, 2_000),
    ...(input.reference ? { reference: input.reference.slice(0, 160) } : {}),
    provenance: [],
    suggestions: [],
  });
}

function reject(diagnostics: readonly CompilationDiagnosticV1[]): StoryPartitionResultV2 {
  const sorted = sortCompilationDiagnostics(diagnostics).slice(0, 10_000);
  return {
    status: "rejected",
    rejectionCodes: uniqueSorted(sorted.map((item) => item.code)),
    diagnostics: sorted,
  };
}

function exactSetDiagnostics(input: {
  expected: readonly string[];
  observed: readonly string[];
  code: string;
  label: string;
}): CompilationDiagnosticV1[] {
  const expected = uniqueSorted(input.expected);
  const observed = uniqueSorted(input.observed);
  if (JSON.stringify(expected) === JSON.stringify(observed)) return [];
  return [diagnostic({
    code: input.code,
    category: "link",
    message: `${input.label} must exactly equal the canonical ProductSpec v2 reference set`,
    reference: input.label,
  })];
}

function actionStateRefs(action: ProductActionV2): string[] {
  return uniqueSorted([
    ...action.preconditions.map((item) => item.stateRef),
    ...action.stateDeltas.map((item) => item.stateRef),
    ...action.stateDeltas.flatMap((item) =>
      item.valueFrom.kind === "state" ? [item.valueFrom.stateRef] : []),
    ...action.persistenceEffects.flatMap((effect) =>
      effect.statePaths.map((statePath) => statePath.stateRef)),
    ...action.success.stateRefs,
    ...action.failure.stateRefs,
  ]);
}

function actionPersistenceRefs(action: ProductActionV2): string[] {
  return uniqueSorted([
    ...action.persistenceEffects.map((item) => item.policyRef),
    ...(action.success.persistenceRefs ?? []),
    ...(action.failure.persistenceRefs ?? []),
  ]);
}

function validateDesignGraph(
  productSpec: ProductSpecV2,
  designGraph: DesignInteractionGraphV2 | null,
): CompilationDiagnosticV1[] {
  if (!designGraph) return [];
  const diagnostics: CompilationDiagnosticV1[] = [];
  if (designGraph.productSpecHash !== hashCanonicalJson(productSpec)) {
    diagnostics.push(diagnostic({
      code: "STORY_PARTITION_V2_DESIGN_GRAPH_PRODUCT_HASH_MISMATCH",
      category: "link",
      message: "DesignInteractionGraphV2 does not bind the exact ProductSpecV2 input",
    }));
  }
  diagnostics.push(
    ...exactSetDiagnostics({
      expected: productSpec.surfaces.map((surface) => surface.id),
      observed: designGraph.surfaces.map((surface) => surface.surfaceRef),
      code: "STORY_PARTITION_V2_DESIGN_SURFACE_SET_MISMATCH",
      label: "Design surfaces",
    }),
    ...exactSetDiagnostics({
      expected: productSpec.actions.map((action) => action.id),
      observed: designGraph.actions.map((action) => action.actionRef),
      code: "STORY_PARTITION_V2_DESIGN_ACTION_SET_MISMATCH",
      label: "Design actions",
    }),
    ...exactSetDiagnostics({
      expected: productSpec.actions.flatMap((action) =>
        action.controlPlacements.map((placement) => placement.id)),
      observed: designGraph.controls.map((control) => control.identity.controlSlotRef),
      code: "STORY_PARTITION_V2_DESIGN_CONTROL_SLOT_SET_MISMATCH",
      label: "Design physical-control slots",
    }),
    ...exactSetDiagnostics({
      expected: productSpec.actions.flatMap((action) =>
        action.observableEffects.map((observable) => observable.id)),
      observed: designGraph.observables.map((observable) => observable.observableRef),
      code: "STORY_PARTITION_V2_DESIGN_OBSERVABLE_SET_MISMATCH",
      label: "Design observables",
    }),
  );
  const actionById = new Map(productSpec.actions.map((action) => [action.id, action] as const));
  const surfaceById = new Map(productSpec.surfaces.map((surface) => [surface.id, surface] as const));
  const placementById = new Map(productSpec.actions.flatMap((action) =>
    action.controlPlacements.map((placement) => [placement.id, { action, placement }] as const)));
  designGraph.surfaces.forEach((surface) => {
    const productSurface = surfaceById.get(surface.surfaceRef);
    if (!productSurface || surface.productSurfaceHash !== hashCanonicalJson(productSurface)) {
      diagnostics.push(diagnostic({
        code: "STORY_PARTITION_V2_DESIGN_SURFACE_HASH_MISMATCH",
        category: "link",
        message: `Design surface ${surface.surfaceRef} lost its exact ProductSpec surface hash`,
        reference: surface.surfaceRef,
      }));
    }
  });
  designGraph.actions.forEach((binding) => {
    const action = actionById.get(binding.actionRef);
    if (!action || binding.productActionHash !== hashCanonicalJson(action)) {
      diagnostics.push(diagnostic({
        code: "STORY_PARTITION_V2_DESIGN_ACTION_HASH_MISMATCH",
        category: "link",
        message: `Design action ${binding.actionRef} lost its exact ProductSpec action hash`,
        reference: binding.actionRef,
      }));
    }
  });
  designGraph.controls.forEach((control) => {
    const owner = placementById.get(control.identity.controlSlotRef);
    if (
      !owner
      || owner.action.id !== control.identity.actionRef
      || owner.placement.surfaceRef !== control.identity.surfaceRef
      || control.controlPlacementHash !== hashCanonicalJson(owner.placement)
    ) {
      diagnostics.push(diagnostic({
        code: "STORY_PARTITION_V2_DESIGN_CONTROL_CONTRACT_MISMATCH",
        category: "link",
        message: `Physical control ${control.id} is not the exact ProductSpec control placement`,
        reference: control.id,
      }));
    }
  });
  const observableById = new Map(productSpec.actions.flatMap((action) =>
    action.observableEffects.map((observable) => [observable.id, { action, observable }] as const)));
  designGraph.observables.forEach((binding) => {
    const owner = observableById.get(binding.observableRef);
    if (
      !owner
      || owner.action.id !== binding.actionRef
      || binding.productObservableHash !== hashCanonicalJson(owner.observable)
    ) {
      diagnostics.push(diagnostic({
        code: "STORY_PARTITION_V2_DESIGN_OBSERVABLE_CONTRACT_MISMATCH",
        category: "link",
        message: `Design observable ${binding.observableRef} is not the exact ProductSpec observable`,
        reference: binding.observableRef,
      }));
    }
  });
  return diagnostics;
}

function entityConsumers(productSpec: ProductSpecV2): Map<string, string[]> {
  const entityByField = new Map(productSpec.entities.flatMap((entity) =>
    entity.fields.map((field) => [field.id, entity.id] as const)));
  const policyById = new Map(productSpec.persistencePolicies.map((policy) => [policy.id, policy] as const));
  const result = new Map<string, string[]>();
  productSpec.actions.forEach((action) => {
    const refs = uniqueSorted([
      ...action.input.fields.flatMap((field) => {
        const entityRef = field.entityFieldRef ? entityByField.get(field.entityFieldRef) : undefined;
        return entityRef ? [entityRef] : [];
      }),
      ...action.stateDeltas.flatMap((delta) =>
        delta.valueFrom.kind === "entity_field" ? [delta.valueFrom.entityRef] : []),
      ...action.persistenceEffects.flatMap((effect) => [
        ...(effect.entityRef ? [effect.entityRef] : []),
        ...(policyById.get(effect.policyRef)?.entityRefs ?? []),
      ]),
    ]);
    refs.forEach((reference) => {
      const consumers = result.get(reference) ?? [];
      consumers.push(action.id);
      result.set(reference, consumers);
    });
  });
  return result;
}

/**
 * Partitions only canonical ProductSpecV2 and exact optional design-graph
 * identities. Affected surfaces create semantic connectivity, never slots or
 * physical controls.
 */
export function produceStoryPartitionV2(input: unknown): StoryPartitionResultV2 {
  const parsed = StoryPartitionInputV2Schema.safeParse(input);
  if (!parsed.success) {
    return reject(parsed.error.issues.slice(0, 200).map((issue) => diagnostic({
      code: "STORY_PARTITION_V2_INPUT_INVALID",
      category: "configuration",
      message: `Story partition v2 input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      reference: issue.path.join("/") || "$",
    })));
  }
  const productSpec = parsed.data.productSpec;
  const designGraph = parsed.data.designGraph ?? null;
  const designDiagnostics = validateDesignGraph(productSpec, designGraph);
  if (designDiagnostics.length > 0) return reject(designDiagnostics);

  const partition = new DisjointSemanticSet();
  const refsByKind: Record<SemanticKind, string[]> = {
    route: productSpec.routes.map((item) => item.id),
    surface: productSpec.surfaces.map((item) => item.id),
    control_slot: productSpec.actions.flatMap((action) =>
      action.controlPlacements.map((placement) => placement.id)),
    control: designGraph?.controls.map((control) => control.id) ?? [],
    action: productSpec.actions.map((item) => item.id),
    observable: productSpec.actions.flatMap((action) =>
      action.observableEffects.map((observable) => observable.id)),
    state: productSpec.states.map((item) => item.id),
    persistence: productSpec.persistencePolicies.map((item) => item.id),
    evidence: productSpec.evidencePredicates.filter((item) => item.required).map((item) => item.id),
  };
  (Object.entries(refsByKind) as Array<[SemanticKind, string[]]>).forEach(([kind, refs]) =>
    refs.forEach((reference) => partition.add(node(kind, reference))));

  productSpec.routes.forEach((route) => partition.unionAll([
    node("route", route.id),
    ...route.surfaceRefs.map((surfaceRef) => node("surface", surfaceRef)),
  ]));
  const requiredEvidence = new Set(refsByKind.evidence);
  productSpec.actions.forEach((action) => {
    const actionNode = node("action", action.id);
    action.controlPlacements.forEach((placement) => partition.unionAll([
      actionNode,
      node("control_slot", placement.id),
      node("surface", placement.surfaceRef),
    ]));
    action.affectedSurfaceRefs.forEach((surfaceRef) =>
      partition.union(actionNode, node("surface", surfaceRef)));
    action.observableEffects.forEach((observable) => {
      partition.union(actionNode, node("observable", observable.id));
      const selector = observable.selector;
      partition.union(
        node("observable", observable.id),
        selector.kind === "control"
          ? node("control_slot", selector.controlSlotRef)
          : node("surface", selector.surfaceRef),
      );
    });
    actionStateRefs(action).forEach((reference) =>
      partition.union(actionNode, node("state", reference)));
    actionPersistenceRefs(action).forEach((reference) =>
      partition.union(actionNode, node("persistence", reference)));
    uniqueSorted([
      ...action.evidenceRefs,
      ...action.success.evidenceRefs,
      ...action.failure.evidenceRefs,
      ...action.observableEffects.map((observable) => observable.evidenceRef),
    ]).filter((reference) => requiredEvidence.has(reference)).forEach((reference) =>
      partition.union(actionNode, node("evidence", reference)));
    if (action.navigation.kind === "route") {
      partition.union(actionNode, node("route", action.navigation.routeRef));
    }
    action.evidenceScenario.prerequisiteSteps.forEach((step) =>
      partition.union(actionNode, node("action", step.actionRef)));
  });

  productSpec.persistencePolicies.forEach((policy) => {
    if (policy.rehydration.kind === "action") {
      partition.union(node("persistence", policy.id), node("action", policy.rehydration.actionRef));
    }
  });
  designGraph?.controls.forEach((control) => partition.unionAll([
    node("control", control.id),
    node("control_slot", control.identity.controlSlotRef),
    node("action", control.identity.actionRef),
    node("surface", control.identity.surfaceRef),
  ]));

  const entityConsumerMap = entityConsumers(productSpec);
  const diagnostics: CompilationDiagnosticV1[] = [];
  productSpec.evidencePredicates.filter((predicate) => predicate.required).forEach((predicate) => {
    const evidenceNode = node("evidence", predicate.id);
    const directKinds: SemanticKind[] = [
      "action", "route", "surface", "state", "persistence", "observable",
    ];
    const directKind = directKinds.find((kind) => refsByKind[kind].includes(predicate.subjectRef));
    if (directKind) {
      partition.union(evidenceNode, node(directKind, predicate.subjectRef));
      return;
    }
    const consumers = entityConsumerMap.get(predicate.subjectRef) ?? [];
    if (consumers.length > 0) {
      consumers.forEach((actionRef) => partition.union(evidenceNode, node("action", actionRef)));
      return;
    }
    diagnostics.push(diagnostic({
      code: "STORY_PARTITION_V2_REQUIRED_EVIDENCE_UNOWNED",
      message: `Required evidence ${predicate.id} has no implementable semantic owner`,
      reference: predicate.id,
    }));
  });

  const grouped = new Map<string, Record<SemanticKind, string[]>>();
  (Object.entries(refsByKind) as Array<[SemanticKind, string[]]>).forEach(([kind, refs]) => {
    refs.forEach((reference) => {
      const root = partition.find(node(kind, reference));
      const group = grouped.get(root) ?? {
        route: [], surface: [], control_slot: [], control: [], action: [],
        observable: [], state: [], persistence: [], evidence: [],
      };
      group[kind].push(reference);
      grouped.set(root, group);
    });
  });

  const components = [...grouped.values()].map((group): ProductStoryPartitionV2 => {
    const value = {
      routeRefs: uniqueSorted(group.route),
      surfaceRefs: uniqueSorted(group.surface),
      controlSlotRefs: uniqueSorted(group.control_slot),
      controlRefs: uniqueSorted(group.control),
      actionRefs: uniqueSorted(group.action),
      observableRefs: uniqueSorted(group.observable),
      stateRefs: uniqueSorted(group.state),
      persistenceRefs: uniqueSorted(group.persistence),
      evidenceRefs: uniqueSorted(group.evidence),
    };
    return { componentHash: hashCanonicalJson(value), ...value };
  }).sort((left, right) =>
    compareUtf16(left.routeRefs[0] ?? "", right.routeRefs[0] ?? "")
    || compareUtf16(left.actionRefs[0] ?? "", right.actionRefs[0] ?? "")
    || compareUtf16(left.componentHash, right.componentHash));

  components.forEach((component) => {
    if (component.actionRefs.length === 0) {
      diagnostics.push(diagnostic({
        code: "STORY_PARTITION_V2_COMPONENT_ACTION_MISSING",
        message: `Semantic component ${component.componentHash} has no executable ProductSpec action`,
        reference: component.surfaceRefs[0] ?? component.componentHash,
      }));
    }
    if (component.observableRefs.length === 0) {
      diagnostics.push(diagnostic({
        code: "STORY_PARTITION_V2_COMPONENT_OBSERVABLE_MISSING",
        message: `Semantic component ${component.componentHash} has no ProductSpec observable evidence`,
        reference: component.actionRefs[0] ?? component.componentHash,
      }));
    }
    if (component.evidenceRefs.length === 0) {
      diagnostics.push(diagnostic({
        code: "STORY_PARTITION_V2_COMPONENT_REQUIRED_EVIDENCE_MISSING",
        message: `Semantic component ${component.componentHash} has no required completion evidence`,
        reference: component.actionRefs[0] ?? component.componentHash,
      }));
    }
  });
  if (diagnostics.length > 0) return reject(diagnostics);

  // Schema validation plus exact graph set validation guarantees that every
  // affected surface contributed only connectivity: slots and controls came
  // exclusively from controlPlacements and graph controls.
  return { status: "produced", productSpec, designGraph, components, diagnostics: [] };
}
