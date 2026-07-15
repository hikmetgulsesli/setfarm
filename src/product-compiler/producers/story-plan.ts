import { z } from "zod";

import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import {
  BuildTopologyV1Schema,
  type BuildTopologyV1,
} from "../schemas/build-topology-v1.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import {
  DesignInteractionGraphV1Schema,
  type DesignInteractionGraphV1,
} from "../schemas/design-interaction-graph-v1.js";
import {
  ProductSpecV1Schema,
  type ProductActionV1,
  type ProductSpecV1,
} from "../schemas/product-spec-v1.js";
import {
  ProductStoryV1Schema,
  StoryPlanV1Schema,
  type StoryPlanV1,
} from "../schemas/story-plan-v1.js";

const StoryDefinitionSchema = z
  .object({
    id: ProductStoryV1Schema.shape.id,
    order: ProductStoryV1Schema.shape.order,
    title: ProductStoryV1Schema.shape.title,
    description: ProductStoryV1Schema.shape.description,
    dependsOn: ProductStoryV1Schema.shape.dependsOn,
    surfaceRefs: ProductStoryV1Schema.shape.surfaceRefs,
    controlRefs: ProductStoryV1Schema.shape.controlRefs,
    actionRefs: ProductStoryV1Schema.shape.actionRefs,
    stateRefs: ProductStoryV1Schema.shape.stateRefs,
    persistenceRefs: ProductStoryV1Schema.shape.persistenceRefs,
    evidenceRefs: ProductStoryV1Schema.shape.evidenceRefs,
  })
  .strict();

const StoryPlanProducerInputSchema = z
  .object({
    productSpec: ProductSpecV1Schema,
    designGraph: DesignInteractionGraphV1Schema,
    buildTopology: BuildTopologyV1Schema,
    stories: z.array(StoryDefinitionSchema).min(1).max(5_000),
  })
  .strict();

export type StoryPlanProducerInput = z.input<typeof StoryPlanProducerInputSchema>;

export type StoryPlanProducerResult =
  | Readonly<{
      status: "produced";
      storyPlan: StoryPlanV1;
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
    }>;

type ParsedInput = z.infer<typeof StoryPlanProducerInputSchema>;
type StoryDefinition = ParsedInput["stories"][number];
type SemanticField =
  | "surfaceRefs"
  | "controlRefs"
  | "actionRefs"
  | "stateRefs"
  | "persistenceRefs"
  | "evidenceRefs";

