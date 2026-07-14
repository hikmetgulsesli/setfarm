import { z } from "zod";

import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import {
  ProductSpecV1Schema,
  type ProductActionV1,
  type ProductSpecV1,
} from "../schemas/product-spec-v1.js";

const StoryPartitionInputSchema = z
  .object({ productSpec: ProductSpecV1Schema })
  .strict();

export type ProductStoryPartitionV1 = Readonly<{
  id: string;
  order: number;
  title: string;
  description: string;
  dependsOn: string[];
  surfaceRefs: string[];
  actionRefs: string[];
  stateRefs: string[];
  persistenceRefs: string[];
  evidenceRefs: string[];
}>;

export type StoryPartitionResult =
  | Readonly<{
      status: "produced";
      stories: ProductStoryPartitionV1[];
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
    }>;

class DisjointSet {
  private readonly parent = new Map<string, string>();

  constructor(values: readonly string[]) {
    values.forEach((value) => this.parent.set(value, value));
  }

  find(value: string): string {
    const parent = this.parent.get(value);
    if (!parent) throw new Error(`Unknown partition node ${value}`);
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

function reject(diagnostics: readonly CompilationDiagnosticV1[]): StoryPartitionResult {
  const sorted = sortCompilationDiagnostics(diagnostics).slice(0, 10_000);
  return {
    status: "rejected",
    rejectionCodes: [...new Set(sorted.map((item) => item.code))].sort(),
    diagnostics: sorted,
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function actionStateRefs(action: ProductActionV1): string[] {
  return unique([
    ...action.preconditions.map((item) => item.stateRef),
    ...action.stateDeltas.map((item) => item.stateRef),
    ...action.stateDeltas.flatMap((item) =>
      item.valueFrom.kind === "state" ? [item.valueFrom.stateRef] : []),
    ...action.success.stateRefs,
    ...action.failure.stateRefs,
  ]);
}

function actionPersistenceRefs(action: ProductActionV1): string[] {
  return unique([
    ...action.persistenceEffects.map((item) => item.policyRef),
    ...(action.success.persistenceRefs ?? []),
    ...(action.failure.persistenceRefs ?? []),
  ]);
}

function actionEvidenceRefs(action: ProductActionV1): string[] {
  return unique([
    ...action.evidenceRefs,
    ...action.success.evidenceRefs,
    ...action.failure.evidenceRefs,
  ]);
}

function addConsumer(
  consumers: Map<string, string[]>,
  reference: string,
  actionId: string,
): void {
  const current = consumers.get(reference) ?? [];
  current.push(actionId);
  consumers.set(reference, current);
}

function actionEntityRefs(
  productSpec: ProductSpecV1,
  action: ProductActionV1,
): string[] {
  const entityByField = new Map(productSpec.entities.flatMap((entity) =>
    entity.fields.map((field) => [field.id, entity.id] as const)));
  const policyById = new Map(productSpec.persistencePolicies.map((policy) => [policy.id, policy]));
  return unique([
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
}

function actionSurfaces(
  actionById: ReadonlyMap<string, ProductActionV1>,
  actionIds: readonly string[],
): string[] {
  return unique(actionIds.flatMap((actionId) => actionById.get(actionId)?.surfaceRefs ?? []));
}

function ownerSurfacesForSubject(input: {
  productSpec: ProductSpecV1;
  subjectRef: string;
  actionById: ReadonlyMap<string, ProductActionV1>;
  stateConsumers: ReadonlyMap<string, string[]>;
  persistenceConsumers: ReadonlyMap<string, string[]>;
  entityConsumers: ReadonlyMap<string, string[]>;
}): string[] {
  const action = input.actionById.get(input.subjectRef);
  if (action) return action.surfaceRefs;
  const surface = input.productSpec.surfaces.find((item) => item.id === input.subjectRef);
  if (surface) return [surface.id];
  const route = input.productSpec.routes.find((item) => item.id === input.subjectRef);
  if (route) return route.surfaceRefs;
  const consumers = input.stateConsumers.get(input.subjectRef)
    ?? input.persistenceConsumers.get(input.subjectRef)
    ?? input.entityConsumers.get(input.subjectRef)
    ?? [];
  return actionSurfaces(input.actionById, consumers);
}

function semanticConsumers(productSpec: ProductSpecV1): {
  state: Map<string, string[]>;
  persistence: Map<string, string[]>;
  evidence: Map<string, string[]>;
  entity: Map<string, string[]>;
} {
  const state = new Map<string, string[]>();
  const persistence = new Map<string, string[]>();
  const evidence = new Map<string, string[]>();
  const entity = new Map<string, string[]>();
  productSpec.actions.forEach((action) => {
    actionStateRefs(action).forEach((reference) => addConsumer(state, reference, action.id));
    actionPersistenceRefs(action).forEach((reference) => addConsumer(persistence, reference, action.id));
    actionEvidenceRefs(action).forEach((reference) => addConsumer(evidence, reference, action.id));
    actionEntityRefs(productSpec, action).forEach((reference) => addConsumer(entity, reference, action.id));
  });
  return { state, persistence, evidence, entity };
}

function componentForConsumers(input: {
  reference: string;
  consumers: ReadonlyMap<string, string[]>;
  actionById: ReadonlyMap<string, ProductActionV1>;
  partition: DisjointSet;
}): string | undefined {
  const surfaces = actionSurfaces(input.actionById, input.consumers.get(input.reference) ?? []);
  if (surfaces.length === 0) return undefined;
  return input.partition.find(surfaces[0]!);
}

function pushByRoot(
  target: Map<string, string[]>,
  root: string,
  reference: string,
): void {
  const current = target.get(root) ?? [];
  current.push(reference);
  target.set(root, current);
}

/**
 * Compiles ProductSpec semantics into the smallest deterministic story
 * components that can each own an exact, closed action contract. Shared
 * state/persistence/evidence joins components instead of becoming prose-only
 * coordination between independent implementation agents.
 */
export function produceStoryPartitionV1(input: unknown): StoryPartitionResult {
  const parsed = StoryPartitionInputSchema.safeParse(input);
  if (!parsed.success) {
    return reject(parsed.error.issues.slice(0, 200).map((issue) => diagnostic({
      code: "STORY_PARTITION_INPUT_INVALID",
      category: "configuration",
      message: `Typed story partition input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      reference: issue.path.join("/") || "$",
    })));
  }

  const productSpec = parsed.data.productSpec;
  const partition = new DisjointSet(productSpec.surfaces.map((surface) => surface.id));
  const actionById = new Map(productSpec.actions.map((action) => [action.id, action]));
  const routeById = new Map(productSpec.routes.map((route) => [route.id, route]));
  const consumers = semanticConsumers(productSpec);

  productSpec.routes.forEach((route) => partition.unionAll(route.surfaceRefs));
  productSpec.actions.forEach((action) => {
    partition.unionAll(action.surfaceRefs);
    if (action.navigation.kind === "route") {
      partition.unionAll([
        ...action.surfaceRefs,
        ...(routeById.get(action.navigation.routeRef)?.surfaceRefs ?? []),
      ]);
    }
  });
  for (const consumerMap of [consumers.state, consumers.persistence, consumers.entity]) {
    consumerMap.forEach((actionIds) => partition.unionAll(actionSurfaces(actionById, actionIds)));
  }
  productSpec.evidencePredicates.forEach((predicate) => {
    const evidenceSurfaces = actionSurfaces(actionById, consumers.evidence.get(predicate.id) ?? []);
    const subjectSurfaces = ownerSurfacesForSubject({
      productSpec,
      subjectRef: predicate.subjectRef,
      actionById,
      stateConsumers: consumers.state,
      persistenceConsumers: consumers.persistence,
      entityConsumers: consumers.entity,
    });
    partition.unionAll([...evidenceSurfaces, ...subjectSurfaces]);
  });

  const diagnostics: CompilationDiagnosticV1[] = [];
  const surfacesByRoot = new Map<string, string[]>();
  const actionsByRoot = new Map<string, string[]>();
  const statesByRoot = new Map<string, string[]>();
  const persistenceByRoot = new Map<string, string[]>();
  const evidenceByRoot = new Map<string, string[]>();
  productSpec.surfaces.forEach((surface) =>
    pushByRoot(surfacesByRoot, partition.find(surface.id), surface.id));
  productSpec.actions.forEach((action) =>
    pushByRoot(actionsByRoot, partition.find(action.surfaceRefs[0]!), action.id));

  const assignConsumerRefs = (
    values: readonly { id: string }[],
    consumerMap: ReadonlyMap<string, string[]>,
    target: Map<string, string[]>,
    unownedCode: string,
    label: string,
  ) => {
    values.forEach((value) => {
      const root = componentForConsumers({
        reference: value.id,
        consumers: consumerMap,
        actionById,
        partition,
      });
      if (!root) {
        diagnostics.push(diagnostic({
          code: unownedCode,
          message: `${label} ${value.id} has no action-derived story owner`,
          reference: value.id,
        }));
        return;
      }
      pushByRoot(target, root, value.id);
    });
  };
  assignConsumerRefs(
    productSpec.states,
    consumers.state,
    statesByRoot,
    "STORY_PARTITION_STATE_UNOWNED",
    "State",
  );
  assignConsumerRefs(
    productSpec.persistencePolicies,
    consumers.persistence,
    persistenceByRoot,
    "STORY_PARTITION_PERSISTENCE_UNOWNED",
    "Persistence policy",
  );
  productSpec.evidencePredicates.forEach((predicate) => {
    const surfaces = unique([
      ...actionSurfaces(actionById, consumers.evidence.get(predicate.id) ?? []),
      ...ownerSurfacesForSubject({
        productSpec,
        subjectRef: predicate.subjectRef,
        actionById,
        stateConsumers: consumers.state,
        persistenceConsumers: consumers.persistence,
        entityConsumers: consumers.entity,
      }),
    ]);
    if (surfaces.length === 0) {
      diagnostics.push(diagnostic({
        code: "STORY_PARTITION_EVIDENCE_UNOWNED",
        message: `Evidence ${predicate.id} has no action or semantic subject story owner`,
        reference: predicate.id,
      }));
      return;
    }
    pushByRoot(evidenceByRoot, partition.find(surfaces[0]!), predicate.id);
  });

  const surfaceIndex = new Map(productSpec.surfaces.map((surface, index) => [surface.id, index]));
  const components = [...surfacesByRoot.entries()]
    .map(([root, surfaceRefs]) => ({
      root,
      surfaceRefs,
      minIndex: Math.min(...surfaceRefs.map((reference) => surfaceIndex.get(reference) ?? Number.MAX_SAFE_INTEGER)),
    }))
    .sort((left, right) => left.minIndex - right.minIndex || (left.root < right.root ? -1 : 1));
  components.forEach((component) => {
    if ((actionsByRoot.get(component.root) ?? []).length === 0) {
      diagnostics.push(diagnostic({
        code: "STORY_PARTITION_COMPONENT_ACTION_MISSING",
        message: `Surface component ${component.surfaceRefs.join(", ")} has no executable action`,
        reference: component.surfaceRefs[0],
      }));
    }
  });
  if (diagnostics.length > 0) return reject(diagnostics);

  const surfaceById = new Map(productSpec.surfaces.map((surface) => [surface.id, surface]));
  const stories = components.map((component, index): ProductStoryPartitionV1 => {
    const id = `US-${String(index + 1).padStart(3, "0")}`;
    const names = component.surfaceRefs.map((reference) => surfaceById.get(reference)!.name);
    const actionRefs = actionsByRoot.get(component.root) ?? [];
    const actionNames = actionRefs.map((reference) => actionById.get(reference)!.name);
    return {
      id,
      order: index + 1,
      title: `Implement ${names.join(" and ")}`.slice(0, 500),
      description: `Implement the exact action contract for ${actionNames.join(", ")}.`.slice(0, 10_000),
      dependsOn: index === 0 ? [] : ["US-001"],
      surfaceRefs: [...component.surfaceRefs],
      actionRefs: [...actionRefs],
      stateRefs: [...(statesByRoot.get(component.root) ?? [])],
      persistenceRefs: [...(persistenceByRoot.get(component.root) ?? [])],
      evidenceRefs: [...(evidenceByRoot.get(component.root) ?? [])],
    };
  });
  return { status: "produced", stories, diagnostics: [] };
}