function diagnostic(input: {
  code: string;
  category?: CompilationDiagnosticV1["category"];
  message: string;
  reference?: string;
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

function reject(diagnostics: readonly CompilationDiagnosticV1[]): StoryPlanProducerResult {
  const sorted = sortCompilationDiagnostics(diagnostics).slice(0, 10_000);
  return {
    status: "rejected",
    rejectionCodes: [...new Set(sorted.map((item) => item.code))].sort(),
    diagnostics: sorted,
  };
}

function inputDiagnostics(error: z.ZodError): CompilationDiagnosticV1[] {
  return error.issues.slice(0, 200).map((issue) => diagnostic({
    code: "STORY_PLAN_INPUT_INVALID",
    category: "configuration",
    message: `Typed story-plan input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
    reference: issue.path.join("/") || "$",
  }));
}

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function semanticOwners(
  stories: readonly StoryDefinition[],
  field: SemanticField,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  stories.forEach((story) => {
    story[field].forEach((reference) => {
      const owners = result.get(reference) ?? [];
      owners.push(story.id);
      result.set(reference, owners);
    });
  });
  return result;
}

function exactPartitionDiagnostics(input: {
  stories: readonly StoryDefinition[];
  field: SemanticField;
  expected: readonly string[];
  label: string;
}): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const expected = new Set(input.expected);
  const owners = semanticOwners(input.stories, input.field);
  input.expected.forEach((reference) => {
    const storyRefs = owners.get(reference) ?? [];
    if (storyRefs.length === 0) {
      diagnostics.push(diagnostic({
        code: `STORY_PLAN_${input.label}_UNOWNED`,
        message: `${input.label} ${reference} has no exact story disposition`,
        reference,
      }));
    } else if (storyRefs.length > 1) {
      diagnostics.push(diagnostic({
        code: `STORY_PLAN_${input.label}_MULTIPLE_OWNERS`,
        message: `${input.label} ${reference} is assigned to multiple stories: ${storyRefs.join(", ")}`,
        reference,
      }));
    }
  });
  owners.forEach((_storyRefs, reference) => {
    if (!expected.has(reference)) {
      diagnostics.push(diagnostic({
        code: `STORY_PLAN_${input.label}_REF_UNRESOLVED`,
        category: "link",
        message: `${input.label} reference ${reference} is absent from its canonical artifact`,
        reference,
      }));
    }
  });
  return diagnostics;
}

function soleOwner(owners: ReadonlyMap<string, string[]>, reference: string): string | undefined {
  const values = owners.get(reference) ?? [];
  return values.length === 1 ? values[0] : undefined;
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

function requiredActionEvidenceRefs(
  action: ProductActionV1,
  requiredEvidenceIds: ReadonlySet<string>,
): string[] {
  return uniqueSorted([
    ...action.evidenceRefs,
    ...action.success.evidenceRefs,
    ...action.failure.evidenceRefs,
  ]).filter((reference) => requiredEvidenceIds.has(reference));
}

function mismatchDiagnostic(input: {
  code: string;
  storyId: string;
  reference: string;
  relation: string;
}): CompilationDiagnosticV1 {
  return diagnostic({
    code: input.code,
    category: "link",
    message: `${input.relation} ${input.reference} must have the same story disposition as ${input.storyId}`,
    reference: input.reference,
  });
}

function requireSameOwner(input: {
  owners: ReadonlyMap<string, string[]>;
  reference: string;
  storyId: string;
  code: string;
  relation: string;
}): CompilationDiagnosticV1 | undefined {
  const owner = soleOwner(input.owners, input.reference);
  if (!owner || owner === input.storyId) return undefined;
  return mismatchDiagnostic(input);
}

function validateSemanticPartition(value: ParsedInput): {
  diagnostics: CompilationDiagnosticV1[];
  owners: Record<SemanticField, Map<string, string[]>>;
} {
  const expectations: Array<{
    field: SemanticField;
    expected: string[];
    label: string;
  }> = [
    { field: "surfaceRefs", expected: value.productSpec.surfaces.map((item) => item.id), label: "SURFACE" },
    { field: "controlRefs", expected: value.designGraph.controls.map((item) => item.id), label: "CONTROL" },
    { field: "actionRefs", expected: value.productSpec.actions.map((item) => item.id), label: "ACTION" },
    { field: "stateRefs", expected: value.productSpec.states.map((item) => item.id), label: "STATE" },
    { field: "persistenceRefs", expected: value.productSpec.persistencePolicies.map((item) => item.id), label: "PERSISTENCE" },
    {
      field: "evidenceRefs",
      expected: value.productSpec.evidencePredicates.filter((item) => item.required).map((item) => item.id),
      label: "EVIDENCE",
    },
  ];
  const owners = Object.fromEntries(expectations.map(({ field }) => [
    field,
    semanticOwners(value.stories, field),
  ])) as Record<SemanticField, Map<string, string[]>>;
  return {
    diagnostics: expectations.flatMap((expectation) => exactPartitionDiagnostics({
      stories: value.stories,
      ...expectation,
    })),
    owners,
  };
}

function routeOwners(
  productSpec: ProductSpecV1,
  surfaceOwners: ReadonlyMap<string, string[]>,
  diagnostics: CompilationDiagnosticV1[],
): Map<string, string> {
  const result = new Map<string, string>();
  productSpec.routes.forEach((route) => {
    const owners = uniqueSorted(route.surfaceRefs.flatMap((surfaceRef) =>
      surfaceOwners.get(surfaceRef) ?? []));
    if (owners.length !== 1) {
      diagnostics.push(diagnostic({
        code: "STORY_PLAN_ROUTE_PARTITION_CONFLICT",
        category: "link",
        message: `Route ${route.id} surfaces do not resolve to one story disposition`,
        reference: route.id,
      }));
      return;
    }
    result.set(route.id, owners[0]!);
  });
  return result;
}

function validateProductClosure(
  value: ParsedInput,
  owners: Record<SemanticField, Map<string, string[]>>,
): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const routes = routeOwners(value.productSpec, owners.surfaceRefs, diagnostics);
  const requiredEvidenceIds = new Set(value.productSpec.evidencePredicates
    .filter((item) => item.required)
    .map((item) => item.id));
  value.productSpec.actions.forEach((action) => {
    const storyId = soleOwner(owners.actionRefs, action.id);
    if (!storyId) return;
    action.surfaceRefs.forEach((reference) => {
      const issue = requireSameOwner({
        owners: owners.surfaceRefs,
        reference,
        storyId,
        code: "STORY_PLAN_ACTION_SURFACE_OWNER_MISMATCH",
        relation: `Action ${action.id} surface`,
      });
      if (issue) diagnostics.push(issue);
    });
    requiredActionStateRefs(action).forEach((reference) => {
      const issue = requireSameOwner({
        owners: owners.stateRefs,
        reference,
        storyId,
        code: "STORY_PLAN_ACTION_STATE_OWNER_MISMATCH",
        relation: `Action ${action.id} state`,
      });
      if (issue) diagnostics.push(issue);
    });
    requiredActionPersistenceRefs(action).forEach((reference) => {
      const issue = requireSameOwner({
        owners: owners.persistenceRefs,
        reference,
        storyId,
        code: "STORY_PLAN_ACTION_PERSISTENCE_OWNER_MISMATCH",
        relation: `Action ${action.id} persistence`,
      });
      if (issue) diagnostics.push(issue);
    });
    requiredActionEvidenceRefs(action, requiredEvidenceIds).forEach((reference) => {
      const issue = requireSameOwner({
        owners: owners.evidenceRefs,
        reference,
        storyId,
        code: "STORY_PLAN_ACTION_EVIDENCE_OWNER_MISMATCH",
        relation: `Action ${action.id} evidence`,
      });
      if (issue) diagnostics.push(issue);
    });
    if (action.navigation.kind === "route") {
      const routeOwner = routes.get(action.navigation.routeRef);
      if (routeOwner && routeOwner !== storyId) {
        diagnostics.push(mismatchDiagnostic({
          code: "STORY_PLAN_ACTION_ROUTE_OWNER_MISMATCH",
          storyId,
          reference: action.navigation.routeRef,
          relation: `Action ${action.id} route`,
        }));
      }
    }
  });

  const evidenceOwners = owners.evidenceRefs;
  const subjectOwners = new Map<string, string>();
  for (const [reference, storyRefs] of [
    ...owners.actionRefs,
    ...owners.surfaceRefs,
    ...owners.stateRefs,
    ...owners.persistenceRefs,
  ]) {
    if (storyRefs.length === 1) subjectOwners.set(reference, storyRefs[0]!);
  }
  routes.forEach((storyId, routeRef) => subjectOwners.set(routeRef, storyId));
  const capabilities = new Map(value.buildTopology.capabilities.map((item) => [item.id, item]));
  value.productSpec.evidencePredicates.forEach((predicate) => {
    const evidenceOwner = soleOwner(evidenceOwners, predicate.id);
    const subjectOwner = subjectOwners.get(predicate.subjectRef);
    if (evidenceOwner && subjectOwner && evidenceOwner !== subjectOwner) {
      diagnostics.push(mismatchDiagnostic({
        code: "STORY_PLAN_EVIDENCE_SUBJECT_OWNER_MISMATCH",
        storyId: evidenceOwner,
        reference: predicate.subjectRef,
        relation: `Evidence ${predicate.id} subject`,
      }));
    }
    predicate.capabilityRefs.forEach((capabilityRef) => {
      if (!capabilities.get(capabilityRef)?.enabled) {
        diagnostics.push(diagnostic({
          code: "STORY_PLAN_EVIDENCE_CAPABILITY_UNAVAILABLE",
          category: "link",
          message: `Evidence ${predicate.id} requires absent or disabled topology capability ${capabilityRef}`,
          reference: capabilityRef,
        }));
      }
    });
  });

  const surfaceIds = new Set(value.productSpec.surfaces.map((item) => item.id));
  value.designGraph.surfaces.forEach((surface) => {
    if (!surfaceIds.has(surface.surfaceRef)) {
      diagnostics.push(diagnostic({
        code: "STORY_PLAN_DESIGN_SURFACE_REF_UNRESOLVED",
        category: "link",
        message: `Design surface ${surface.id} references absent ProductSpec surface ${surface.surfaceRef}`,
        reference: surface.surfaceRef,
      }));
    }
  });
  value.designGraph.controls.forEach((control) => {
    if (!surfaceIds.has(control.surfaceRef)) {
      diagnostics.push(diagnostic({
        code: "STORY_PLAN_CONTROL_SURFACE_REF_UNRESOLVED",
        category: "link",
        message: `Control ${control.id} references absent ProductSpec surface ${control.surfaceRef}`,
        reference: control.surfaceRef,
      }));
      return;
    }
    const storyId = soleOwner(owners.controlRefs, control.id);
    if (!storyId) return;
    const issue = requireSameOwner({
      owners: owners.surfaceRefs,
      reference: control.surfaceRef,
      storyId,
      code: "STORY_PLAN_CONTROL_SURFACE_OWNER_MISMATCH",
      relation: `Control ${control.id} surface`,
    });
    if (issue) diagnostics.push(issue);
  });
  return diagnostics;
}

function validateDesignClosure(
  value: ParsedInput,
  owners: Record<SemanticField, Map<string, string[]>>,
): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  if (value.designGraph.unresolvedBindings.length > 0) {
    value.designGraph.unresolvedBindings.forEach((binding) => diagnostics.push(diagnostic({
      code: "STORY_PLAN_UNRESOLVED_CONTROL",
      category: "link",
      message: `Control ${binding.controlRef} has no exact semantic disposition`,
      reference: binding.controlRef,
    })));
  }

  const actionIds = new Set(value.productSpec.actions.map((item) => item.id));
  const stateIds = new Set(value.productSpec.states.map((item) => item.id));
  const persistenceIds = new Set(value.productSpec.persistencePolicies.map((item) => item.id));
  const evidenceIds = new Set(value.productSpec.evidencePredicates.map((item) => item.id));
  const routeById = new Map(value.productSpec.routes.map((route) => [route.id, route]));
  const surfaceById = new Map(value.productSpec.surfaces.map((surface) => [surface.id, surface]));
  const controlById = new Map(value.designGraph.controls.map((control) => [control.id, control]));
  value.designGraph.bindings.forEach((binding) => {
    const controlOwner = soleOwner(owners.controlRefs, binding.controlRef);
    if (!controlOwner) return;
    if (binding.disposition === "action") {
      if (!actionIds.has(binding.actionRef)) {
        diagnostics.push(diagnostic({
          code: "STORY_PLAN_BINDING_ACTION_REF_UNRESOLVED",
          category: "link",
          message: `Control ${binding.controlRef} references absent ProductSpec action ${binding.actionRef}`,
          reference: binding.actionRef,
        }));
      }
      if (binding.routeRef && !routeById.has(binding.routeRef)) {
        diagnostics.push(diagnostic({
          code: "STORY_PLAN_BINDING_ROUTE_REF_UNRESOLVED",
          category: "link",
          message: `Control ${binding.controlRef} references absent ProductSpec route ${binding.routeRef}`,
          reference: binding.routeRef,
        }));
      }
      const control = controlById.get(binding.controlRef);
      const expectedRouteRef = control ? surfaceById.get(control.surfaceRef)?.routeRef : undefined;
      if (expectedRouteRef && binding.routeRef !== expectedRouteRef) {
        diagnostics.push(diagnostic({
          code: "STORY_PLAN_BINDING_ROUTE_SURFACE_MISMATCH",
          category: "link",
          message: `Control ${binding.controlRef} binding route must equal its surface route ${expectedRouteRef}`,
          reference: binding.routeRef ?? binding.controlRef,
        }));
      }
      const actionOwner = soleOwner(owners.actionRefs, binding.actionRef);
      if (actionOwner && actionOwner !== controlOwner) {
        diagnostics.push(mismatchDiagnostic({
          code: "STORY_PLAN_CONTROL_ACTION_OWNER_MISMATCH",
          storyId: controlOwner,
          reference: binding.actionRef,
          relation: `Control ${binding.controlRef} action`,
        }));
      }
      binding.inputBindings.forEach((input) => {
        if (input.valueFrom.kind === "control_value") {
          const issue = requireSameOwner({
            owners: owners.controlRefs,
            reference: input.valueFrom.controlRef,
            storyId: controlOwner,
            code: "STORY_PLAN_INPUT_CONTROL_OWNER_MISMATCH",
            relation: `Control ${binding.controlRef} input control`,
          });
          if (issue) diagnostics.push(issue);
        }
        if (input.valueFrom.kind === "state") {
          const issue = requireSameOwner({
            owners: owners.stateRefs,
            reference: input.valueFrom.stateRef,
            storyId: controlOwner,
            code: "STORY_PLAN_INPUT_STATE_OWNER_MISMATCH",
            relation: `Control ${binding.controlRef} input state`,
          });
          if (issue) diagnostics.push(issue);
        }
      });
      for (const [field, references, code] of [
        ["stateRefs", binding.stateRefs, "STORY_PLAN_BINDING_STATE_OWNER_MISMATCH"],
        ["persistenceRefs", binding.persistenceRefs, "STORY_PLAN_BINDING_PERSISTENCE_OWNER_MISMATCH"],
        ["evidenceRefs", binding.evidenceRefs, "STORY_PLAN_BINDING_EVIDENCE_OWNER_MISMATCH"],
      ] as const) {
        references.forEach((reference) => {
          const canonical = field === "stateRefs"
            ? stateIds
            : field === "persistenceRefs"
              ? persistenceIds
              : evidenceIds;
          if (!canonical.has(reference)) {
            diagnostics.push(diagnostic({
              code: field === "stateRefs"
                ? "STORY_PLAN_BINDING_STATE_REF_UNRESOLVED"
                : field === "persistenceRefs"
                  ? "STORY_PLAN_BINDING_PERSISTENCE_REF_UNRESOLVED"
                  : "STORY_PLAN_BINDING_EVIDENCE_REF_UNRESOLVED",
              category: "link",
              message: `Control ${binding.controlRef} ${field} reference ${reference} is absent from ProductSpec`,
              reference,
            }));
          }
          const issue = requireSameOwner({
            owners: owners[field],
            reference,
            storyId: controlOwner,
            code,
            relation: `Control ${binding.controlRef} ${field}`,
          });
          if (issue) diagnostics.push(issue);
        });
      }
    } else if (binding.disposition === "value_input") {
      binding.fields.forEach((field) => {
        if (!actionIds.has(field.actionRef)) {
          diagnostics.push(diagnostic({
            code: "STORY_PLAN_BINDING_ACTION_REF_UNRESOLVED",
            category: "link",
            message: `Value input ${binding.controlRef} references absent ProductSpec action ${field.actionRef}`,
            reference: field.actionRef,
          }));
        }
        const actionOwner = soleOwner(owners.actionRefs, field.actionRef);
        if (actionOwner && actionOwner !== controlOwner) {
          diagnostics.push(mismatchDiagnostic({
            code: "STORY_PLAN_CONTROL_ACTION_OWNER_MISMATCH",
            storyId: controlOwner,
            reference: field.actionRef,
            relation: `Value input ${binding.controlRef} action`,
          }));
        }
      });
    } else if (binding.disposition === "external") {
      binding.evidenceRefs.forEach((reference) => {
        if (!evidenceIds.has(reference)) {
          diagnostics.push(diagnostic({
            code: "STORY_PLAN_BINDING_EVIDENCE_REF_UNRESOLVED",
            category: "link",
            message: `External control ${binding.controlRef} evidence ${reference} is absent from ProductSpec`,
            reference,
          }));
        }
        const issue = requireSameOwner({
          owners: owners.evidenceRefs,
          reference,
          storyId: controlOwner,
          code: "STORY_PLAN_EXTERNAL_EVIDENCE_OWNER_MISMATCH",
          relation: `Control ${binding.controlRef} external evidence`,
        });
        if (issue) diagnostics.push(issue);
      });
    }
  });
  return diagnostics;
}

function dependsTransitively(
  storyId: string,
  dependencyId: string,
  dependencies: ReadonlyMap<string, readonly string[]>,
): boolean {
  const pending = [...(dependencies.get(storyId) ?? [])];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.shift()!;
    if (current === dependencyId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(dependencies.get(current) ?? []));
  }
  return false;
}

function validateTopologyOwnership(value: ParsedInput): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const storyIds = new Set(value.stories.map((story) => story.id));
  const storyOwnerByStory = new Map(
    value.buildTopology.owners
      .filter((owner) => owner.kind === "story")
      .map((owner) => [owner.storyRef, owner]),
  );
  value.stories.forEach((story) => {
    const owner = storyOwnerByStory.get(story.id);
    if (!owner) {
      diagnostics.push(diagnostic({
        code: "STORY_PLAN_TOPOLOGY_OWNER_MISSING",
        message: `Story ${story.id} has no exact topology owner`,
        reference: story.id,
      }));
      return;
    }
    if (!value.buildTopology.pathBindings.some((binding) => binding.ownerRef === owner.id)) {
      diagnostics.push(diagnostic({
        code: "STORY_PLAN_OWNED_PATH_MISSING",
        message: `Story ${story.id} owner ${owner.id} has no owned path`,
        reference: owner.id,
      }));
    }
  });
  storyOwnerByStory.forEach((_owner, storyRef) => {
    if (!storyIds.has(storyRef)) {
      diagnostics.push(diagnostic({
        code: "STORY_PLAN_TOPOLOGY_OWNER_ORPHANED",
        message: `Topology story owner ${storyRef} is absent from the exact StoryPlan input`,
        reference: storyRef,
      }));
    }
  });

  const ownerToStory = new Map(
    value.buildTopology.owners
      .filter((owner) => owner.kind === "story")
      .map((owner) => [owner.id, owner.storyRef]),
  );
  const pathById = new Map(value.buildTopology.pathBindings.map((binding) => [binding.id, binding]));
  const dependencies = new Map(value.stories.map((story) => [story.id, story.dependsOn]));
  value.buildTopology.sharedGrants.forEach((grant) => {
    grant.pathRefs.forEach((pathRef) => {
      const binding = pathById.get(pathRef);
      if (binding && binding.ownerRef !== grant.fromOwnerRef) {
        diagnostics.push(diagnostic({
          code: "STORY_PLAN_GRANT_SOURCE_OWNER_MISMATCH",
          message: `Grant ${grant.id} references a path not owned by ${grant.fromOwnerRef}`,
          reference: pathRef,
        }));
      }
    });
    const fromStory = ownerToStory.get(grant.fromOwnerRef);
    const toStory = ownerToStory.get(grant.toOwnerRef);
    if (fromStory && toStory && !dependsTransitively(toStory, fromStory, dependencies)) {
      diagnostics.push(diagnostic({
        code: "STORY_PLAN_GRANT_DEPENDENCY_MISSING",
        message: `Story ${toStory} must depend on grant source story ${fromStory}`,
        reference: grant.id,
      }));
    }
  });

  const routeIds = new Set(value.productSpec.routes.map((route) => route.id));
  value.buildTopology.entrypoints.forEach((entrypoint) => {
    entrypoint.routeRefs.forEach((routeRef) => {
      if (!routeIds.has(routeRef)) {
        diagnostics.push(diagnostic({
          code: "STORY_PLAN_ENTRYPOINT_ROUTE_UNRESOLVED",
          category: "link",
          message: `Entrypoint ${entrypoint.id} references absent ProductSpec route ${routeRef}`,
          reference: routeRef,
        }));
      }
    });
  });
  value.productSpec.routes.filter((route) => route.entry).forEach((route) => {
    if (!value.buildTopology.entrypoints.some((entrypoint) => entrypoint.routeRefs.includes(route.id))) {
      diagnostics.push(diagnostic({
        code: "STORY_PLAN_ENTRY_ROUTE_UNREACHABLE",
        category: "link",
        message: `Entry route ${route.id} is absent from every typed build entrypoint`,
        reference: route.id,
      }));
    }
  });
  return diagnostics;
}

function deterministicStoryPlan(
  value: ParsedInput,
  topology: BuildTopologyV1,
): StoryPlanV1 {
  const ownerByStory = new Map(
    topology.owners
      .filter((owner) => owner.kind === "story")
      .map((owner) => [owner.storyRef, owner.id]),
  );
  return {
    schema: "setfarm.story-plan.v1",
    stories: value.stories
      .map((story) => {
        const ownerRef = ownerByStory.get(story.id)!;
        return {
          ...story,
          dependsOn: uniqueSorted(story.dependsOn),
          surfaceRefs: uniqueSorted(story.surfaceRefs),
          controlRefs: uniqueSorted(story.controlRefs),
          actionRefs: uniqueSorted(story.actionRefs),
          stateRefs: uniqueSorted(story.stateRefs),
          persistenceRefs: uniqueSorted(story.persistenceRefs),
          evidenceRefs: uniqueSorted(story.evidenceRefs),
          ownerRef,
          ownedPathRefs: topology.pathBindings
            .filter((binding) => binding.ownerRef === ownerRef)
            .map((binding) => binding.id)
            .sort(compareUtf16),
          sharedGrantRefs: topology.sharedGrants
            .filter((grant) => grant.toOwnerRef === ownerRef)
            .map((grant) => grant.id)
            .sort(compareUtf16),
        };
      })
      .sort((left, right) => left.order - right.order || compareUtf16(left.id, right.id)),
  };
}

export function produceStoryPlanV1(input: unknown): StoryPlanProducerResult {
  const parsed = StoryPlanProducerInputSchema.safeParse(input);
  if (!parsed.success) return reject(inputDiagnostics(parsed.error));

  const partition = validateSemanticPartition(parsed.data);
  const diagnostics = [
    ...partition.diagnostics,
    ...validateProductClosure(parsed.data, partition.owners),
    ...validateDesignClosure(parsed.data, partition.owners),
    ...validateTopologyOwnership(parsed.data),
  ];
  if (diagnostics.length > 0) return reject(diagnostics);

  const candidate = deterministicStoryPlan(parsed.data, parsed.data.buildTopology);
  const result = StoryPlanV1Schema.safeParse(candidate);
  if (!result.success) {
    return reject(result.error.issues.slice(0, 200).map((issue) => diagnostic({
      code: "STORY_PLAN_CONTRACT_INVALID",
      message: `Produced StoryPlan failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      reference: issue.path.join("/") || "$",
    })));
  }
  return { status: "produced", storyPlan: result.data, diagnostics: [] };
}
